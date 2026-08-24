import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAuth } from "@/lib/middleware/api-auth"
import fs from "fs"
import path from "path"
import os from "os"

/**
 * GET /api/admin/analytics
 *
 * Admin analytics — user count, per-user paper accounts, usage stats, and
 * collected feedback. SIWE-authenticated.
 *
 * Data sources (graceful degradation when infra is missing):
 *   1. Paper trading state files (.data/trading/state-*.json) — one per
 *      connected user + the shared guest demo
 *   2. Support feedback log (.data/support/issues.jsonl)
 *   3. Database (AuthUser / Payment counts) when reachable
 */

interface PaperAccount {
  wallet: string
  equity: number
  pnl: number
  positions: number
  activityCount: number
  agentStatus: string
  lastActive: string
}

function resolveStateDir(): string {
  if (process.env.TRADING_STATE_DIR) return process.env.TRADING_STATE_DIR
  const projectDir = path.join(process.cwd(), ".data", "trading")
  try {
    fs.accessSync(projectDir, fs.constants.W_OK)
    return projectDir
  } catch {
    return path.join(os.tmpdir(), "protocol-bank-trading")
  }
}

function readPaperAccounts(): PaperAccount[] {
  const dir = resolveStateDir()
  const accounts: PaperAccount[] = []
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("state-") && f.endsWith(".json"))
    for (const f of files) {
      try {
        const state = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"))
        const wallet = f.replace(/^state-/, "").replace(/\.json$/, "")
        accounts.push({
          wallet,
          equity: state.account?.totalEquity ?? 0,
          pnl: state.account?.allTimePnl ?? 0,
          positions: state.positions?.length ?? 0,
          activityCount: state.activity?.length ?? 0,
          agentStatus: state.agent?.status ?? "unknown",
          lastActive: state.agent?.lastScanAt ?? "",
        })
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // no state dir yet
  }
  return accounts
}

function readFeedback(): { at: string; page: string; wallet: string; message: string }[] {
  const logDir = process.env.TRADING_STATE_DIR || path.join(process.cwd(), ".data", "support")
  const file = path.join(logDir, "issues.jsonl")
  const items: { at: string; page: string; wallet: string; message: string }[] = []
  try {
    const lines = fs.readFileSync(file, "utf-8").split("\n").filter(Boolean)
    for (const line of lines) {
      try {
        const j = JSON.parse(line)
        items.push({ at: j.at, page: j.page, wallet: j.wallet, message: j.message })
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // no feedback yet
  }
  return items
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { component: "admin-analytics" })
  if (!auth.address) {
    return auth.error ?? NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const paperAccounts = readPaperAccounts()
  const feedback = readFeedback()

  // Database stats — optional, best effort
  let dbStats: { authUsers?: number; payments?: number; tradingAccounts?: number } = {}
  try {
    const { prisma } = await import("@/lib/prisma")
    const [users, payments, trading] = await Promise.all([
      prisma.authUser.count().catch(() => 0),
      prisma.payment.count().catch(() => 0),
      prisma.tradingAccount.count().catch(() => 0),
    ])
    dbStats = { authUsers: users, payments, tradingAccounts: trading }
  } catch {
    // DB unavailable — file-based stats only
  }

  const activeTraders = paperAccounts.filter((a) => a.activityCount > 1).length

  return NextResponse.json({
    totals: {
      paperAccounts: paperAccounts.length,
      activeTraders,
      feedbackCount: feedback.length,
      dbUsers: dbStats.authUsers ?? null,
      dbPayments: dbStats.payments ?? null,
      dbTradingAccounts: dbStats.tradingAccounts ?? null,
    },
    paperAccounts,
    feedback: feedback.slice(0, 50),
    dbStats,
  })
}
