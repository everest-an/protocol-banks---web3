/**
 * Trading state store — file-backed persistence for paper mode.
 *
 * The store survives dev-server restarts and works without any external
 * infra (no Postgres/Redis required). A future live mode will swap this
 * for a Prisma-backed store with per-user isolation; the state shape in
 * types.ts is the contract both implementations must honor.
 */

import fs from "fs"
import path from "path"
import os from "os"
import { createHash } from "crypto"
import type { TradingState } from "./types"

/**
 * State lives under the project's .data dir locally. On serverless hosts
 * (Vercel) the project dir is read-only — fall back to the ephemeral
 * /tmp dir, which is writable. Paper state is not real funds, so losing
 * it across cold starts is acceptable; production persistence uses the
 * Prisma-backed store (TradingAccount / TradeRecord).
 */
function resolveStateDir(): string {
  if (process.env.TRADING_STATE_DIR) return process.env.TRADING_STATE_DIR
  const projectDir = path.join(process.cwd(), ".data", "trading")
  try {
    fs.mkdirSync(projectDir, { recursive: true })
    fs.accessSync(projectDir, fs.constants.W_OK)
    return projectDir
  } catch {
    return path.join(os.tmpdir(), "protocol-bank-trading")
  }
}

const STATE_DIR = resolveStateDir()
const STATE_FILE = path.join(STATE_DIR, "state.json")

export const PAPER_BUDGET = 500

/** Days of demo history seeded into a fresh paper account. */
const DEMO_HISTORY_DAYS = 30

/**
 * Deterministic 30-day demo equity curve for first impressions.
 *
 * A brand-new paper account with a flat line at $500 is a bad first look —
 * visitors can't tell whether the agent does anything. This seeds a realistic
 * back-and-forth curve (including a drawdown) that ends slightly up.
 *
 * It is DEMO DATA and is labelled as such in the activity feed: the curve is
 * generated locally, not replayed from verified market data. Deterministic
 * (mulberry32 with a fixed seed) so the curve is stable across restarts.
 */
function seedDemoEquityCurve(): { equity: { t: string; v: number }[]; finalEquity: number } {
  let a = 0x9e3779b9
  const rand = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const equity: { t: string; v: number }[] = []
  let v = PAPER_BUDGET
  const drift = 0.06 / DEMO_HISTORY_DAYS // +6% over the window
  const dayMs = 86_400_000

  for (let i = DEMO_HISTORY_DAYS; i >= 0; i--) {
    const t = new Date(Date.now() - i * dayMs).toISOString().slice(0, 10)
    // Drawdown in the middle third so the curve looks like real trading,
    // not a straight line up.
    const phase = (DEMO_HISTORY_DAYS - i) / DEMO_HISTORY_DAYS
    const drawdown = phase > 0.3 && phase < 0.55 ? -0.004 : 0
    const noise = (rand() - 0.5) * 0.012
    v = Math.max(PAPER_BUDGET * 0.9, v * (1 + drift + drawdown + noise))
    equity.push({ t, v: Number(v.toFixed(2)) })
  }

  return { equity, finalEquity: equity[equity.length - 1].v }
}

export function seedState(opts: { demoHistory?: boolean } = {}): TradingState {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const withHistory = opts.demoHistory !== false

  // Fresh accounts get the demo-history curve; an explicit user reset gets a
  // clean $500 start (resetting should feel like a clean slate, not more history).
  const demo = withHistory
    ? seedDemoEquityCurve()
    : { equity: [{ t: today, v: PAPER_BUDGET }], finalEquity: PAPER_BUDGET }
  const startEquity = demo.finalEquity
  const allTimePnl = Number((startEquity - PAPER_BUDGET).toFixed(2))
  const firstDay = demo.equity[0]?.t ?? today

  const activity: TradingState["activity"] = withHistory
    ? [
        {
          time: new Date(`${firstDay}T00:00:00Z`).toISOString(),
          type: "info",
          text: `Simulated demo history: ${DEMO_HISTORY_DAYS} days of illustrative performance (generated for the demo — not real trading results). Your own paper account trades live from here.`,
          pnl: null,
        },
        {
          time: new Date(now).toISOString(),
          type: "info",
          text: `Paper account ready: $${startEquity.toFixed(2)} simulated budget on real market data. No real money at risk.`,
          pnl: null,
        },
      ]
    : [
        {
          time: new Date(now).toISOString(),
          type: "info",
          text: `Paper account reset to $${PAPER_BUDGET} virtual budget. Real market data, simulated fills — no real money at risk.`,
          pnl: null,
        },
      ]

  return {
    mode: "paper",
    agent: {
      status: "running",
      strategy: "Momentum + Funding Carry (paper)",
      lastScanAt: new Date(now).toISOString(),
      marketsScanned: 0,
      confidenceHighSignals: 0,
    },
    approvalMode: "auto",
    account: {
      totalEquity: startEquity,
      mainWallet: 0,
      tradingWallet: startEquity,
      budget: PAPER_BUDGET,
      maxLoss: startEquity,
      todayPnl: 0,
      todayPnlPct: 0,
      allTimePnl,
    },
    equity: demo.equity,
    positions: [],
    activity,
    cash: startEquity,
    initialEquity: PAPER_BUDGET,
    todayStartEquity: startEquity,
    todayDate: today,
    lastTickAt: 0,
    lastPointAt: 0,
    lastDataErrorAt: 0,
  }
}

/**
 * Build the ledger for a first-time promotion to live trading.
 *
 * The paper ledger must not carry into live — positions, the simulated equity
 * curve and any pending trade are paper artefacts — so the state is rebuilt
 * from `seedState`. One field is deliberately carried across: `approvalMode`.
 * A user who switched manual approval on (the mode the help page recommends
 * for a first real-money run) must not have it silently flipped back to
 * "auto" at the exact moment real orders start going out.
 */
export function promoteToLiveLedger(current: TradingState, budget: number): TradingState {
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)
  const next = seedState({ demoHistory: false })
  return {
    ...next,
    mode: "live",
    approvalMode: current.approvalMode ?? next.approvalMode ?? "auto",
    account: {
      ...next.account,
      budget,
      tradingWallet: budget,
      totalEquity: budget,
      maxLoss: budget,
    },
    equity: [{ t: today, v: budget }],
    positions: [],
    pendingTrade: null,
    cash: budget,
    initialEquity: budget,
    todayStartEquity: budget,
    activity: [
      {
        time: new Date(now).toISOString(),
        type: "info",
        text: `Live account activated with a $${budget.toFixed(2)} trading budget. The agent places real orders through your approved agent wallet — it can trade, never withdraw.`,
        pnl: null,
      },
    ],
  }
}

export class TradingStore {
  private state: TradingState | null = null

  /** Path of the backing file — overridable for per-wallet stores. */
  protected stateFilePath(): string {
    return STATE_FILE
  }

  private ensureLoaded(): TradingState {
    if (this.state) return this.state
    try {
      const raw = fs.readFileSync(this.stateFilePath(), "utf-8")
      const parsed = JSON.parse(raw) as TradingState
      // Upgrade flat-line legacy states (a single equity point) to the
      // demo-history seed so existing demo deployments pick it up without a
      // cold start. States with real progress (2+ points) are kept as-is.
      if (!Array.isArray(parsed.equity) || parsed.equity.length <= 1) {
        this.state = seedState()
        this.save()
      } else {
        this.state = parsed
      }
    } catch {
      this.state = seedState()
      this.save()
    }
    return this.state
  }

  get(): TradingState {
    return this.ensureLoaded()
  }

  mutate(fn: (s: TradingState) => void): TradingState {
    const s = this.ensureLoaded()
    fn(s)
    this.save()
    return s
  }

  save(): void {
    if (!this.state) return
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(this.stateFilePath(), JSON.stringify(this.state, null, 2), "utf-8")
  }

  reset(): TradingState {
    // Explicit user reset → clean slate (no demo history).
    this.state = seedState({ demoHistory: false })
    this.save()
    return this.state
  }

  /** Replace the current state wholesale (used for DB hydration). */
  replace(state: TradingState): void {
    this.state = state
    this.save()
  }
}

let singleton: TradingStore | null = null

export function getStore(): TradingStore {
  if (!singleton) singleton = new TradingStore()
  return singleton
}

/** Per-wallet paper store (user isolation for paper mode). */
const walletStores = new Map<string, TradingStore>()

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Convert a caller-supplied wallet string into a SAFE file key.
 * Valid EVM addresses are used verbatim; anything else is hashed so a
 * malicious ?wallet= value can never escape the state directory
 * (path traversal guard).
 */
function safeFileKey(walletAddress: string): string {
  const lower = walletAddress.toLowerCase()
  if (EVM_ADDRESS_RE.test(lower)) return lower
  return `h-${createHash("sha256").update(lower).digest("hex").slice(0, 32)}`
}

export function getStoreForWallet(walletAddress: string | null | undefined): TradingStore {
  if (!walletAddress) return getStore() // guests share the demo account
  const key = safeFileKey(walletAddress)
  let store = walletStores.get(key)
  if (!store) {
    store = new WalletTradingStore(key)
    walletStores.set(key, store)
  }
  return store
}

/** A TradingStore whose state file is keyed by wallet address. */
class WalletTradingStore extends TradingStore {
  private fileKey: string

  constructor(walletKey: string) {
    super()
    this.fileKey = walletKey
  }

  protected override stateFilePath(): string {
    return path.join(STATE_DIR, `state-${this.fileKey}.json`)
  }
}
