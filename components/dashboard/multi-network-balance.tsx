"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useWeb3 } from "@/contexts/web3-context"
import { ALL_NETWORKS, NETWORK_TOKENS, type NetworkConfig } from "@/lib/networks"

interface NetworkBalance {
  network: string
  networkConfig: NetworkConfig
  tokens: {
    symbol: string
    balance: string
    usdValue: number
  }[]
  totalUSD: number
}

export function MultiNetworkBalance() {
  const { wallets, usdtBalance, usdcBalance, daiBalance, activeChain } = useWeb3()
  const [networkFilter, setNetworkFilter] = useState<"all" | "evm" | "tron">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [balances, setBalances] = useState<NetworkBalance[]>([])

  useEffect(() => {
    loadBalances()
  }, [wallets, usdtBalance, usdcBalance, daiBalance])

  async function loadBalances() {
    setIsLoading(true)
    const results: NetworkBalance[] = []

    // EVM networks
    if (wallets.EVM) {
      const evmNetworks = ["ethereum", "arbitrum", "base"]
      for (const networkId of evmNetworks) {
        const networkConfig = ALL_NETWORKS[networkId]
        const tokens = NETWORK_TOKENS[networkId] || []

        const tokenBalances = tokens.map((token) => {
          let balance = "0"
          // 这里简化处理，实际应该按网络查询
          if (token.symbol === "USDT") balance = usdtBalance
          if (token.symbol === "USDC") balance = usdcBalance
          if (token.symbol === "DAI") balance = daiBalance

          return {
            symbol: token.symbol,
            balance,
            usdValue: parseFloat(balance) || 0,
          }
        })

        const totalUSD = tokenBalances.reduce((sum, t) => sum + t.usdValue, 0)

        results.push({
          network: networkId,
          networkConfig,
          tokens: tokenBalances,
          totalUSD,
        })
      }
    }

    // TRON network
    if (wallets.TRON) {
      const networkConfig = ALL_NETWORKS["tron"]
      const tokens = NETWORK_TOKENS["tron"] || []

      const tokenBalances = tokens.map((token) => {
        let balance = "0"
        if (token.symbol === "USDT" && activeChain === "TRON") {
          balance = usdtBalance
        }

        return {
          symbol: token.symbol,
          balance,
          usdValue: parseFloat(balance) || 0,
        }
      })

      const totalUSD = tokenBalances.reduce((sum, t) => sum + t.usdValue, 0)

      results.push({
        network: "tron",
        networkConfig,
        tokens: tokenBalances,
        totalUSD,
      })
    }

    setBalances(results)
    setIsLoading(false)
  }

  const filteredBalances = balances.filter((b) => {
    if (networkFilter === "all") return true
    if (networkFilter === "evm") return b.networkConfig.type === "EVM"
    if (networkFilter === "tron") return b.networkConfig.type === "TRON"
    return true
  })

  const totalBalance = filteredBalances.reduce((sum, b) => sum + b.totalUSD, 0)

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Total Balance</h2>
          <p className="text-muted-foreground">Across all networks</p>
        </div>
        <Select value={networkFilter} onValueChange={(v) => setNetworkFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter networks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            <SelectItem value="evm">EVM Only</SelectItem>
            <SelectItem value="tron">TRON Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Total balance card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-5xl font-bold">
            ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </CardTitle>
          <CardDescription>
            {filteredBalances.length} network{filteredBalances.length !== 1 ? "s" : ""} connected
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Network breakdown */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
          </>
        ) : (
          filteredBalances.map((networkBalance) => (
            <NetworkBalanceCard key={networkBalance.network} {...networkBalance} />
          ))
        )}
      </div>

      {/* Empty state */}
      {!isLoading && filteredBalances.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No wallets connected for the selected filter</p>
        </Card>
      )}
    </div>
  )
}

function NetworkBalanceCard({ network, networkConfig, tokens, totalUSD }: NetworkBalance) {
  const percentage = tokens.length > 0 ? ((totalUSD / tokens.reduce((sum, t) => sum + t.usdValue, 0)) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{networkConfig.name}</CardTitle>
          <Badge variant={networkConfig.type === "EVM" ? "default" : "secondary"}>
            {networkConfig.type}
          </Badge>
        </div>
        <CardDescription className="text-2xl font-bold">
          ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tokens.map((token) => (
            <div key={token.symbol} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{token.symbol}</span>
              <span className="font-medium">
                {parseFloat(token.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
            </div>
          ))}
          {tokens.length === 0 && (
            <p className="text-sm text-muted-foreground">No tokens</p>
          )}
        </div>
        <div className="mt-4">
          <a
            href={networkConfig.blockExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            View on Explorer →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
