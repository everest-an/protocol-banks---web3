// rls:system — cron route: no wallet request context. Enumerates approved
// live accounts and advances the trading agent for each; the agent itself
// scopes every write to its owner wallet.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronAuth } from '@/lib/cron-auth'
import { resolveAgentForWallet } from '@/lib/trading/agent'

// Vercel Cron: keeps approved LIVE accounts ticking 24/7 while nobody has the
// dashboard open. Same engine as the tick-on-demand API path; the agent
// throttles internally (15s) and persists its own state to the DB.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_ACCOUNTS_PER_RUN = 10
const TIME_BUDGET_MS = 45_000

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()

  // Fair rotation: least-recently-updated first, so every account gets a turn
  // as more go live than fit in one run.
  const accounts = await prisma.tradingAccount.findMany({
    where: { agent_approved: true, status: 'live' },
    select: { wallet_address: true },
    orderBy: { updated_at: 'asc' },
    take: MAX_ACCOUNTS_PER_RUN,
  })

  const results: Array<{ wallet: string; ok: boolean; error?: string }> = []

  for (const account of accounts) {
    const wallet = account.wallet_address
    try {
      const agent = await resolveAgentForWallet(wallet)

      // Hydrate from the database before ticking — a fresh serverless instance
      // must never trade against an empty ledger. Mirrors the guard used by
      // /api/trading/overview (mode check prevents a stale paper ledger from
      // overwriting a promoted live one).
      const { loadStateFromDb } = await import('@/lib/trading/db-store')
      const dbState = await loadStateFromDb(wallet)
      const expectedMode = agent.isLive() ? 'live' : 'paper'
      if (dbState && dbState.mode === expectedMode && dbState.activity && dbState.activity.length > 0) {
        agent.hydrateState(dbState)
      }

      await agent.maybeTick()
      results.push({ wallet: `${wallet.slice(0, 10)}…`, ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[cron/trading-agent] tick failed for ${wallet.slice(0, 10)}…:`, message)
      results.push({ wallet: `${wallet.slice(0, 10)}…`, ok: false, error: message.slice(0, 160) })
    }

    if (Date.now() - startedAt > TIME_BUDGET_MS) break
  }

  return NextResponse.json({
    ok: true,
    liveAccounts: accounts.length,
    ticked: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    tookMs: Date.now() - startedAt,
  })
}
