import type { Metadata } from "next"
import Link from "next/link"
import { TrendingUp, TrendingDown, Shield, Activity, Bot } from "lucide-react"

export const metadata: Metadata = {
  title: "Live Track Record - Protocol Bank",
  description:
    "Real, anonymized performance of live Protocol Bank AI trading accounts on Hyperliquid. See budgets, realized PnL, and trade counts — updated in real time.",
}

/**
 * /live-track-record — the public trust asset.
 *
 * Shows aggregated, anonymized live-account performance straight from the
 * production database. When no live accounts exist yet, it honestly says so
 * and points to paper mode instead.
 */

interface AccountEntry {
  id: string
  name: string
  budgetUsd: number
  realizedPnl: number
  tradeCount: number
  startedAt: string
  lastActiveAt: string
}

interface TrackRecord {
  liveAccountCount: number
  totalRealizedPnl: number
  totalBudget: number
  accounts: AccountEntry[]
  disclaimer?: string
  error?: string
}

async function getTrackRecord(): Promise<TrackRecord> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ""
  try {
    const res = await fetch(`${base}/api/trading/track-record`, {
      next: { revalidate: 60 },
      cache: "no-store",
    })
    if (!res.ok) return { liveAccountCount: 0, totalRealizedPnl: 0, totalBudget: 0, accounts: [] }
    return await res.json()
  } catch {
    return { liveAccountCount: 0, totalRealizedPnl: 0, totalBudget: 0, accounts: [] }
  }
}

const fmtUsd = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function LiveTrackRecordPage() {
  const data = await getTrackRecord()
  const hasAccounts = data.liveAccountCount > 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-4xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Protocol Bank
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-4 tracking-tight">
          Live Track Record
        </h1>
        <p className="text-muted-foreground mb-2">Last updated: {new Date().toISOString().slice(0, 10)}</p>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Real, anonymized performance of live Protocol Bank accounts — real funds, real Hyperliquid markets, the same
          agent you can run yourself. Addresses are never exposed.
        </p>

        {hasAccounts ? (
          <>
            {/* Aggregate summary */}
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                <p className="text-sm text-muted-foreground mb-1">Live accounts</p>
                <p className="text-3xl font-bold">{data.liveAccountCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                <p className="text-sm text-muted-foreground mb-1">Total budget</p>
                <p className="text-3xl font-bold">{fmtUsd(data.totalBudget)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                <p className="text-sm text-muted-foreground mb-1">Total realized PnL</p>
                <p className={`text-3xl font-bold ${data.totalRealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {data.totalRealizedPnl >= 0 ? "+" : ""}
                  {fmtUsd(data.totalRealizedPnl)}
                </p>
              </div>
            </div>

            {/* Per-account table */}
            <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 overflow-hidden mb-8">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-white/10">
                <span>Account</span>
                <span className="text-right">Budget</span>
                <span className="text-right">Trades</span>
                <span className="text-right">Realized PnL</span>
              </div>
              {data.accounts.map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 text-sm border-b border-white/5 last:border-0 items-center"
                >
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      {a.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{a.id}</p>
                  </div>
                  <span className="text-right font-mono">{fmtUsd(a.budgetUsd)}</span>
                  <span className="text-right font-mono">{a.tradeCount}</span>
                  <span className={`text-right font-mono ${a.realizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {a.realizedPnl >= 0 ? "+" : ""}
                    {fmtUsd(a.realizedPnl)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Honest empty state — the trust asset grows as live users join */
          <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-8 text-center mb-8">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No live accounts yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Live mode just opened — the first accounts and their real PnL will appear here automatically. Watch the
              agent trade real markets risk-free in paper mode meanwhile.
            </p>
            <div className="mt-6">
              <Link
                href="/trading"
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <TrendingUp className="h-4 w-4" />
                Try Paper Trading
              </Link>
            </div>
          </div>
        )}

        {/* Trust reinforcement */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
            <Shield className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Anonymized by design</h3>
            <p className="text-sm text-muted-foreground">
              Account identities are short hashes — no wallet addresses are ever shown. The AI can trade but never
              withdraw, so a live account&apos;s worst case is the budget its owner chose.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
            <TrendingDown className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Losses shown too</h3>
            <p className="text-sm text-muted-foreground">
              This page never cherry-picks. Every live account appears with its full realized PnL — wins and losses —
              because that&apos;s the only honest proof.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{data.disclaimer}</p>
      </div>
    </div>
  )
}
