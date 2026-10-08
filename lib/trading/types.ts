/**
 * Shared types for the AI trading engine.
 *
 * This is the contract between the agent (lib/trading/*), the API routes
 * (app/api/trading/*) and the dashboard (app/(products)/trading).
 */

export type AgentStatus = "running" | "paused" | "stopped"

export type ActivityType = "open" | "close" | "scan" | "guard" | "info" | "error"

export interface Position {
  symbol: string
  side: "long" | "short"
  size: number // units of coin
  entry: number // entry price USD
  mark: number // current mark price USD
  allocated: number // USD margin allocated (entry notional / leverage)
  pnl: number // unrealized USD pnl
  pnlPct: number // pnl relative to allocated margin
  leverage: number
  reason: string
  openedAt: string // ISO
}

export interface ActivityItem {
  time: string // ISO
  type: ActivityType
  text: string
  pnl: number | null
}

export interface AgentInfo {
  status: AgentStatus
  strategy: string
  lastScanAt: string
  marketsScanned: number
  confidenceHighSignals: number
}

export interface AccountInfo {
  totalEquity: number
  mainWallet: number
  tradingWallet: number
  budget: number
  maxLoss: number
  todayPnl: number
  todayPnlPct: number
  allTimePnl: number
}

export interface EquityPoint {
  t: string // ISO date
  v: number
}

/**
 * A trade the agent wants to open but is holding for human approval.
 * Only produced when the agent runs in "manual" approval mode — the user
 * decides before any order is placed.
 */
export interface PendingTrade {
  symbol: string
  side: "long" | "short"
  score: number
  reason: string
  markPx: number
  createdAt: string // ISO
}

/**
 * An order whose HTTP round-trip failed without a confirmed response
 * (timeout/reset). It may or may not have reached the exchange. Rather than
 * halting for a human, the agent blocks new entries and lets the
 * venue-reconciliation resolve it on a following tick: entry → adopted from
 * the exchange if it landed; exit → the position simply disappears from the
 * venue. Stale items (5 min, never seen on the venue) are dropped as
 * "not placed".
 */
export interface VerifyingOrder {
  coin: string
  side: "long" | "short"
  kind: "entry" | "exit"
  at: string // ISO
}

export interface TradingState {
  mode: "paper" | "live"
  agent: AgentInfo
  account: AccountInfo
  equity: EquityPoint[]
  positions: Position[]
  activity: ActivityItem[]
  /** Trade awaiting user approval (manual approval mode only). */
  pendingTrade?: PendingTrade | null
  /**
   * Orders awaiting venue verification after an UNCERTAIN response. While
   * non-empty the agent places no new entries (exits always run); each one is
   * resolved by the per-tick reconciliation.
   */
  verifying?: VerifyingOrder[] | null
  /**
   * Runtime approval mode. "auto" (default) places entries automatically;
   * "manual" holds each entry as a pending trade until the user approves.
   */
  approvalMode?: "auto" | "manual"

  // --- internal accounting (not exposed to the dashboard) ---
  cash: number // free USD in trading wallet
  initialEquity: number // seeding deposit, used for allTimePnl
  todayStartEquity: number
  todayDate: string // YYYY-MM-DD
  lastTickAt: number // epoch ms
  lastPointAt: number // epoch ms, throttles equity points
  lastDataErrorAt: number // epoch ms, throttles offline notices
}
