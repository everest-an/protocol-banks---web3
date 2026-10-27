/**
 * Agent module
 *
 * The programmatic surface for AI agents: one API key, one policy the server
 * enforces (operations, per-call cap, daily cap, coin allowlist). `order`
 * executes through the account's Hyperliquid agent wallet (trading-only
 * rights); `pay`, `swap` and `invoice` prepare something the agent signs
 * itself, because the platform holds no keys.
 *
 * Every response is the API envelope plus the HTTP `status`, so a refusal
 * (`ok: false` with 403/409) is returned, never thrown — a model should see
 * the refusal and stop, not retry it.
 */
import type { ProtocolBanksConfig } from "./types"

export type AgentOp = "read" | "pay" | "swap" | "trade"

export interface AgentPolicy {
  allowedOps: AgentOp[]
  maxNotionalUsd: number
  dailyCapUsd: number
  allowedCoins: string[]
  /** Present on `state` only: metered notional already spent today (UTC). */
  spentTodayUsd?: number
}

export interface AgentAccount {
  totalEquity: number
  mainWallet: number
  tradingWallet: number
  budget: number
  maxLoss: number
  todayPnl: number
  todayPnlPct: number
  allTimePnl: number
}

export interface AgentPosition {
  symbol: string
  side: "long" | "short"
  size: number
  entry: number
  mark: number
  pnl: number
  pnlPct: number
  leverage: number
  reason: string
}

export interface AgentActivity {
  time: string
  type: "open" | "close" | "scan" | "guard" | "info" | "error"
  text: string
  pnl: number | null
}

export interface AgentStateResponse {
  ok?: boolean
  status?: number
  error?: string
  mode?: "paper" | "live"
  agent?: {
    status: "running" | "paused" | "stopped"
    strategy: string
    lastScanAt: string
    marketsScanned: number
    confidenceHighSignals: number
  }
  account?: AgentAccount
  equity?: { t: string; v: number }[]
  positions?: AgentPosition[]
  activity?: AgentActivity[]
  pendingTrade?: {
    symbol: string
    side: "long" | "short"
    score: number
    reason: string
    markPx: number
    createdAt: string
  } | null
  approvalMode?: "auto" | "manual"
  policy?: AgentPolicy
}

export interface AgentOrderRequest {
  coin: string
  side: "long" | "short"
  /** Notional in USD. Clamped to the platform position cap; refused above the key's cap. */
  sizeUsd: number
  reason?: string
}

export interface AgentFill {
  coin: string
  side: "long" | "short"
  avgPx: number
  size: number
  notional: number
}

export interface AgentOrderResponse {
  ok: boolean
  status?: number
  fill?: AgentFill
  fee?: number
  mode?: "live" | "paper"
  /** dailyCapUsd − spentTodayUsd − this order */
  remainingTodayUsd?: number
  error?: string
}

export interface AgentPayRequest {
  to: string
  amountUsd: number
  token?: string
  chain?: string
  memo?: string
}

export interface AgentPayIntent {
  kind: "evm-transfer" | "solana-transfer"
  to: string
  token: string
  chain: string
  amountUsd: number
  memo?: string
  remainingTodayUsd: number
}

export interface AgentPayResponse {
  ok: boolean
  status?: number
  intent?: AgentPayIntent
  note?: string
  error?: string
}

export interface AgentSwapAsset {
  symbol: string
  blockchain: string
  address?: string | null
}

export interface AgentSwapRequest {
  from: AgentSwapAsset
  to: AgentSwapAsset
  /** Amount in token units, as a string to avoid float precision loss. */
  amount: string
  amountUsd: number
  slippage?: number
}

export interface AgentSwapResponse {
  ok: boolean
  status?: number
  route?: {
    requestId: string
    outputAmount: string
    outputAmountUsd: number
    swaps: unknown[]
    tags: unknown[]
    estimatedTimeInSeconds: number
    totalFeeUsd: number
    priceImpact: number
  }
  note?: string
  error?: string
}

export interface AgentInvoiceRequest {
  to: string
  amount: number
  token?: string
  chain?: string
  description?: string
  expiresInHours?: number
}

export interface AgentInvoice {
  invoiceId: string
  status: "pending" | "paid" | "expired" | "cancelled"
  to: string
  amount: number
  token: string
  chain: string
  description?: string
  expiresAt: string
  signed: boolean
  /** Give this to the payer: /pay?invoice=…&sig=… */
  paymentLink: string
}

export interface AgentInvoiceResponse {
  ok: boolean
  status?: number
  invoice?: AgentInvoice
  note?: string
  error?: string
}

export interface AgentInvoiceStatusResponse {
  ok: boolean
  status: number
  invoice?: {
    invoice_id: string
    status: string
    token: string
    chain: string | null
    amount: number
    paid_at: string | null
    customer_wallet: string | null
  }
  error?: string
}

export class Agent {
  private readonly config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  private baseUrl(): string {
    return this.config.baseUrl || "https://protocolbanks.com"
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T & { status: number }> {
    const res = await fetch(`${this.baseUrl()}/api/v1/agent${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const json = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as T
    return { ...json, status: res.status }
  }

  /** Mode, equity, positions, activity and the key's policy with spentTodayUsd. */
  async state(): Promise<AgentStateResponse> {
    return this.call<AgentStateResponse>("GET", "/state")
  }

  /** Place one order. Executes through the trading-only agent wallet. */
  async order(request: AgentOrderRequest): Promise<AgentOrderResponse> {
    return this.call<AgentOrderResponse>("POST", "/orders", request)
  }

  /** Validate a payment and return the intent the agent signs itself. */
  async pay(request: AgentPayRequest): Promise<AgentPayResponse> {
    return this.call<AgentPayResponse>("POST", "/pay", request)
  }

  /** Quote a swap; the agent signs and submits the returned transaction. */
  async swap(request: AgentSwapRequest): Promise<AgentSwapResponse> {
    return this.call<AgentSwapResponse>("POST", "/swap", request)
  }

  /** Create a pending invoice and get the payer's paymentLink. */
  async invoice(request: AgentInvoiceRequest): Promise<AgentInvoiceResponse> {
    return this.call<AgentInvoiceResponse>("POST", "/invoice", request)
  }

  /**
   * Read an invoice back with the id and signature from its paymentLink
   * (`/pay?invoice=<id>&sig=<sig>`). A signed invoice answers 403 without sig.
   */
  async invoiceStatus(invoiceId: string, sig?: string): Promise<AgentInvoiceStatusResponse> {
    const query = new URLSearchParams({ id: invoiceId })
    if (sig) query.set("sig", sig)
    const res = await fetch(`${this.baseUrl()}/api/invoice?${query.toString()}`)
    const json = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
      success?: boolean
      invoice?: AgentInvoiceStatusResponse["invoice"]
      error?: string
    }
    return { ok: Boolean(json.success), status: res.status, invoice: json.invoice, error: json.error }
  }
}
