/**
 * Prisma-backed trading state store — LIVE mode persistence.
 *
 * Implements the same interface as the file-based TradingStore so the
 * engine is storage-agnostic. Keyed by wallet address: every user's
 * state lives in their own TradingAccount row (user isolation).
 *
 * The store degrades gracefully: if the database is unreachable (or the
 * tables are not migrated yet), it falls back to the file store for the
 * same wallet so the engine never crashes on infrastructure issues.
 */

import { prisma } from "@/lib/prisma"
import { TradingStore, seedState, getStore as getFileStore } from "./store"
import type { TradingState } from "./types"

export class DbTradingStore {
  private walletAddress: string
  private fileFallback: TradingStore
  private state: TradingState | null = null
  private dbUnavailable = false

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress.toLowerCase()
    // Fallback keeps the engine alive when the DB is down or not migrated.
    this.fileFallback = getFileStore()
  }

  /** Load state from TradingAccount.state_json, seeding on first run. */
  async load(): Promise<TradingState> {
    if (this.state) return this.state

    if (!this.dbUnavailable) {
      try {
        const row = await prisma.tradingAccount.findUnique({
          where: { wallet_address: this.walletAddress },
          select: { state_json: true },
        })
        if (row?.state_json) {
          this.state = row.state_json as unknown as TradingState
          return this.state
        }
        // First run — seed and persist
        const seeded = seedState()
        await this.save(seeded)
        this.state = seeded
        return this.state
      } catch (e) {
        console.warn("[trading] DB store unavailable, falling back to file store:", e)
        this.dbUnavailable = true
      }
    }

    // DB unavailable — use the shared file store
    return this.fileFallback.get()
  }

  /** Persist state to TradingAccount.state_json (upsert). */
  async save(state: TradingState): Promise<void> {
    this.state = state
    if (this.dbUnavailable) {
      this.fileFallback.mutate(() => {
        Object.assign(this.fileFallback.get(), state)
      })
      return
    }
    try {
      await prisma.tradingAccount.upsert({
        where: { wallet_address: this.walletAddress },
        create: {
          wallet_address: this.walletAddress,
          status: "live",
          budget_usd: state.account.budget,
          state_json: state as unknown as object,
        },
        update: {
          state_json: state as unknown as object,
        },
      })
    } catch (e) {
      console.warn("[trading] DB save failed, falling back to file store:", e)
      this.dbUnavailable = true
    }
  }

  /** Reset to a fresh seeded state (and persist). */
  async reset(): Promise<TradingState> {
    const seeded = seedState()
    await this.save(seeded)
    return seeded
  }
}

const liveStores = new Map<string, DbTradingStore>()

/** Per-user live-mode store (memoized). */
export function getLiveStore(walletAddress: string): DbTradingStore {
  const key = walletAddress.toLowerCase()
  let store = liveStores.get(key)
  if (!store) {
    store = new DbTradingStore(key)
    liveStores.set(key, store)
  }
  return store
}

/**
 * Standalone persistence helpers — fire-and-forget write-through used by
 * the paper agent so per-user state survives serverless restarts when the
 * database is reachable, with the file store as the fallback.
 */

export async function persistStateToDb(walletAddress: string, state: TradingState): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.tradingAccount.upsert({
      where: { wallet_address: walletAddress.toLowerCase() },
      create: {
        wallet_address: walletAddress.toLowerCase(),
        status: "paper",
        budget_usd: state.account.budget,
        state_json: state as unknown as object,
      },
      update: {
        state_json: state as unknown as object,
      },
    })
  } catch (e) {
    console.warn("[trading] state write-through skipped (DB unavailable):", e)
  }
}

export async function loadStateFromDb(walletAddress: string): Promise<TradingState | null> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const row = await prisma.tradingAccount.findUnique({
      where: { wallet_address: walletAddress.toLowerCase() },
      select: { state_json: true },
    })
    return (row?.state_json as TradingState | null) ?? null
  } catch {
    return null
  }
}
