import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/trading/track-record
 *
 * PUBLIC live track record — aggregated, anonymized proof of how the agent
 * is performing on real funds. This is the trust asset: anyone can see
 * real live accounts, their budgets, and realized PnL.
 *
 * Privacy rules:
 * - Never exposes wallet/agent addresses or keys.
 * - Account identity is a short stable hash.
 * - Only aggregates realized (closed-trade) PnL and trade counts.
 */
export const GET = async () => {
  try {
    const accounts = await prisma.tradingAccount.findMany({
      where: { status: "live" },
      select: {
        wallet_address: true,
        agent_name: true,
        budget_usd: true,
        created_at: true,
        updated_at: true,
        trades: {
          where: { mode: "live", status: "closed" },
          select: { pnl: true, opened_at: true },
        },
      },
      orderBy: { created_at: "desc" },
    })

    // Anonymize: stable short hash of the wallet address (FNV-1a, 8 hex chars).
    const shortHash = (s: string) => {
      let h = 0x811c9dc5
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return "acct-" + h.toString(16).padStart(8, "0").slice(0, 8)
    }

    const entries = accounts.map((a) => {
      const closed = a.trades ?? []
      const realizedPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      const firstTradeAt = closed.length
        ? closed.reduce((min, t) => (t.opened_at < min ? t.opened_at : min), closed[0].opened_at)
        : null
      return {
        id: shortHash(a.wallet_address),
        name: a.agent_name ?? "Agent",
        budgetUsd: Math.round((a.budget_usd ?? 0) * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        tradeCount: closed.length,
        startedAt: firstTradeAt ?? a.created_at,
        lastActiveAt: a.updated_at,
      }
    })

    const totalRealizedPnl = Math.round(entries.reduce((s, e) => s + e.realizedPnl, 0) * 100) / 100
    const totalBudget = Math.round(entries.reduce((s, e) => s + e.budgetUsd, 0) * 100) / 100

    return NextResponse.json({
      liveAccountCount: entries.length,
      totalRealizedPnl,
      totalBudget,
      accounts: entries,
      disclaimer:
        "Live accounts are real funds traded by the Protocol Bank agent on Hyperliquid. Past performance is not a guarantee of future results.",
    })
  } catch (error) {
    console.error("[track-record] Failed to aggregate live accounts:", error)
    return NextResponse.json({ error: "Could not load track record" }, { status: 500 })
  }
}
