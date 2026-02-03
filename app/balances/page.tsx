"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check
} from "lucide-react"
import { useBalance } from "@/hooks/use-balance"
import { BalanceDistribution } from "@/components/balance-distribution"
import { UsageChart } from "@/components/usage-chart"

// Chain logos mapping
const chainLogos: Record<string, string> = {
  ethereum: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  polygon: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  arbitrum: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
  optimism: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg",
  base: "https://www.base.org/favicon.ico",
}

// Chain colors
const chainColors: Record<string, string> = {
  ethereum: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  polygon: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  arbitrum: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  optimism: "bg-red-500/10 text-red-500 border-red-500/30",
  base: "bg-blue-600/10 text-blue-600 border-blue-600/30",
}

export default function BalancesPage() {
  const { isConnected, wallet, connectWallet } = useWeb3()
  const { isDemoMode, setWalletConnected } = useDemo()
  const { balance, loading } = useBalance({ isDemoMode, walletAddress: wallet || undefined })
  const [hideBalance, setHideBalance] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    setWalletConnected(isConnected)
  }, [isConnected, setWalletConnected])

  const displayBalance = hideBalance 
    ? "••••••" 
    : (balance?.totalUSD ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">
        
        {/* Header with Total Balance */}
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
          </div>
          
          <div className="flex gap-2">
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

        {/* Total Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <h2 className="text-4xl sm:text-5xl font-bold font-mono tracking-tight">
                  ${displayBalance}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">+2.4%</span>
                    <span className="text-muted-foreground">24h</span>
                  </Badge>
                </div>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="chains">By Chain</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balance History</CardTitle>
                <CardDescription>Your total balance over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <UsageChart 
                  data={[
                    { date: "2024-01-01", requests: 15000, revenue: 1200 },
                    { date: "2024-01-08", requests: 18000, revenue: 1500 },
                    { date: "2024-01-15", requests: 16500, revenue: 1350 },
                    { date: "2024-01-22", requests: 21000, revenue: 1800 },
                    { date: "2024-01-29", requests: 19500, revenue: 1650 },
                  ]}
                  title="Balance History"
                />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <ArrowDownLeft className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Received (30d)</p>
                      <p className="text-lg font-semibold">$12,450</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <ArrowUpRight className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sent (30d)</p>
                      <p className="text-lg font-semibold">$8,320</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <RefreshCw className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Swapped (30d)</p>
                      <p className="text-lg font-semibold">$3,100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Change</p>
                      <p className="text-lg font-semibold text-green-500">+$4,130</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Token Balances</CardTitle>
                <CardDescription>Your tokens across all chains</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Demo tokens */}
                {[
                  { symbol: "ETH", name: "Ethereum", balance: "2.5", usd: 8125, change: 2.1, chain: "ethereum" },
                  { symbol: "USDC", name: "USD Coin", balance: "5,000", usd: 5000, change: 0, chain: "polygon" },
                  { symbol: "USDT", name: "Tether", balance: "3,200", usd: 3200, change: 0, chain: "arbitrum" },
                  { symbol: "MATIC", name: "Polygon", balance: "1,500", usd: 1350, change: -1.2, chain: "polygon" },
                ].map((token) => (
                  <div key={token.symbol} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${chainColors[token.chain] || 'bg-muted'}`}>
                        <span className="font-semibold text-sm">{token.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">{hideBalance ? "••••" : token.balance}</p>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-muted-foreground">
                          ${hideBalance ? "••••" : token.usd.toLocaleString()}
                        </span>
                        {token.change !== 0 && (
                          <span className={`text-xs ${token.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {token.change > 0 ? '+' : ''}{token.change}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chains" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {(balance?.chainDistribution || [
                { chain: "Ethereum", chainId: 1, totalUSD: 8125, percentage: 46, tokenCount: 3 },
                { chain: "Polygon", chainId: 137, totalUSD: 6350, percentage: 36, tokenCount: 2 },
                { chain: "Arbitrum", chainId: 42161, totalUSD: 3200, percentage: 18, tokenCount: 1 },
              ]).map((chain) => (
                <Card key={chain.chain} className="overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${chainColors[chain.chain.toLowerCase()] || 'bg-muted'}`}>
                          <span className="font-semibold text-sm">{chain.chain.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{chain.chain}</p>
                          <p className="text-xs text-muted-foreground">{chain.percentage}% of portfolio</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">
                          ${hideBalance ? "••••" : chain.totalUSD.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${chainColors[chain.chain.toLowerCase()]?.split(' ')[0] || 'bg-primary'}`}
                        style={{ width: `${chain.percentage}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
