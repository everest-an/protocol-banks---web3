"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Coins,
  Globe,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useBalance } from "@/hooks/use-balance"
import { BalanceDistribution } from "@/components/balance-distribution"
import type { TokenBalance } from "@/types"

// Token colors for charts and icons
const TOKEN_COLORS: Record<string, string> = {
  USDC: "#2775CA",
  USDT: "#26A17B",
  DAI: "#F5AC37",
  ETH: "#627EEA",
  WETH: "#627EEA",
  WBTC: "#F09242",
  BTC: "#F7931A",
  MATIC: "#8247E5",
  BNB: "#F0B90B",
  OP: "#FF0420",
  ARB: "#28A0F0",
  HSK: "#2D6AE0",
}

const FALLBACK_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"]

// Chain colors for badges and cards
const CHAIN_BADGE_COLORS: Record<string, string> = {
  Ethereum: "bg-[#627EEA]/15 text-[#627EEA] border-[#627EEA]/30",
  Polygon: "bg-[#8247E5]/15 text-[#8247E5] border-[#8247E5]/30",
  Arbitrum: "bg-[#28A0F0]/15 text-[#28A0F0] border-[#28A0F0]/30",
  Base: "bg-[#0052FF]/15 text-[#0052FF] border-[#0052FF]/30",
  Optimism: "bg-[#FF0420]/15 text-[#FF0420] border-[#FF0420]/30",
  "BNB Chain": "bg-[#F0B90B]/15 text-[#F0B90B] border-[#F0B90B]/30",
  "HashKey Chain": "bg-[#2D6AE0]/15 text-[#2D6AE0] border-[#2D6AE0]/30",
}

const CHAIN_BAR_COLORS: Record<string, string> = {
  Ethereum: "bg-[#627EEA]",
  Polygon: "bg-[#8247E5]",
  Arbitrum: "bg-[#28A0F0]",
  Base: "bg-[#0052FF]",
  Optimism: "bg-[#FF0420]",
  "BNB Chain": "bg-[#F0B90B]",
  "HashKey Chain": "bg-[#2D6AE0]",
}

// Explorer URLs per chain
const EXPLORER_URLS: Record<string, string> = {
  Ethereum: "https://etherscan.io",
  Polygon: "https://polygonscan.com",
  Arbitrum: "https://arbiscan.io",
  Base: "https://basescan.org",
  Optimism: "https://optimistic.etherscan.io",
  "BNB Chain": "https://bscscan.com",
  "HashKey Chain": "https://hashkeyscan.io",
}

const STABLECOINS = ["USDC", "USDT", "DAI"]

// Group tokens by symbol for drill-down view
interface TokenGroup {
  symbol: string
  totalUSD: number
  totalBalance: number
  price: number
  percentage: number
  entries: TokenBalance[] // per-chain entries
}

export default function BalancesPage() {
  const { isConnected, wallet, connectWallet } = useWeb3()
  const { isDemoMode, setWalletConnected } = useDemo()
  const { balance, loading, error, refresh } = useBalance({ isDemoMode, walletAddress: wallet || undefined })
  const [hideBalance, setHideBalance] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set())

  useEffect(() => {
    setWalletConnected(isConnected)
  }, [isConnected, setWalletConnected])

  // Build grouped token data (L2 → L3 drill-down)
  const tokenGroups = useMemo<TokenGroup[]>(() => {
    if (!balance?.tokens || balance.tokens.length === 0) return []

    const groups: Record<string, { totalUSD: number; totalBalance: number; price: number; entries: TokenBalance[] }> = {}
    for (const t of balance.tokens) {
      if (!groups[t.token]) {
        groups[t.token] = { totalUSD: 0, totalBalance: 0, price: t.price, entries: [] }
      }
      groups[t.token].totalUSD += t.balanceUSD
      groups[t.token].totalBalance += parseFloat(t.balance)
      groups[t.token].entries.push(t)
    }

    const totalUSD = balance.totalUSD || 1
    return Object.entries(groups)
      .map(([symbol, data]) => ({
        symbol,
        totalUSD: data.totalUSD,
        totalBalance: data.totalBalance,
        price: data.price,
        percentage: (data.totalUSD / totalUSD) * 100,
        entries: data.entries.sort((a, b) => b.balanceUSD - a.balanceUSD),
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD)
  }, [balance?.tokens, balance?.totalUSD])

  const displayBalance = hideBalance
    ? "••••••"
    : (balance?.totalUSD ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTokenAmount = (balance: string, token: string) => {
    const val = parseFloat(balance)
    if (["ETH", "WETH", "WBTC", "BTC", "MATIC", "BNB", "HSK"].includes(token)) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    }
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatUSD = (value: number, decimals = 2) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const getTokenExplorerUrl = (chain: string, contractAddress?: string) => {
    const base = EXPLORER_URLS[chain]
    if (!base || !contractAddress) return null
    return `${base}/token/${contractAddress}`
  }

  const toggleTokenExpand = (symbol: string) => {
    setExpandedTokens((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
      } else {
        next.add(symbol)
      }
      return next
    })
  }

  const stablecoinTotal = balance?.tokenDistribution
    ?.filter((t) => STABLECOINS.includes(t.token))
    .reduce((s, t) => s + t.totalUSD, 0) ?? 0

  const volatileTotal = balance?.tokenDistribution
    ?.filter((t) => !STABLECOINS.includes(t.token))
    .reduce((s, t) => s + t.totalUSD, 0) ?? 0

  // ─── Not Connected ───
  if (!isConnected && !isDemoMode) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="container mx-auto py-12 px-4">
          <Card className="max-w-md mx-auto border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Connect your wallet to view your balances across all chains.
              </p>
              <Button onClick={() => connectWallet()}>
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ─── Loading State ───
  if (loading && !balance?.tokens.length) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="container mx-auto py-6 px-4 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-10 w-72" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-3 w-14 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Empty State (Connected but no balance) ───
  const hasBalance = balance && balance.totalUSD > 0

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">

        {/* ══════════ L1: Header & Total Balance ══════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Balances</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setHideBalance(!hideBalance)}
              >
                {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {wallet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{formatAddress(wallet)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyAddress}
                >
                  {copiedAddress ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
            {balance?.lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(balance.lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/receive">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                Receive
              </Button>
            </Link>
            <Link href="/pay">
              <Button size="sm" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Send
              </Button>
            </Link>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <span>Failed to load some balances: {error}</span>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-red-400 hover:text-red-300">
              Retry
            </Button>
          </div>
        )}

        {/* L1: Total Balance Card (大字报) */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span className="font-mono">${displayBalance}</span>
                </h2>
              </div>

              {balance?.chainDistribution && balance.chainDistribution.length > 0 && (
                <BalanceDistribution
                  distribution={balance.chainDistribution}
                  totalUSD={balance.totalUSD}
                  className="sm:max-w-xs"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══════════ Empty State: Add Funds CTA ══════════ */}
        {!hasBalance && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Add Funds to Get Started</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Your wallet has no token balances yet. Receive stablecoins or other tokens to see your portfolio here.
              </p>
              <div className="flex gap-3">
                <Link href="/receive">
                  <Button className="gap-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    Receive Tokens
                  </Button>
                </Link>
                <Link href="/swap">
                  <Button variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Swap
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════ Tabs (only when there is balance) ══════════ */}
        {hasBalance && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="chains">By Chain</TabsTrigger>
            </TabsList>

            {/* ══════════ Overview Tab: L2 Portfolio Allocation ══════════ */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Portfolio Allocation</CardTitle>
                  <CardDescription>Token distribution by USD value</CardDescription>
                </CardHeader>
                <CardContent>
                  {balance?.tokenDistribution && balance.tokenDistribution.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                      {/* Donut Chart */}
                      <div className="w-[250px] h-[250px] flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={balance.tokenDistribution.map((t) => ({
                                name: t.token,
                                value: t.totalUSD,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={105}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {balance.tokenDistribution.map((t, idx) => (
                                <Cell
                                  key={t.token}
                                  fill={TOKEN_COLORS[t.token] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [
                                `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                                "Value",
                              ]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                color: "hsl(var(--foreground))",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div className="flex-1 space-y-3 w-full">
                        {balance.tokenDistribution.map((t) => (
                          <div key={t.token} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: TOKEN_COLORS[t.token] || "#888" }}
                              />
                              <span className="font-medium text-sm">{t.token}</span>
                              <div className="flex gap-1">
                                {t.chains.map((chain) => (
                                  <span
                                    key={chain}
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CHAIN_BADGE_COLORS[chain] || 'bg-muted text-muted-foreground border-border'}`}
                                  >
                                    {chain}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {hideBalance ? "****" : `$${formatUSD(t.totalUSD, 0)}`}
                              </span>
                              <span className="text-xs text-muted-foreground w-12 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {t.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                      <Coins className="h-10 w-10 mb-3 opacity-50" />
                      <p>No token data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Coins className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tokens</p>
                        <p className="text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {balance?.tokenDistribution?.length ?? 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Globe className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Networks</p>
                        <p className="text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {balance?.chainDistribution?.length ?? 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Stablecoins</p>
                        <p className="text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {hideBalance ? "****" : `$${formatUSD(stablecoinTotal, 0)}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-orange-500/10">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Volatile Assets</p>
                        <p className="text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {hideBalance ? "****" : `$${formatUSD(volatileTotal, 0)}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ══════════ Tokens Tab: L2 → L3 Drill-Down ══════════ */}
            <TabsContent value="tokens" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Token Balances</CardTitle>
                  <CardDescription>Click a token to see its distribution across chains</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {tokenGroups.length > 0 ? (
                    tokenGroups.map((group) => {
                      const isExpanded = expandedTokens.has(group.symbol)
                      const isMultiChain = group.entries.length > 1

                      return (
                        <div key={group.symbol}>
                          {/* L2: Token Row (Aggregate) */}
                          <button
                            onClick={() => isMultiChain && toggleTokenExpand(group.symbol)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isExpanded ? 'bg-muted/50 border-border' : 'hover:bg-muted/30 border-transparent'
                            } ${isMultiChain ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Token Icon */}
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${TOKEN_COLORS[group.symbol] || '#888'}20` }}
                              >
                                <span
                                  className="font-bold text-xs"
                                  style={{ color: TOKEN_COLORS[group.symbol] || '#888' }}
                                >
                                  {group.symbol}
                                </span>
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{group.symbol}</span>
                                  {/* Chain Badges */}
                                  <div className="hidden sm:flex gap-1">
                                    {group.entries.map((entry) => (
                                      <span
                                        key={entry.chain}
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CHAIN_BADGE_COLORS[entry.chain] || 'bg-muted text-muted-foreground border-border'}`}
                                      >
                                        {entry.chain}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {group.entries.length} chain{group.entries.length !== 1 ? "s" : ""}
                                  {" · "}
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                    ${formatUSD(group.price, 2)}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {hideBalance ? "****" : formatTokenAmount(group.totalBalance.toString(), group.symbol)}
                                </p>
                                <p className="text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                                  ${hideBalance ? "****" : formatUSD(group.totalUSD)}
                                </p>
                              </div>
                              {/* Percentage badge */}
                              <Badge variant="secondary" className="text-xs min-w-[50px] justify-center" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {group.percentage.toFixed(1)}%
                              </Badge>
                              {/* Expand arrow */}
                              {isMultiChain && (
                                <div className="w-4">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                              {!isMultiChain && <div className="w-4" />}
                            </div>
                          </button>

                          {/* L3: Per-Chain Breakdown (Expanded) */}
                          {isExpanded && (
                            <div className="ml-[52px] mt-1 mb-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                              {group.entries.map((entry, idx) => {
                                const entryPercentage = group.totalUSD > 0
                                  ? (entry.balanceUSD / group.totalUSD) * 100
                                  : 0
                                return (
                                  <div
                                    key={`${entry.chain}-${idx}`}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-2 h-2 rounded-full ${CHAIN_BAR_COLORS[entry.chain] || 'bg-muted-foreground'}`} />
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${CHAIN_BADGE_COLORS[entry.chain] || 'bg-muted border-border'}`}>
                                        {entry.chain}
                                      </span>
                                      {entry.contractAddress && (
                                        <a
                                          href={getTokenExplorerUrl(entry.chain, entry.contractAddress) ?? "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {hideBalance ? "****" : formatTokenAmount(entry.balance, entry.token)}
                                      </span>
                                      <span className="text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        ${hideBalance ? "****" : formatUSD(entry.balanceUSD)}
                                      </span>
                                      {/* Intra-token percentage bar */}
                                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${CHAIN_BAR_COLORS[entry.chain] || 'bg-primary'}`}
                                          style={{ width: `${entryPercentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Coins className="h-10 w-10 mb-3 opacity-50" />
                      <p className="font-medium">No tokens found</p>
                      <p className="text-xs mt-1 mb-4">No token balances detected in the connected wallet</p>
                      <Link href="/receive">
                        <Button variant="outline" size="sm" className="gap-2">
                          <ArrowDownLeft className="h-4 w-4" />
                          Add Funds
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══════════ Chains Tab: L3 Network Breakdown ══════════ */}
            <TabsContent value="chains" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {balance?.chainDistribution && balance.chainDistribution.length > 0 ? (
                  balance.chainDistribution.map((chain) => (
                    <Card key={chain.chain} className="overflow-hidden">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${CHAIN_BADGE_COLORS[chain.chain]?.split(' ')[0] || 'bg-muted'}`}
                            >
                              <span className="font-semibold text-sm">{chain.chain.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{chain.chain}</p>
                              <p className="text-xs text-muted-foreground">
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{chain.percentage.toFixed(1)}%</span>
                                {" of portfolio · "}
                                {chain.tokenCount} token{chain.tokenCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                              ${hideBalance ? "****" : formatUSD(chain.totalUSD, 0)}
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${CHAIN_BAR_COLORS[chain.chain] || 'bg-primary'}`}
                            style={{ width: `${chain.percentage}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Globe className="h-10 w-10 mb-3 opacity-50" />
                    <p className="font-medium">No chain data available</p>
                    <p className="text-xs mt-1">No balances detected on any chain</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
