/**
 * Yield Balance Card Component
 *
 * 展示商户在特定网络的收益余额
 * 符合项目的 Glass Morphism 设计风格
 */

"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle, GlassCardAction } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Sparkles, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export interface YieldBalanceData {
  network: string
  networkType: "EVM" | "TRON"
  protocol: "Aave V3" | "JustLend"
  principal: string
  interest: string
  totalBalance: string
  apy: number
}

interface YieldBalanceCardProps {
  data: YieldBalanceData
  loading?: boolean
  onDeposit?: () => void
  onWithdraw?: () => void
  className?: string
}

// 网络图标颜色映射
const NETWORK_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  base: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  arbitrum: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  tron: "bg-red-500/10 text-red-500 border-red-500/20",
  "tron-nile": "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

// 网络展示名称
const NETWORK_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  tron: "TRON",
  "tron-nile": "TRON Nile",
}

export function YieldBalanceCard({
  data,
  loading = false,
  onDeposit,
  onWithdraw,
  className,
}: YieldBalanceCardProps) {
  const networkColor = NETWORK_COLORS[data.network] || NETWORK_COLORS.ethereum
  const networkName = NETWORK_NAMES[data.network] || data.network

  // 计算利息占比
  const principal = parseFloat(data.principal)
  const interest = parseFloat(data.interest)
  const interestPercentage = principal > 0 ? (interest / principal) * 100 : 0

  // 判断是否有收益
  const hasEarnings = interest > 0

  if (loading) {
    return (
      <GlassCard className={className}>
        <GlassCardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </GlassCardContent>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      className={cn(
        "bg-gradient-to-br from-white/80 via-white/70 to-white/60",
        "dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/60",
        "hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        "transition-all duration-300",
        className
      )}
    >
      <GlassCardHeader className="pb-3 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GlassCardTitle className="text-base">{networkName}</GlassCardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium backdrop-blur-sm",
                networkColor
              )}
            >
              {data.protocol}
            </Badge>
          </div>

          {/* APY Badge */}
          <div className="flex items-center gap-1.5">
            {hasEarnings ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-sm font-semibold font-mono",
                hasEarnings ? "text-green-500" : "text-muted-foreground"
              )}
            >
              {data.apy.toFixed(2)}%
            </span>
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4 pt-4">
        {/* Total Balance */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total Balance</span>
            {hasEarnings && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Sparkles className="h-3 w-3" />
                <span className="font-medium">+{interestPercentage.toFixed(2)}%</span>
              </div>
            )}
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight">
            ${parseFloat(data.totalBalance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        {/* Principal & Interest */}
        <div className="grid grid-cols-2 gap-3">
          {/* Principal */}
          <div
            className={cn(
              "space-y-1.5 p-3 rounded-lg",
              "bg-white/50 dark:bg-slate-800/50",
              "border border-white/20 dark:border-white/10"
            )}
          >
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-blue-500/10 dark:bg-blue-500/20">
                <ArrowUpRight className="h-3 w-3 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Principal</span>
            </div>
            <div className="text-lg font-semibold font-mono">
              ${parseFloat(data.principal).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* Interest */}
          <div
            className={cn(
              "space-y-1.5 p-3 rounded-lg",
              hasEarnings
                ? "bg-green-50/60 dark:bg-green-950/60 border-green-500/20 dark:border-green-500/30"
                : "bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-white/10",
              "border"
            )}
          >
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "p-1 rounded",
                  hasEarnings
                    ? "bg-green-500/10 dark:bg-green-500/20"
                    : "bg-muted/50"
                )}
              >
                <ArrowDownLeft
                  className={cn(
                    "h-3 w-3",
                    hasEarnings ? "text-green-500" : "text-muted-foreground"
                  )}
                />
              </div>
              <span className="text-xs text-muted-foreground">Interest</span>
            </div>
            <div
              className={cn(
                "text-lg font-semibold font-mono",
                hasEarnings && "text-green-600 dark:text-green-400"
              )}
            >
              ${parseFloat(data.interest).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDeposit}
            className={cn(
              "backdrop-blur-sm bg-white/50 dark:bg-slate-800/50",
              "hover:bg-white/70 dark:hover:bg-slate-800/70",
              "border-white/20 dark:border-white/10"
            )}
          >
            <ArrowUpRight className="h-4 w-4 mr-1.5" />
            Deposit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onWithdraw}
            disabled={parseFloat(data.totalBalance) === 0}
            className={cn(
              "backdrop-blur-sm bg-white/50 dark:bg-slate-800/50",
              "hover:bg-white/70 dark:hover:bg-slate-800/70",
              "border-white/20 dark:border-white/10",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowDownLeft className="h-4 w-4 mr-1.5" />
            Withdraw
          </Button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

// 骨架屏加载状态
export function YieldBalanceCardSkeleton({ className }: { className?: string }) {
  return (
    <GlassCard className={className}>
      <GlassCardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}
