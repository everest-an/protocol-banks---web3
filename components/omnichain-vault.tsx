"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bitcoin,
  RefreshCw,
  Copy,
  ExternalLink,
  Loader2,
  ArrowDownUp,
} from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { ZetaChainService, type OmnichainBalance } from "@/lib/zetachain"
import { toast } from "sonner"

// 链图标组件
const ChainIcon = ({ chain }: { chain: string }) => {
  const icons: Record<string, React.ReactNode> = {
    ETH: (
      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
        E
      </div>
    ),
    BTC: <Bitcoin className="w-6 h-6 text-orange-500" />,
    BNB: (
      <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">
        B
      </div>
    ),
    SOL: (
      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
        S
      </div>
    ),
    MATIC: (
      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
        M
      </div>
    ),
    ZETA: (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
        Z
      </div>
    ),
  }
  return (
    icons[chain] || (
      <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold">
        ?
      </div>
    )
  )
}

export function OmnichainVault() {
  const { address, isConnected } = useWeb3()
  const { translateTerm } = useUserType()

  const [balances, setBalances] = useState<OmnichainBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("balances")

  // Swap 状态
  const [fromChain, setFromChain] = useState("ETH")
  const [toChain, setToChain] = useState("BTC")
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapQuote, setSwapQuote] = useState<{
    rate: string
    priceImpact: string
    fee: string
    estimatedTime: number
  } | null>(null)

  // BTC 存款
  const [btcDepositAddress, setBtcDepositAddress] = useState("")
  const [btcDepositMemo, setBtcDepositMemo] = useState("")

  // 跨链交易追踪
  const [pendingTxs, setPendingTxs] = useState<
    Array<{
      hash: string
      status: string
      progress: number
      from: string
      to: string
      amount: string
    }>
  >([])

  const zetaService = new ZetaChainService("mainnet")

  // 获取全链余额
  const fetchBalances = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    try {
      const omnichainBalances = await zetaService.getOmnichainBalances(address)
      setBalances(omnichainBalances)
    } catch (error) {
      console.error("Failed to fetch omnichain balances:", error)
      toast.error("Failed to fetch balances")
    } finally {
      setIsLoading(false)
    }
  }, [address])

  // 获取 BTC 存款信息
  const fetchBTCDepositInfo = useCallback(async () => {
    if (!address) return

    const depositAddr = await zetaService.getBTCDepositAddress(address)
    const memo = zetaService.getBTCDepositMemo(address)

    setBtcDepositAddress(depositAddr)
    setBtcDepositMemo(memo)
  }, [address])

  // 获取 Swap 报价
  const fetchSwapQuote = useCallback(async () => {
    if (!fromAmount || Number.parseFloat(fromAmount) <= 0) {
      setSwapQuote(null)
      setToAmount("")
      return
    }

    try {
      const quote = await zetaService.getSwapQuote(fromChain, toChain, fromAmount)
      setSwapQuote({
        rate: quote.rate,
        priceImpact: quote.priceImpact,
        fee: quote.fee,
        estimatedTime: zetaService["estimateCrossChainTime"](
          fromChain === "BTC" ? "bitcoin" : 1,
          toChain === "BTC" ? "bitcoin" : 1,
        ),
      })
      setToAmount(quote.outputAmount)
    } catch (error) {
      console.error("Failed to get swap quote:", error)
    }
  }, [fromAmount, fromChain, toChain])

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances()
      fetchBTCDepositInfo()
    }
  }, [isConnected, address, fetchBalances, fetchBTCDepositInfo])

  useEffect(() => {
    const debounce = setTimeout(fetchSwapQuote, 500)
    return () => clearTimeout(debounce)
  }, [fetchSwapQuote])

  // 执行跨链 Swap
  const handleSwap = async () => {
    if (!address || !fromAmount) return

    setIsSwapping(true)
    try {
      const result = await zetaService.crossChainSwap({
        fromChain: fromChain === "BTC" ? "bitcoin" : 1,
        toChain: toChain === "BTC" ? "bitcoin" : 1,
        fromToken: fromChain,
        toToken: toChain,
        amount: fromAmount,
        recipient: address,
      })

      if (result.success) {
        toast.success("Swap initiated! Tracking cross-chain transaction...")

        // 添加到待处理交易列表
        if (result.cctxHash) {
          setPendingTxs((prev) => [
            ...prev,
            {
              hash: result.cctxHash!,
              status: "pending",
              progress: 10,
              from: fromChain,
              to: toChain,
              amount: fromAmount,
            },
          ])
        }

        // 清空输入
        setFromAmount("")
        setToAmount("")
        setSwapQuote(null)
      } else {
        toast.error(result.error || "Swap failed")
      }
    } catch (error) {
      toast.error("Swap failed")
    } finally {
      setIsSwapping(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  // 交换 from/to
  const swapDirection = () => {
    setFromChain(toChain)
    setToChain(fromChain)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  // 计算总资产
  const totalBalance = balances.reduce((sum, b) => sum + Number.parseFloat(b.balanceUSD), 0)

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{translateTerm("connectWallet")} to view your omnichain assets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 总资产卡片 */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {translateTerm("omnichainVault")}
          </CardTitle>
          <CardDescription>Manage all your assets across chains from a single interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold">${totalBalance.toLocaleString()}</span>
            <span className="text-muted-foreground mb-1">USD Total</span>
            <Button variant="ghost" size="sm" onClick={fetchBalances} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex gap-2 mt-4">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              ZetaChain Connected
            </Badge>
            <Badge variant="outline" className="gap-1">
              {balances.length} Assets
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="swap">Cross-Chain Swap</TabsTrigger>
          <TabsTrigger value="btc">BTC Deposit</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* 余额标签页 */}
        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Chain Balances</CardTitle>
              <CardDescription>Your assets across all supported chains via ZRC-20</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : balances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No assets found. Deposit assets to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {balances.map((balance, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChainIcon chain={balance.symbol} />
                        <div>
                          <p className="font-medium">{balance.symbol}</p>
                          <p className="text-sm text-muted-foreground">{balance.chain}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{Number.parseFloat(balance.balance).toFixed(6)}</p>
                        <p className="text-sm text-muted-foreground">${balance.balanceUSD}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 跨链 Swap 标签页 */}
        <TabsContent value="swap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Cross-Chain Swap
              </CardTitle>
              <CardDescription>Swap assets between any chains. Powered by ZetaChain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* From */}
              <div className="space-y-2">
                <Label>From</Label>
                <div className="flex gap-2">
                  <Select value={fromChain} onValueChange={setFromChain}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETH">ETH</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="BNB">BNB</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="SOL">SOL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center">
                <Button variant="outline" size="icon" onClick={swapDirection}>
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </div>

              {/* To */}
              <div className="space-y-2">
                <Label>To</Label>
                <div className="flex gap-2">
                  <Select value={toChain} onValueChange={setToChain}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETH">ETH</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="BNB">BNB</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="SOL">SOL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="0.0" value={toAmount} readOnly className="flex-1 bg-muted" />
                </div>
              </div>

              {/* Quote Details */}
              {swapQuote && (
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span>Rate:</span>
                      <span>
                        1 {fromChain} = {swapQuote.rate} {toChain}
                      </span>
                      <span>Price Impact:</span>
                      <span className={Number.parseFloat(swapQuote.priceImpact) > 1 ? "text-red-500" : ""}>
                        {swapQuote.priceImpact}%
                      </span>
                      <span>Fee:</span>
                      <span>{swapQuote.fee}%</span>
                      <span>Est. Time:</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />~{Math.round(swapQuote.estimatedTime / 60)} min
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleSwap}
                disabled={!fromAmount || isSwapping || fromChain === toChain}
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Swap {fromChain} to {toChain}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BTC 存款标签页 */}
        <TabsContent value="btc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bitcoin className="h-5 w-5 text-orange-500" />
                Native BTC Deposit
              </CardTitle>
              <CardDescription>Send BTC directly from any Bitcoin wallet. No bridges needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Send BTC to the address below with your EVM address in the OP_RETURN memo. Your BTC will be bridged to
                  ZetaChain as ZRC-20 BTC.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>BTC Deposit Address (TSS)</Label>
                <div className="flex gap-2">
                  <Input value={btcDepositAddress} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(btcDepositAddress, "BTC Address")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Required Memo (OP_RETURN)</Label>
                <div className="flex gap-2">
                  <Input value={btcDepositMemo} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(btcDepositMemo, "Memo")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is your EVM address. Include it in the OP_RETURN of your BTC transaction.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">How it works:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Send BTC to the TSS address above</li>
                  <li>Include your EVM address in OP_RETURN memo</li>
                  <li>Wait ~30 minutes for 6 confirmations</li>
                  <li>Receive ZRC-20 BTC on ZetaChain</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 历史记录标签页 */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cross-Chain Transactions</CardTitle>
              <CardDescription>Track your pending and completed cross-chain transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTxs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No cross-chain transactions yet</div>
              ) : (
                <div className="space-y-4">
                  {pendingTxs.map((tx, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChainIcon chain={tx.from} />
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <ChainIcon chain={tx.to} />
                        </div>
                        <Badge variant={tx.status === "completed" ? "default" : "secondary"}>{tx.status}</Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Amount: </span>
                        {tx.amount} {tx.from}
                      </div>
                      <Progress value={tx.progress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress: {tx.progress}%</span>
                        <Button variant="link" size="sm" className="h-auto p-0">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View on Explorer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
