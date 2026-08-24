"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Users, Activity, MessageSquareWarning, Wallet, Database } from "lucide-react"

export const dynamic = "force-dynamic"

interface AnalyticsResponse {
  totals: {
    paperAccounts: number
    activeTraders: number
    feedbackCount: number
    dbUsers: number | null
    dbPayments: number | null
    dbTradingAccounts: number | null
  }
  paperAccounts: {
    wallet: string
    equity: number
    pnl: number
    positions: number
    activityCount: number
    agentStatus: string
    lastActive: string
  }[]
  feedback: { at: string; page: string; wallet: string; message: string }[]
}

export default function AdminAnalyticsPage() {
  const { address, isConnected } = useUnifiedWallet()
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) return
    ;(async () => {
      try {
        const res = await fetch("/api/admin/analytics", { headers: authHeaders(address) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics")
      }
    })()
  }, [isConnected, address])

  if (!isConnected) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Connect your wallet to view admin analytics.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const t = data.totals

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Users, usage, and feedback</p>
        </div>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Admin dashboard
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Paper Accounts</p>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums">{t.paperAccounts}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.activeTraders} actively trading</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquareWarning className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">User Feedback</p>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums">{t.feedbackCount}</p>
            <p className="text-xs text-muted-foreground mt-1">emailed to support inbox</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">DB Users</p>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums">{t.dbUsers ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t.dbPayments != null ? `${t.dbPayments} payments · ${t.dbTradingAccounts} trading accounts` : "DB unavailable"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Feedback Dest</p>
            </div>
            <p className="text-lg font-bold font-mono truncate">e@awareness.market</p>
            <p className="text-xs text-muted-foreground mt-1">configurable via SUPPORT_EMAIL</p>
          </CardContent>
        </Card>
      </div>

      {/* Paper accounts table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Paper Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {data.paperAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No paper accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Wallet</th>
                    <th className="py-2 pr-3 font-medium">Equity</th>
                    <th className="py-2 pr-3 font-medium">PnL</th>
                    <th className="py-2 pr-3 font-medium">Positions</th>
                    <th className="py-2 pr-3 font-medium">Activity</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paperAccounts.map((a) => (
                    <tr key={a.wallet} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {a.wallet.startsWith("0x") ? `${a.wallet.slice(0, 8)}…${a.wallet.slice(-6)}` : "guest demo"}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">${a.equity.toFixed(2)}</td>
                      <td className={`py-2 pr-3 font-mono tabular-nums ${a.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {a.pnl >= 0 ? "+" : ""}
                        {a.pnl.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums">{a.positions}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums">{a.activityCount}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={a.agentStatus === "running" ? "secondary" : "outline"} className="text-[10px] h-4 px-1.5">
                          {a.agentStatus}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {a.lastActive ? new Date(a.lastActive).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">User Feedback (latest 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No feedback yet.</p>
          ) : (
            <div className="space-y-2">
              {data.feedback.map((f, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-white/10 p-3">
                  <MessageSquareWarning className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{f.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.page} · {f.wallet.startsWith("0x") ? `${f.wallet.slice(0, 6)}…${f.wallet.slice(-4)}` : f.wallet} ·{" "}
                      {new Date(f.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
