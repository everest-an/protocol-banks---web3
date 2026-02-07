/**
 * Yield Dashboard Page
 *
 * 展示商户在所有网络的收益余额和统计信息
 * 符合项目的 Glass Morphism 设计风格
 */

"use client"

import { useEffect, useState } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  YieldBalanceCard,
  YieldBalanceCardSkeleton,
  YieldSummaryCard,
  YieldSummaryCardSkeleton,
  YieldRecommendationBanner,
  YieldRecommendationBannerSkeleton,
} from "@/components/yield"
import { EmptyState } from "@/components/dashboard"
import { PiggyBank, RefreshCw, ExternalLink, Info } from "lucide-react"
import Link from "next/link"

export default function YieldPage() {
  const { isConnected, address: wallet } = useUnifiedWallet()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [recommendation, setRecommendation] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [refreshing, setRefreshing] = useState(false)

  // 获取收益数据
  useEffect(() => {
    if (!isConnected || !wallet) {
      setLoading(false)
      return
    }

    fetchYieldData()
  }, [isConnected, wallet])

  const fetchYieldData = async () => {
    if (!wallet) return

    setLoading(true)
    try {
      // 获取跨网络汇总
      const summaryRes = await fetch(`/api/yield/balance?merchant=${wallet}&summary=true`)
      const summaryData = await summaryRes.json()

      if (summaryData.success) {
        setSummary(summaryData.data)
      }

      // 获取推荐网络
      const recRes = await fetch("/api/yield/recommendation")
      const recData = await recRes.json()

      if (recData.success) {
        setRecommendation(recData.data.recommendation)
      }
    } catch (error) {
      console.error("Failed to fetch yield data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchYieldData()
    setRefreshing(false)
  }

  // 未连接钱包状态
  if (!isConnected) {
    return (
      <div className="container mx-auto py-6 px-4">
        <GlassCard>
          <GlassCardContent className="py-12">
            <EmptyState
              icon={PiggyBank}
              title="Connect your wallet"
              description="Connect your wallet to view and manage your yield earnings across multiple networks"
            />
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  // 加载状态
  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted/30 rounded animate-pulse" />
          </div>
        </div>

        {/* Recommendation Skeleton */}
        <YieldRecommendationBannerSkeleton />

        {/* Summary Skeleton */}
        <YieldSummaryCardSkeleton />

        {/* Balance Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <YieldBalanceCardSkeleton />
          <YieldBalanceCardSkeleton />
          <YieldBalanceCardSkeleton />
        </div>
      </div>
    )
  }

  // 无余额状态
  if (!summary || summary.balances.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Yield Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Earn interest on your idle funds across multiple networks
            </p>
          </div>
        </div>

        {/* Recommendation */}
        {recommendation && (
          <YieldRecommendationBanner
            data={recommendation}
            onDeposit={() => {
              // TODO: Open deposit modal
              console.log("Open deposit modal for", recommendation.network)
            }}
          />
        )}

        {/* Empty State */}
        <GlassCard>
          <GlassCardContent className="py-12">
            <EmptyState
              icon={PiggyBank}
              title="No yield deposits yet"
              description="Start earning interest by depositing USDT into Aave or JustLend protocols"
              action={
                <Link href="/pay">
                  <Button>
                    <PiggyBank className="h-4 w-4 mr-2" />
                    Make Your First Deposit
                  </Button>
                </Link>
              }
            />
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  // 过滤余额
  const filteredBalances =
    activeTab === "all"
      ? summary.balances
      : summary.balances.filter((b: any) => b.networkType === activeTab)

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Yield Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your yield earnings across {summary.balances.length}{" "}
            {summary.balances.length === 1 ? "network" : "networks"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="backdrop-blur-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recommendation Banner */}
      {recommendation && (
        <YieldRecommendationBanner
          data={recommendation}
          onDeposit={() => {
            console.log("Open deposit modal for", recommendation.network)
          }}
        />
      )}

      {/* Summary Card */}
      <YieldSummaryCard
        data={{
          totalPrincipal: summary.totalPrincipal,
          totalInterest: summary.totalInterest,
          totalBalance: summary.totalBalance,
          averageAPY: summary.averageAPY,
          networksCount: summary.balances.length,
        }}
      />

      {/* Network Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="backdrop-blur-sm bg-white/50 dark:bg-slate-800/50">
          <TabsTrigger value="all">
            All Networks ({summary.balances.length})
          </TabsTrigger>
          <TabsTrigger value="EVM">
            EVM ({summary.balances.filter((b: any) => b.networkType === "EVM").length})
          </TabsTrigger>
          <TabsTrigger value="TRON">
            TRON ({summary.balances.filter((b: any) => b.networkType === "TRON").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Balance Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBalances.map((balance: any) => (
              <YieldBalanceCard
                key={balance.network}
                data={balance}
                onDeposit={() => {
                  console.log("Deposit to", balance.network)
                }}
                onWithdraw={() => {
                  console.log("Withdraw from", balance.network)
                }}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <GlassCard variant="info" size="sm">
        <GlassCardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 mt-0.5">
              <Info className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">How Yield Works</p>
              <p className="text-xs text-muted-foreground">
                Your deposited USDT earns interest automatically through battle-tested DeFi protocols.
                Interest compounds in real-time and can be withdrawn anytime along with your principal.
                Platform charges a 5% fee only on earned interest, not on your principal.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Link
                  href="/docs/yield"
                  className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
                >
                  Learn more
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}
