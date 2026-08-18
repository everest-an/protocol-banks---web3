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

export function seedState(): TradingState {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  return {
    mode: "paper",
    agent: {
      status: "running",
      strategy: "Momentum + Funding Carry (paper)",
      lastScanAt: new Date(now).toISOString(),
      marketsScanned: 0,
      confidenceHighSignals: 0,
    },
    account: {
      totalEquity: PAPER_BUDGET,
      mainWallet: 0,
      tradingWallet: PAPER_BUDGET,
      budget: PAPER_BUDGET,
      maxLoss: PAPER_BUDGET,
      todayPnl: 0,
      todayPnlPct: 0,
      allTimePnl: 0,
    },
    equity: [{ t: today, v: PAPER_BUDGET }],
    positions: [],
    activity: [
      {
        time: new Date(now).toISOString(),
        type: "info",
        text: `Paper trading started with a $${PAPER_BUDGET} virtual budget. Real market data, simulated fills — no real money at risk.`,
        pnl: null,
      },
    ],
    cash: PAPER_BUDGET,
    initialEquity: PAPER_BUDGET,
    todayStartEquity: PAPER_BUDGET,
    todayDate: today,
    lastTickAt: 0,
    lastPointAt: 0,
    lastDataErrorAt: 0,
  }
}

export class TradingStore {
  private state: TradingState | null = null

  private ensureLoaded(): TradingState {
    if (this.state) return this.state
    try {
      const raw = fs.readFileSync(STATE_FILE, "utf-8")
      this.state = JSON.parse(raw) as TradingState
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
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), "utf-8")
  }

  reset(): TradingState {
    this.state = seedState()
    this.save()
    return this.state
  }
}

let singleton: TradingStore | null = null

export function getStore(): TradingStore {
  if (!singleton) singleton = new TradingStore()
  return singleton
}
