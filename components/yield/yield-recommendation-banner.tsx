/**
 * Yield Recommendation Banner Component
 *
 * 根据当前 APY 推荐最优网络
 * 符合项目的 Glass Morphism 设计风格
 */

"use client"

import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Lightbulb, TrendingUp, ArrowRight, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

export interface RecommendationData {
  network: string
  protocol: string
  apy: number
  reason: string
}

interface YieldRecommendationBannerProps {
  data: RecommendationData
  loading?: boolean
  onDeposit?: () => void
  dismissible?: boolean
  className?: string
}

// 网络颜色映射
const NETWORK_COLORS: Record<string, string> = {
  ethereum: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
  base: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
  arbitrum: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
  tron: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-600 dark:text-red-400",
}

// 网络展示名称
const NETWORK_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  tron: "TRON",
  "tron-nile": "TRON Nile",
}

export function YieldRecommendationBanner({
  data,
  loading = false,
  onDeposit,
  dismissible = true,
  className,
}: YieldRecommendationBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const networkGradient = NETWORK_COLORS[data.network] || NETWORK_COLORS.ethereum
  const networkName = NETWORK_NAMES[data.network] || data.network

  if (loading) {
    return (
      <GlassCard className={cn("bg-gradient-to-r", className)}>
        <GlassCardContent className="py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </GlassCardContent>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      className={cn(
        "relative overflow-hidden",
        "bg-gradient-to-r",
        networkGradient,
        "border backdrop-blur-md",
        "hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
        "transition-all duration-300",
        className
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-current to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-current to-transparent rounded-full blur-2xl" />
      </div>

      <GlassCardContent className="relative py-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div
              className={cn(
                "p-2.5 rounded-full",
                "bg-white/80 dark:bg-slate-900/80",
                "border-2 border-current",
                "shadow-lg"
              )}
            >
              <Lightbulb className="h-5 w-5" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Best Yield Opportunity</h3>
              <Badge
                variant="outline"
                className={cn(
                  "backdrop-blur-sm font-semibold",
                  "bg-white/50 dark:bg-slate-900/50",
                  "border-current"
                )}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {data.apy.toFixed(2)}% APY
              </Badge>
            </div>

            <p className="text-sm">
              Earn the highest yield on{" "}
              <span className="font-semibold">{networkName}</span>{" "}
              via{" "}
              <span className="font-semibold">{data.protocol}</span>
              {" "}protocol
            </p>

            {/* Reason */}
            <div className="flex items-start gap-1.5 text-xs opacity-90">
              <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{data.reason}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onDeposit && (
              <Button
                size="sm"
                onClick={onDeposit}
                className={cn(
                  "backdrop-blur-sm font-medium shadow-lg",
                  "bg-white/90 dark:bg-slate-900/90",
                  "hover:bg-white dark:hover:bg-slate-900",
                  "border-current"
                )}
              >
                Deposit Now
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}

            {dismissible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className={cn(
                  "h-8 w-8 rounded-full",
                  "hover:bg-white/50 dark:hover:bg-slate-900/50"
                )}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            )}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

// 骨架屏加载状态
export function YieldRecommendationBannerSkeleton({ className }: { className?: string }) {
  return (
    <GlassCard className={cn("bg-gradient-to-r from-muted/50 to-muted/20", className)}>
      <GlassCardContent className="py-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-28 flex-shrink-0" />
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}
