"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Bot,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Wallet,
  PiggyBank,
  Pause,
  Play,
  OctagonX,
  Sparkles,
  Activity,
  Radar,
  AlertTriangle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { TradingLiveSetup } from "@/components/trading-live-setup"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"

// ---------------------------------------------------------------------------
// Types — the contract defined by /api/trading/overview
// ---------------------------------------------------------------------------

type AgentStatus = "running" | "paused" | "stopped"
type ActivityType = "open" | "close" | "scan" | "guard" | "info" | "error"

interface Position {
  symbol: string
  side: "long" | "short"
  size: number
  entry: number
  mark: number
  pnl: number
  pnlPct: number
  leverage: number
  reason: string
}

interface ActivityItem {
  time: string
  type: ActivityType
  text: string
  pnl: number | null
}

interface TradingOverview {
  mode: "paper" | "live"
  agent: {
    status: AgentStatus
    strategy: string
    lastScanAt: string
    marketsScanned: number
    confidenceHighSignals: number
  }
  account: {
    totalEquity: number
    mainWallet: number
    tradingWallet: number
    budget: number
    maxLoss: number
    todayPnl: number
    todayPnlPct: number
    allTimePnl: number
  }
  equity: { t: string; v: number }[]
  positions: Position[]
  activity: ActivityItem[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const fmtUsd = (v: number, digits = 2) =>
  v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

function timeAgo(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

const ACTIVITY_STYLE: Record<ActivityType, { icon: LucideIcon; cls: string }> = {
  open: { icon: ArrowUpRight, cls: "bg-blue-500/10 text-blue-500" },
  close: { icon: ArrowDownLeft, cls: "bg-emerald-500/10 text-emerald-500" },
  scan: { icon: Radar, cls: "bg-purple-500/10 text-purple-500" },
  guard: { icon: Shield, cls: "bg-amber-500/10 text-amber-500" },
  info: { icon: Sparkles, cls: "bg-primary/10 text-primary" },
  error: { icon: AlertTriangle, cls: "bg-red-500/10 text-red-500" },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TradingPage() {
  const { data, error, isLoading, mutate } = useSWR<TradingOverview>("/api/trading/overview", fetcher, {
    refreshInterval: 15_000, // live feel — refreshes every 15s
  })
  const { address: walletAddress } = useUnifiedWallet()
  const [range, setRange] = useState<7 | 30>(30)
  const { toast } = useToast()

  const curve = (data?.equity ?? []).slice(-range)
  const todayUp = (data?.account.todayPnl ?? 0) >= 0
  const agentStatus: AgentStatus = data?.agent.status ?? "running"

  const sendAction = async (action: "pause" | "resume" | "stop" | "reset") => {
    try {
      const res = await fetch("/api/trading/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Action failed (${res.status})`)
      await mutate()
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePause = async () => {
    const next = agentStatus === "running" ? "pause" : "resume"
    await sendAction(next)
    toast({
      title: next === "resume" ? "AI resumed" : "AI paused",
      description:
        next === "resume"
          ? "The agent is scanning markets again."
          : "No new trades will be opened. Existing positions are still managed.",
    })
  }

  const handleEmergencyStop = async () => {
    await sendAction("stop")
    toast({
      title: "Emergency stop engaged",
      description: "Trading halted. Revoke the agent wallet in Settings to fully cut off access.",
      variant: "destructive",
    })
  }

  const handleReset = async () => {
    await sendAction("reset")
    toast({
      title: "Paper account reset",
      description: "Simulated funds restored to $500. A fresh AI session has started.",
    })
  }

  const handleWithdraw = () => {
    toast({
      title: "Profit sweep",
      description:
        data?.mode === "paper"
          ? "Available after go-live. In paper mode this is a demo action."
          : "Moving available profits from your trading wallet to your main wallet.",
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 backdrop-blur-sm">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Trading</h1>
              <p className="text-sm text-muted-foreground">
                The agent trades for you. You stay in control of your funds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={data?.mode === "paper" ? "outline" : "secondary"} className="gap-1">
              <Sparkles className="h-3 w-3" />
              {data?.mode === "paper" ? "Paper Trading" : "Live"}
            </Badge>
            <Badge
              variant={agentStatus === "running" ? "secondary" : "destructive"}
              className="gap-1"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  agentStatus === "running"
                    ? "bg-emerald-500 animate-pulse"
                    : agentStatus === "paused"
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
              />
              {agentStatus === "running" ? "Agent running" : agentStatus === "paused" ? "Paused" : "Stopped"}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : error || !data ? (
          <GlassCard>
            <GlassCardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Could not load trading data. Please refresh the page.
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <>
            {/* Account summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <GlassCard variant="primary" className="bg-gradient-to-br from-primary/10 via-background to-background">
                <GlassCardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
                  <p className="text-3xl font-bold font-mono tracking-tight tabular-nums">
                    ${fmtUsd(data.account.totalEquity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Today{" "}
                    <span className={todayUp ? "text-emerald-500" : "text-red-500"}>
                      {todayUp ? "+" : "-"}${fmtUsd(Math.abs(data.account.todayPnl))}{" "}
                      ({todayUp ? "+" : "-"}
                      {fmtUsd(Math.abs(data.account.todayPnlPct))}%)
                    </span>
                  </p>
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardContent className="pt-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Main Wallet</p>
                  </div>
                  <p className="text-3xl font-bold font-mono tracking-tight tabular-nums">
                    ${fmtUsd(data.account.mainWallet)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">AI can never touch this</p>
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardContent className="pt-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Trading Wallet</p>
                  </div>
                  <p className="text-3xl font-bold font-mono tracking-tight tabular-nums">
                    ${fmtUsd(data.account.tradingWallet)}
                  </p>
                  <p className="text-xs text-amber-500/90 mt-1">
                    Max you can lose: ${fmtUsd(data.account.maxLoss)}
                  </p>
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardContent className="pt-5 flex flex-col justify-between h-full">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">All-time Profit</p>
                  </div>
                  <p
                    className={`text-3xl font-bold font-mono tracking-tight tabular-nums ${
                      data.account.allTimePnl >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {data.account.allTimePnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(data.account.allTimePnl))}
                  </p>
                  <Button size="sm" className="mt-2 w-full gap-1.5" onClick={handleWithdraw}>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Withdraw Profit
                  </Button>
                </GlassCardContent>
              </GlassCard>
            </div>

            {/* Equity curve */}
            <GlassCard>
              <GlassCardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <GlassCardTitle className="text-base">Equity Curve</GlassCardTitle>
                  </div>
                  <div className="flex gap-1">
                    {([7, 30] as const).map((r) => (
                      <Button
                        key={r}
                        variant={range === r ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setRange(r)}
                      >
                        {r === 7 ? "7D" : "30D"}
                      </Button>
                    ))}
                  </div>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curve} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                      <defs>
                        <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" strokeOpacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        domain={["dataMin - 10", "dataMax + 10"]}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v) => [`$${fmtUsd(Number(v))}`, "Equity"]}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#equityFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* AI activity feed + positions */}
            <div className="grid lg:grid-cols-5 gap-4">
              <GlassCard className="lg:col-span-3">
                <GlassCardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <GlassCardTitle className="text-base">What the AI is doing</GlassCardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {data.agent.strategy}
                    </span>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="space-y-1">
                    {data.activity.map((item, i) => {
                      const style = ACTIVITY_STYLE[item.type]
                      const Icon = style.icon
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${style.cls}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">{item.text}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.time)}</p>
                          </div>
                          {item.pnl !== null && (
                            <span
                              className={`text-sm font-mono tabular-nums shrink-0 ${
                                item.pnl >= 0 ? "text-emerald-500" : "text-red-500"
                              }`}
                            >
                              {item.pnl >= 0 ? "+" : ""}${fmtUsd(item.pnl)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </GlassCardContent>
              </GlassCard>

              <div className="lg:col-span-2 space-y-4">
                <GlassCard>
                  <GlassCardHeader className="pb-2">
                    <GlassCardTitle className="text-base">Open Positions</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    {data.positions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No open positions right now.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.positions.map((p) => {
                          const up = p.pnl >= 0
                          return (
                            <div
                              key={p.symbol}
                              className="rounded-xl border border-white/10 dark:border-white/5 p-3 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{p.symbol}</span>
                                  <Badge
                                    variant={p.side === "long" ? "secondary" : "destructive"}
                                    className="text-[10px] px-1.5 py-0 h-4"
                                  >
                                    {p.side === "long" ? "LONG" : "SHORT"} {p.leverage}x
                                  </Badge>
                                </div>
                                <span
                                  className={`text-sm font-mono font-semibold tabular-nums ${
                                    up ? "text-emerald-500" : "text-red-500"
                                  }`}
                                >
                                  {up ? "+" : ""}${fmtUsd(p.pnl)} ({up ? "+" : ""}
                                  {fmtUsd(p.pnlPct)}%)
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  Entry ${p.entry.toLocaleString()}
                                </span>
                                <span>Mark ${p.mark.toLocaleString()}</span>
                                <span>{p.size} {p.symbol}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground/70 mt-1.5 truncate">
                                {p.reason}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </GlassCardContent>
                </GlassCard>

                <GlassCard>
                  <GlassCardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Markets scanned</span>
                      <span className="font-mono tabular-nums">{data.agent.marketsScanned}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">High-confidence signals</span>
                      <span className="font-mono tabular-nums text-emerald-500">
                        {data.agent.confidenceHighSignals}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={handlePause}
                        disabled={agentStatus === "stopped"}
                      >
                        {agentStatus === "running" ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {agentStatus === "running" ? "Pause AI" : "Resume AI"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={handleEmergencyStop}
                        disabled={agentStatus === "stopped"}
                      >
                        <OctagonX className="h-3.5 w-3.5" />
                        Emergency Stop
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 text-center">
                      <Shield className="h-3 w-3 inline mr-1" />
                      The AI can trade, but it can never withdraw your funds. Revoke its access anytime.
                    </p>
                    {data?.mode === "paper" && (
                      <button
                        onClick={handleReset}
                        className="w-full text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        Reset paper account
                      </button>
                    )}
                  </GlassCardContent>
                </GlassCard>

                <TradingLiveSetup walletAddress={walletAddress} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
