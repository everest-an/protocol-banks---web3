"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ArrowDownUp,
  Clock,
  Fuel,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  ChevronRight,
  Shield,
  Search,
  X,
  AlertTriangle,
} from "lucide-react"
import {
  rangoService,
  SUPPORTED_CHAINS,
  POPULAR_TOKENS,
  type RangoRoute,
  type RangoAsset,
  type TokenInfo,
} from "@/lib/rango"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useDemo } from "@/contexts/demo-context"
import { toast } from "sonner"
import Image from "next/image"

interface CrossChainSwapProps {
  mode?: "full" | "compact"
  defaultFromChain?: string
  defaultToChain?: string
  recipientAddress?: string // For Web2 auto-detect
  onSwapComplete?: (tx: { hash: string; fromChain: string; toChain: string; amount: string }) => void
}

export function CrossChainSwap({
  mode = "full",
  defaultFromChain = "ETH",
  defaultToChain = "POLYGON",
  recipientAddress,
  onSwapComplete,
}: CrossChainSwapProps) {
  const { address, signer, isConnected } = useWeb3()
  const { isWeb2User, translateTerm } = useUserType()
  const { isDemoMode } = useDemo()

  // Chain & Token Selection
  const [fromChain, setFromChain] = useState<string>(defaultFromChain)
  const [toChain, setToChain] = useState<string>(defaultToChain)
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null)
  const [toToken, setToToken] = useState<TokenInfo | null>(null)

  // Amount
  const [inputAmount, setInputAmount] = useState("")
  const [balances, setBalances] = useState<Record<string, string>>({})

  // Routes
  const [routes, setRoutes] = useState<RangoRoute[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RangoRoute | null>(null)
  const [routeId, setRouteId] = useState<string>("")

  useEffect(() => {
    rangoService.setDemoMode(isDemoMode)
  }, [isDemoMode])
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)

  // UI State
  const [slippage, setSlippage] = useState(1.0)
  const [isSwapping, setIsSwapping] = useState(false)
  const [showRouteDetails, setShowRouteDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Token selector dialog
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState<"from" | "to" | null>(null)
  const [tokenSearch, setTokenSearch] = useState("")

  // Get chain info
  const fromChainInfo = useMemo(() => SUPPORTED_CHAINS.find((c) => c.id === fromChain), [fromChain])
  const toChainInfo = useMemo(() => SUPPORTED_CHAINS.find((c) => c.id === toChain), [toChain])

  // Get tokens for selected chains
  const fromTokens = useMemo(() => POPULAR_TOKENS[fromChain] || [], [fromChain])
  const toTokens = useMemo(() => POPULAR_TOKENS[toChain] || [], [toChain])

  // Filter tokens by search
  const filteredTokens = useMemo(() => {
    const tokens = tokenSelectorOpen === "from" ? fromTokens : toTokens
    if (!tokenSearch) return tokens
    const search = tokenSearch.toLowerCase()
    return tokens.filter((t) => t.symbol.toLowerCase().includes(search) || t.name.toLowerCase().includes(search))
  }, [tokenSelectorOpen, fromTokens, toTokens, tokenSearch])

  // Auto-detect destination for Web2 users
  useEffect(() => {
    if (isWeb2User && recipientAddress) {
      const detectedChain = rangoService.detectChainFromAddress(recipientAddress)
      if (detectedChain) {
        setToChain(detectedChain)
        const bestToken = rangoService.getBestStablecoin(detectedChain)
        if (bestToken) setToToken(bestToken)
      }
    }
  }, [isWeb2User, recipientAddress])

  // Set default tokens when chain changes
  useEffect(() => {
    if (fromTokens.length > 0 && !fromToken) {
      setFromToken(fromTokens[0])
    }
  }, [fromTokens, fromToken])

  useEffect(() => {
    if (toTokens.length > 0 && !toToken) {
      // Default to USDC if available
      const usdc = toTokens.find((t) => t.symbol === "USDC")
      setToToken(usdc || toTokens[0])
    }
  }, [toTokens, toToken])

  // Fetch routes when inputs change
  useEffect(() => {
    if (!inputAmount || Number.parseFloat(inputAmount) <= 0 || !fromToken || !toToken) {
      setRoutes([])
      setSelectedRoute(null)
      setError(null)
      return
    }

    const fetchRoutes = async () => {
      setIsLoadingRoutes(true)
      setError(null)

      try {
        const fromAsset: RangoAsset = {
          blockchain: fromChain,
          symbol: fromToken.symbol,
          address: fromToken.address,
        }
        const toAsset: RangoAsset = {
          blockchain: toChain,
          symbol: toToken.symbol,
          address: toToken.address,
        }

        const { routes: fetchedRoutes, routeId: fetchedRouteId } = await rangoService.getAllRoutes(
          fromAsset,
          toAsset,
          inputAmount,
          slippage,
        )

        setRoutes(fetchedRoutes)
        setRouteId(fetchedRouteId)

        // Auto-select best route
        if (fetchedRoutes.length > 0) {
          setSelectedRoute(fetchedRoutes[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get routes")
        setRoutes([])
      } finally {
        setIsLoadingRoutes(false)
      }
    }

    const timer = setTimeout(fetchRoutes, 500)
    return () => clearTimeout(timer)
  }, [inputAmount, fromChain, toChain, fromToken, toToken, slippage])

  // Swap chains
  const handleSwapChains = useCallback(() => {
    setFromChain(toChain)
    setToChain(fromChain)
    setFromToken(toToken)
    setToToken(fromToken)
    setInputAmount("")
    setRoutes([])
    setSelectedRoute(null)
  }, [fromChain, toChain, fromToken, toToken])

  // Execute swap
  const handleSwap = async () => {
    if (!signer || !selectedRoute || !address || !fromToken || !toToken) {
      toast.error("Please connect your wallet")
      return
    }

    setIsSwapping(true)
    try {
      // Confirm route
      const confirmResult = await rangoService.confirmRoute(selectedRoute.requestId, routeId)
      if (!confirmResult.success) {
        throw new Error(confirmResult.error || "Route confirmation failed")
      }

      // Create transaction
      const txResult = await rangoService.createTransaction(selectedRoute.requestId, routeId, {
        [fromChain]: address,
        [toChain]: address,
      })

      if (!txResult.success) {
        throw new Error(txResult.error || "Transaction creation failed")
      }

      toast.success(
        isWeb2User
          ? `Exchange initiated! Converting ${inputAmount} ${fromToken.symbol} to ${toToken.symbol}`
          : `Swap initiated! ${fromChain} → ${toChain}`,
      )

      onSwapComplete?.({
        hash: txResult.tx?.hash || selectedRoute.requestId,
        fromChain,
        toChain,
        amount: inputAmount,
      })

      // Reset form
      setInputAmount("")
      setRoutes([])
      setSelectedRoute(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Swap failed")
    } finally {
      setIsSwapping(false)
    }
  }

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${seconds}s`
    if (seconds < 3600) return `~${Math.floor(seconds / 60)}m`
    return `~${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  // Render chain selector
  const renderChainSelector = (value: string, onChange: (value: string) => void, label: string) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(() => {
              const chain = SUPPORTED_CHAINS.find((c) => c.id === value)
              return chain ? (
                <div className="flex items-center gap-2">
                  <Image
                    src={chain.logo || "/placeholder.svg"}
                    alt={chain.name}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <span>{chain.name}</span>
                </div>
              ) : (
                "Select Chain"
              )
            })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>EVM Chains</SelectLabel>
            {SUPPORTED_CHAINS.filter((c) => c.type === "EVM").map((chain) => (
              <SelectItem key={chain.id} value={chain.id}>
                <div className="flex items-center gap-2">
                  <Image
                    src={chain.logo || "/placeholder.svg"}
                    alt={chain.name}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <span>{chain.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Other Chains</SelectLabel>
            {SUPPORTED_CHAINS.filter((c) => c.type !== "EVM").map((chain) => (
              <SelectItem key={chain.id} value={chain.id}>
                <div className="flex items-center gap-2">
                  <Image
                    src={chain.logo || "/placeholder.svg"}
                    alt={chain.name}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <span>{chain.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )

  // Render token selector button
  const renderTokenButton = (token: TokenInfo | null, onClick: () => void, chainId: string) => (
    <Button variant="outline" className="h-12 px-3 gap-2 min-w-[120px] bg-transparent" onClick={onClick}>
      {token ? (
        <>
          <Image
            src={token.logo || `/placeholder.svg?height=32&width=32&query=${token.symbol}`}
            alt={token.symbol}
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="font-medium">{token.symbol}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Select Token</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Button>
  )

  // Visual route path diagram component
  const RoutePathDiagram = ({
    route,
    fromToken,
    toToken,
  }: { route: RangoRoute; fromToken: TokenInfo | null; toToken: TokenInfo | null }) => {
    return (
      <div className="flex items-center justify-between py-4">
        {/* From Token */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {fromToken?.logo ? (
              <Image
                src={fromToken.logo || "/placeholder.svg"}
                alt={fromToken.symbol}
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <span className="text-lg font-bold">{fromToken?.symbol?.charAt(0)}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-1 font-medium">{fromToken?.symbol}</span>
        </div>

        {/* Route Path with Bridges */}
        <div className="flex-1 mx-4 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />
          <div className="flex justify-center gap-3 relative">
            {route.swaps.map((swap, i) => (
              <div key={i} className="flex flex-col items-center bg-background px-3">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                  {swap.swapperLogo ? (
                    <Image
                      src={swap.swapperLogo || "/placeholder.svg"}
                      alt={swap.swapperId}
                      width={32}
                      height={32}
                      className="rounded"
                    />
                  ) : (
                    <span className="text-xs font-medium">{swap.swapperId.slice(0, 2)}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-1 max-w-[80px] truncate font-medium">
                  {swap.swapperId}
                </span>
                <span className="text-[10px] text-muted-foreground/60">{swap.swapperType || "Bridge"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* To Token */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {toToken?.logo ? (
              <Image
                src={toToken.logo || "/placeholder.svg"}
                alt={toToken.symbol}
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <span className="text-lg font-bold">{toToken?.symbol?.charAt(0)}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-1 font-medium">{toToken?.symbol}</span>
        </div>
      </div>
    )
  }

  const renderRouteCard = (route: RangoRoute, isSelected: boolean) => {
    const isBest = route.tags.some((t) => t.value === "RECOMMENDED")
    const isFastest = route.tags.some((t) => t.value === "FASTEST")
    const isLowestFee = route.tags.some((t) => t.value === "LOWEST_FEE")

    return (
      <button
        key={route.requestId}
        onClick={() => setSelectedRoute(route)}
        className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Fuel className="h-4 w-4" />${route.totalFeeUsd.toFixed(2)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatTime(route.estimatedTimeInSeconds)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/60">≡</span>
              {route.swaps.length} {route.swaps.length === 1 ? "step" : "steps"}
            </span>
          </div>
          <div className="flex gap-1.5">
            {isBest && <Badge className="bg-cyan-500/10 text-cyan-500 border-0 text-xs px-2 py-0.5">Recommended</Badge>}
            {isLowestFee && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0 text-xs px-2 py-0.5">Lowest Fee</Badge>
            )}
            {isFastest && (
              <Badge className="bg-orange-500/10 text-orange-500 border-0 text-xs px-2 py-0.5">Fastest</Badge>
            )}
          </div>
        </div>

        {/* Visual Route Path */}
        <RoutePathDiagram route={route} fromToken={fromToken} toToken={toToken} />

        <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Route Type:</span>
            <span className="font-medium text-foreground">
              {route.swaps.length === 1 ? "Direct Swap" : "Multi-hop Bridge"}
            </span>
          </div>
          {route.priceImpact > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Price Impact:</span>
              <span className={route.priceImpact > 1 ? "text-amber-500 font-medium" : "text-foreground"}>
                {route.priceImpact.toFixed(3)}%
              </span>
            </div>
          )}
        </div>

        {/* Output Amount */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border/50">
          <span className="text-xl font-semibold">{Number.parseFloat(route.outputAmount).toFixed(4)}</span>
          <span className="text-sm text-muted-foreground font-medium">{toToken?.symbol}</span>
          <span className="text-xs text-muted-foreground">~${route.outputAmountUsd.toFixed(2)}</span>
        </div>
      </button>
    )
  }

  // Test Mode Alert
  const renderTestModeAlert = () => (
    <Alert variant="warning" className="mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-amber-500 dark:text-amber-300">
        You are in test mode. Transactions will not be executed.
      </AlertDescription>
    </Alert>
  )

  // Web2 Simplified UI
  if (isWeb2User && mode === "full") {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {translateTerm("Cross-Chain Swap")}
          </CardTitle>
          <CardDescription>{translateTerm("Exchange currencies automatically at the best rate")}</CardDescription>
        </CardHeader>
        {renderTestModeAlert()}
        <CardContent className="space-y-6">
          {/* From Section */}
          <div className="space-y-3">
            <Label>{translateTerm("You Send")}</Label>
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex gap-2">
                {renderTokenButton(fromToken, () => setTokenSelectorOpen("from"), fromChain)}
                <Input
                  type="number"
                  placeholder="0.00"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="flex-1 text-xl h-12"
                />
              </div>
              <div className="text-xs text-muted-foreground">From: {fromChainInfo?.name || fromChain}</div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwapChains}
              className="rounded-full h-12 w-12 bg-transparent"
            >
              <ArrowDownUp className="h-5 w-5" />
            </Button>
          </div>

          {/* To Section */}
          <div className="space-y-3">
            <Label>{translateTerm("You Receive")}</Label>
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex gap-2">
                {renderTokenButton(toToken, () => setTokenSelectorOpen("to"), toChain)}
                <div className="flex-1 px-4 h-12 rounded-md bg-transparent border flex items-center justify-end text-xl font-medium">
                  {isLoadingRoutes ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : selectedRoute ? (
                    Number.parseFloat(selectedRoute.outputAmount).toFixed(6)
                  ) : (
                    <span className="text-muted-foreground">0.00</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">To: {toChainInfo?.name || toChain}</div>
            </div>
          </div>

          {/* Best Rate Info */}
          {selectedRoute && (
            <Alert className="bg-emerald-500/10 border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Best rate found! You save ~${(selectedRoute.outputAmountUsd * 0.02).toFixed(2)} compared to other
                options.
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Exchange Summary */}
          {selectedRoute && (
            <div className="p-4 rounded-lg bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span>
                  1 {fromToken?.symbol} ={" "}
                  {(Number.parseFloat(selectedRoute.outputAmount) / Number.parseFloat(inputAmount || "1")).toFixed(4)}{" "}
                  {toToken?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee</span>
                <span>${selectedRoute.totalFeeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Time</span>
                <span>{formatTime(selectedRoute.estimatedTimeInSeconds)}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            className="w-full h-12 text-lg"
            disabled={!selectedRoute || isSwapping || !isConnected}
            onClick={handleSwap}
          >
            {!isConnected ? (
              "Connect Account"
            ) : isSwapping ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : selectedRoute ? (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Confirm Exchange
              </>
            ) : (
              "Enter Amount"
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Web3 Professional UI
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Swap Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Cross-Chain Swap
          </CardTitle>
          <CardDescription>Swap tokens across any blockchain with best price routing</CardDescription>
        </CardHeader>
        {renderTestModeAlert()}
        <CardContent className="space-y-6">
          {/* From Section */}
          <div className="p-4 rounded-xl bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">From</span>
              {balances[`${fromChain}-${fromToken?.symbol}`] && (
                <button
                  onClick={() => setInputAmount(balances[`${fromChain}-${fromToken?.symbol}`])}
                  className="text-xs text-primary hover:underline"
                >
                  Balance: {Number.parseFloat(balances[`${fromChain}-${fromToken?.symbol}`]).toFixed(4)}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {renderChainSelector(fromChain, setFromChain, "Chain")}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Token</Label>
                {renderTokenButton(fromToken, () => setTokenSelectorOpen("from"), fromChain)}
              </div>
            </div>

            <Input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="text-2xl h-14 bg-transparent border-0 px-0 focus-visible:ring-0"
            />
          </div>

          {/* Swap Direction */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwapChains}
              className="rounded-full h-12 w-12 bg-background border-2"
            >
              <ArrowDownUp className="h-5 w-5" />
            </Button>
          </div>

          {/* To Section */}
          <div className="p-4 rounded-xl bg-muted/50 space-y-4">
            <span className="text-sm font-medium">To</span>

            <div className="grid grid-cols-2 gap-3">
              {renderChainSelector(toChain, setToChain, "Chain")}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Token</Label>
                {renderTokenButton(toToken, () => setTokenSelectorOpen("to"), toChain)}
              </div>
            </div>

            <div className="text-2xl h-14 flex items-center">
              {isLoadingRoutes ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : selectedRoute ? (
                <span className="font-semibold">{Number.parseFloat(selectedRoute.outputAmount).toFixed(6)}</span>
              ) : (
                <span className="text-muted-foreground">0.00</span>
              )}
            </div>
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
            <div className="flex gap-1">
              {[0.5, 1.0, 2.0, 3.0].map((s) => (
                <Button
                  key={s}
                  variant={slippage === s ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSlippage(s)}
                >
                  {s}%
                </Button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            className="w-full h-12 text-lg"
            disabled={!selectedRoute || isSwapping || !isConnected}
            onClick={handleSwap}
          >
            {!isConnected ? (
              "Connect Wallet"
            ) : isSwapping ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Executing Swap...
              </>
            ) : selectedRoute ? (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Swap via {selectedRoute.swaps[0]?.swapperId || "Best Route"}
              </>
            ) : (
              "Enter Amount"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Right: Routes List */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Available Routes</CardTitle>
          <CardDescription>
            {routes.length > 0
              ? `${routes.length} routes found - select the best option for you`
              : "Enter an amount to see available routes"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-6">
          {isLoadingRoutes ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : routes.length > 0 ? (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3 pb-4">
                {routes.map((route) => renderRouteCard(route, selectedRoute?.requestId === route.requestId))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p>No routes available</p>
              <p className="text-sm">Enter an amount to find the best swap routes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Selector Dialog */}
      <Dialog open={!!tokenSelectorOpen} onOpenChange={() => setTokenSelectorOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>
              Choose a token from {tokenSelectorOpen === "from" ? fromChainInfo?.name : toChainInfo?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              className="pl-10"
            />
            {tokenSearch && (
              <button onClick={() => setTokenSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {filteredTokens.map((token) => (
                <button
                  key={`${token.blockchain}-${token.symbol}-${token.address}`}
                  onClick={() => {
                    if (tokenSelectorOpen === "from") {
                      setFromToken(token)
                    } else {
                      setToToken(token)
                    }
                    setTokenSelectorOpen(null)
                    setTokenSearch("")
                  }}
                  className="w-full p-3 rounded-lg hover:bg-muted flex items-center gap-3 transition-colors"
                >
                  <Image
                    src={token.logo || `/placeholder.svg?height=40&width=40&query=${token.symbol}`}
                    alt={token.symbol}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div className="text-left">
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-sm text-muted-foreground">{token.name}</div>
                  </div>
                  {token.usdPrice && (
                    <div className="ml-auto text-sm text-muted-foreground">${token.usdPrice.toFixed(2)}</div>
                  )}
                </button>
              ))}
              {filteredTokens.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No tokens found</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
