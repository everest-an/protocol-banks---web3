/**
 * Yield Summary Card Component
 *
 * 展示跨网络的收益汇总
 * 包含总余额、总利息、平均 APY 等关键指标
 */

"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, Sparkles, Coins, Zap, PiggyBank } from "lucide-react"
import { cn } from "@/lib/utils"

export interface YieldSummaryData {
  totalPrincipal: string
  totalInterest: string
  totalBalance: string
  averageAPY: number
  networksCount: number
}

interface YieldSummaryCardProps {
  data: YieldSummaryData
  loading?: boolean
  className?: string
}

export function YieldSummaryCard({
  data,
  loading = false,
  className,
}: YieldSummaryCardProps) {
  // 计算利息率
  const principal = parseFloat(data.totalPrincipal)
  const interest = parseFloat(data.totalInterest)
  const interestRate = principal > 0 ? (interest / principal) * 100 : 0

  if (loading) {
    return (
      <GlassCard
        variant="primary"
        className={cn(
          "bg-gradient-to-br from-primary/10 via-background to-background",
          className
        )}
      >
        <GlassCardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-48" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </GlassCardContent>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      variant="primary"
      className={cn(
        "bg-gradient-to-br from-primary/10 via-background to-background",
        "hover:shadow-[0_12px_48px_rgba(0,0,0,0.12)]",
        "transition-all duration-300",
        className
      )}
    >
      <GlassCardContent className="pt-6 space-y-6">
        {/* Total Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Yield Balance</span>
            </div>
            {data.networksCount > 0 && (
              <Badge
                variant="outline"
                className="backdrop-blur-sm bg-primary/5 border-primary/20 text-primary"
              >
                {data.networksCount} {data.networksCount === 1 ? "Network" : "Networks"}
              </Badge>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl sm:text-5xl font-bold font-mono tracking-tight">
              ${parseFloat(data.totalBalance).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
            {interest > 0 && (
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  +{interestRate.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Principal */}
          <div
            className={cn(
              "space-y-2 p-4 rounded-xl",
              "bg-white/50 dark:bg-slate-800/50",
              "border border-white/20 dark:border-white/10",
              "backdrop-blur-sm"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-500/10 dark:bg-blue-500/20">
                <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Principal</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-bold font-mono">
                ${parseFloat(data.totalPrincipal).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground">Your deposits</p>
            </div>
          </div>

          {/* Interest */}
          <div
            className={cn(
              "space-y-2 p-4 rounded-xl",
              interest > 0
                ? "bg-green-50/60 dark:bg-green-950/60 border-green-500/20 dark:border-green-500/30"
                : "bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-white/10",
              "border backdrop-blur-sm"
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded",
                  interest > 0
                    ? "bg-green-500/10 dark:bg-green-500/20"
                    : "bg-muted/50"
                )}
              >
                <Coins
                  className={cn(
                    "h-3.5 w-3.5",
                    interest > 0 ? "text-green-500" : "text-muted-foreground"
                  )}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Interest Earned</span>
            </div>
            <div className="space-y-0.5">
              <div
                className={cn(
                  "text-2xl font-bold font-mono",
                  interest > 0 && "text-green-600 dark:text-green-400"
                )}
              >
                ${parseFloat(data.totalInterest).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground">Across all networks</p>
            </div>
          </div>

          {/* Average APY */}
          <div
            className={cn(
              "space-y-2 p-4 rounded-xl",
              "bg-gradient-to-br from-purple-50/60 to-pink-50/60",
              "dark:from-purple-950/60 dark:to-pink-950/60",
              "border border-purple-500/20 dark:border-purple-500/30",
              "backdrop-blur-sm"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-purple-500/10 dark:bg-purple-500/20">
                <Zap className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Average APY</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                {data.averageAPY.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">Weighted average</p>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        {interest > 0 && (
          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-lg",
              "bg-green-50/40 dark:bg-green-950/40",
              "border border-green-500/20"
            )}
          >
            <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                Your funds are earning interest across {data.networksCount}{" "}
                {data.networksCount === 1 ? "network" : "networks"}
              </p>
              <p className="text-xs text-muted-foreground">
                Interest compounds automatically and can be withdrawn anytime
              </p>
            </div>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}

// 骨架屏加载状态
export function YieldSummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <GlassCard
      variant="primary"
      className={cn(
        "bg-gradient-to-br from-primary/10 via-background to-background",
        className
      )}
    >
      <GlassCardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-16 w-full" />
      </GlassCardContent>
    </GlassCard>
  )
}
