/**
 * Live track record — shared aggregation.
 *
 * Used by:
 *   - GET /api/trading/track-record (public JSON endpoint)
 *   - /live-track-record page (server component, called directly — no self-fetch)
 *   - MCP get_track_record tool
 *
 * Privacy: wallet addresses are never exposed unless the account owner
 * explicitly opts in (TradingAccount.public_track_record) — then the entry
 * carries an on-chain verification link. Otherwise identity stays a short
 * stable hash so the same account keeps the same label across requests.
 */

export interface TrackRecordAccount {
  id: string
  name: string
  budgetUsd: number
  realizedPnl: number
  tradeCount: number
  startedAt: string
  lastActiveAt: string
  /** True when the owner opted in to sharing the address for verification. */
  verifiable: boolean
  /** Hyperliquid explorer link, only for opted-in accounts. */
  explorerUrl: string | null
}

export interface TrackRecord {
  liveAccountCount: number
  totalRealizedPnl: number
  totalBudget: number
  accounts: TrackRecordAccount[]
  disclaimer: string
}

/** FNV-1a short hash — stable, non-reversible, no address leakage. */
export function anonymizeWallet(walletAddress: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < walletAddress.length; i++) {
    h ^= walletAddress.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return "acct-" + h.toString(16).padStart(8, "0").slice(0, 8)
}

const DISCLAIMER =
  "Live accounts are real funds traded by the Protocol Bank agent on Hyperliquid. Past performance is not a guarantee of future results."

/**
 * Aggregate live-account performance.
 * Throws when the database is unreachable (callers decide how to surface it).
 * Never hangs: the query is raced against a 5s deadline.
 */
export async function getLiveTrackRecord(): Promise<TrackRecord> {
  const { prisma } = await import("@/lib/prisma")

  const accounts = await Promise.race([
    prisma.tradingAccount.findMany({
      where: { status: "live" },
      select: {
        wallet_address: true,
        agent_name: true,
        budget_usd: true,
        public_track_record: true,
        created_at: true,
        updated_at: true,
        trades: {
          where: { mode: "live", status: "closed" },
          select: { pnl: true, opened_at: true },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("track-record query timed out")), 5_000),
    ),
  ])

  const entries: TrackRecordAccount[] = accounts.map((a) => {
    const closed = a.trades ?? []
    const realizedPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const firstTradeAt = closed.length
      ? closed.reduce((min, t) => (t.opened_at < min ? t.opened_at : min), closed[0].opened_at)
      : null
    return {
      id: anonymizeWallet(a.wallet_address),
      name: a.agent_name ?? "Agent",
      budgetUsd: Math.round((a.budget_usd ?? 0) * 100) / 100,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
      tradeCount: closed.length,
      startedAt: (firstTradeAt ?? a.created_at).toISOString(),
      lastActiveAt: a.updated_at.toISOString(),
      verifiable: a.public_track_record === true,
      explorerUrl: a.public_track_record
        ? `https://app.hyperliquid.xyz/explorer/address/${a.wallet_address}`
        : null,
    }
  })

  return {
    liveAccountCount: entries.length,
    totalRealizedPnl: Math.round(entries.reduce((s, e) => s + e.realizedPnl, 0) * 100) / 100,
    totalBudget: Math.round(entries.reduce((s, e) => s + e.budgetUsd, 0) * 100) / 100,
    accounts: entries,
    disclaimer: DISCLAIMER,
  }
}
