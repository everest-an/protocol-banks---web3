/**
 * Live order executor — the bridge from the agent engine to real Hyperliquid
 * orders, signed by the user's approved agent wallet.
 *
 * Responsibilities:
 *   1. Decrypt the user's agent key (trading-only) and sign L1 actions.
 *   2. Place / close real orders and translate Hyperliquid's response into a
 *      four-state result the engine can act on safely:
 *        - ok        → filled (real avgPx + size)
 *        - rejected  → the exchange definitively did NOT accept the order
 *        - uncertain → the request may or may not have landed (timeout,
 *                      connection reset, unparseable body). The engine must
 *                      NEVER retry an uncertain order — that is how duplicate
 *                      positions get opened. Treat it as "possibly spent".
 *        - preSubmit → the order was never submitted (market lookup/data
 *                      failure, sizing or signing error). Nothing is on the
 *                      venue and nothing is uncertain; a later tick may try
 *                      again. Reporting these as "uncertain" produced seven
 *                      false "may have reached the exchange" alerts in one
 *                      afternoon (2026-10-15).
 *
 * This mirrors MoneySwitch's "unknown payments count as spent" rule: we
 * over-count rather than risk double-spending the user's funds.
 */

import { randomBytes } from "node:crypto"
import { getAgentWallet, loadAgentKeyRecord } from "./keys"
import { placeMarketOrder, coinToIndex, PreSubmitError } from "./exchange"

export type OrderResult =
  | { ok: true; avgPx: number; totalSz: number; oid: number | null; cloid?: string }
  | { ok: false; rejected: true; preSubmit?: false; reason: string }
  | { ok: false; rejected: false; uncertainty: true; preSubmit?: false; reason: string; cloid?: string }
  /** Never submitted: nothing on the venue, nothing to verify. */
  | { ok: false; rejected: false; uncertainty: false; preSubmit: true; reason: string }

/** Build the pre-submit result — nothing reached the venue. */
function preSubmit(reason: string): OrderResult {
  return { ok: false, rejected: false, uncertainty: false, preSubmit: true, reason }
}

export interface LiveExecutorContext {
  /** The user's wallet address (owner of the TradingAccount). */
  walletAddress: string
  /**
   * The account that trades on Hyperliquid — a vault or subaccount address, or
   * null for a normal account (see resolveVaultAddress).
   */
  vaultAddress: string | null
}

/**
 * Hyperliquid's `vaultAddress` means "trading on behalf of a vault or
 * subaccount" — the Python SDK defaults it to None and CCXT to undefined for a
 * normal account, and both sign it into the action digest. Forwarding the
 * user's own main account (which is what `hyperliquid_address` means, per the
 * schema: "user's Hyperliquid main account (defaults to wallet_address)") would
 * claim to act for a vault that does not exist, so only a genuinely different
 * account is passed through.
 */
export function resolveVaultAddress(
  hyperliquidAddress: string | null | undefined,
  walletAddress: string,
): string | null {
  if (!hyperliquidAddress) return null
  return hyperliquidAddress.toLowerCase() === walletAddress.toLowerCase() ? null : hyperliquidAddress
}

export class LiveOrderExecutor {
  private ctx: LiveExecutorContext
  private coinIndexCache = new Map<string, number>()

  constructor(ctx: LiveExecutorContext) {
    this.ctx = {
      walletAddress: ctx.walletAddress.toLowerCase(),
      vaultAddress: ctx.vaultAddress ? ctx.vaultAddress.toLowerCase() : null,
    }
  }

  /** True when the user has an approved agent key on file. */
  isReady(): boolean {
    const record = loadAgentKeyRecord(this.ctx.walletAddress)
    return !!record?.approved
  }

  /**
   * Place a market (IOC) order with the agent wallet.
   * `sizeUsd` is the notional in USD; `reduceOnly` closes an existing position.
   */
  async placeOrder(params: {
    coin: string
    isBuy: boolean
    sizeUsd: number
    reduceOnly?: boolean
  }): Promise<OrderResult> {
    const agentWallet = getAgentWallet(this.ctx.walletAddress)
    if (!agentWallet) {
      return { ok: false, rejected: true, reason: "No approved agent key on file for this account." }
    }

    // ── Pre-flight: nothing has been submitted yet, so a failure here is
    //    never an uncertain submission. ────────────────────────────────────
    let coinIndex: number | null
    try {
      coinIndex = await this.resolveCoinIndex(params.coin)
    } catch (e) {
      return preSubmit(
        `${e instanceof Error ? e.message : String(e)} — no order was submitted; the agent will retry on a later tick.`,
      )
    }
    if (coinIndex === null) {
      return preSubmit(
        `Unknown market "${params.coin}" on Hyperliquid (not in the venue's perp universe) — no order was submitted.`,
      )
    }

    // Client order id for this submission: if the response is lost, the exact
    // order can be found (or ruled out) via the orderStatus query.
    const cloid = "0x" + randomBytes(16).toString("hex")

    // ── The only uncertain zone: the HTTP round-trip ──────────────────
    // Anything that fails here (timeout, reset, garbage body) could still
    // have reached the matching engine, so it must be reported as uncertain.
    let res: unknown
    try {
      res = await placeMarketOrder({
        agentWallet,
        vaultAddress: this.ctx.vaultAddress,
        coin: params.coin,
        isBuy: params.isBuy,
        sizeUsd: params.sizeUsd,
        reduceOnly: params.reduceOnly,
        cloid,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // A pre-submit failure never touched the venue: say so, instead of the
      // misleading "it may or may not have reached the exchange".
      if (e instanceof PreSubmitError) {
        return preSubmit(`${message.slice(0, 300)} — no order was submitted; the agent will retry on a later tick.`)
      }
      // A Hyperliquid *exchange error response* (HTTP non-2xx with a JSON
      // error body) is a definitive rejection — the request DID land.
      const match = /Hyperliquid exchange error (\d+):/.exec(message)
      if (match) {
        return { ok: false, rejected: true, reason: message.slice(0, 300) }
      }
      return {
        ok: false,
        rejected: false,
        uncertainty: true,
        cloid,
        reason: `Order request failed before a confirmed response (${message.slice(0, 200)}). It may or may not have reached the exchange.`,
      }
    }

    // ── Response parsing ──────────────────────────────────────────────
    // Expected shape: { status: "ok", response: { data: { statuses: [ {filled:{...}} | {error:"..."} | {resting:{...}} ] } } }
    const anyRes = res as {
      status?: string
      response?: { data?: { statuses?: Array<Record<string, unknown>> } }
    }

    const statuses = anyRes?.response?.data?.statuses
    if (anyRes?.status === "ok" && Array.isArray(statuses) && statuses.length > 0) {
      const first = statuses[0] as {
        filled?: { avgPx?: string; totalSz?: string; oid?: number }
        error?: string
        resting?: { oid?: number }
      }
      if (first.filled) {
        const avgPx = parseFloat(first.filled.avgPx ?? "0")
        const totalSz = parseFloat(first.filled.totalSz ?? "0")
        if (avgPx > 0 && totalSz > 0) {
          return { ok: true, avgPx, totalSz, oid: first.filled.oid ?? null, cloid }
        }
        // Filled with unusable numbers — conservative: uncertain.
        return {
          ok: false,
          rejected: false,
          uncertainty: true,
          cloid,
          reason: "Exchange reported a fill with unparseable price/size.",
        }
      }
      if (first.error) {
        // Definite rejection (e.g. insufficient margin, reduce-only mismatch).
        return { ok: false, rejected: true, reason: first.error }
      }
      if (first.resting) {
        // IOC orders should not rest; if one does we treat it as uncertain
        // (an order is live on the book that we did not expect).
        return {
          ok: false,
          rejected: false,
          uncertainty: true,
          cloid,
          reason: "Order unexpectedly rested on the book instead of filling immediately.",
        }
      }
    }

    return {
      ok: false,
      rejected: false,
      uncertainty: true,
      cloid,
      reason: "Unrecognised exchange response — assuming the order may have been placed.",
    }
  }

  private async resolveCoinIndex(coin: string): Promise<number | null> {
    const cached = this.coinIndexCache.get(coin)
    if (cached !== undefined) return cached
    const idx = await coinToIndex(coin)
    if (idx !== null) this.coinIndexCache.set(coin, idx)
    return idx
  }
}
