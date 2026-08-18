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

export interface TradingState {
  mode: "paper" | "live"
  agent: AgentInfo
  account: AccountInfo
  equity: EquityPoint[]
  positions: Position[]
  activity: ActivityItem[]

  // --- internal accounting (not exposed to the dashboard) ---
  cash: number // free USD in trading wallet
  initialEquity: number // seeding deposit, used for allTimePnl
  todayStartEquity: number
  todayDate: string // YYYY-MM-DD
  lastTickAt: number // epoch ms
  lastPointAt: number // epoch ms, throttles equity points
  lastDataErrorAt: number // epoch ms, throttles offline notices
}
