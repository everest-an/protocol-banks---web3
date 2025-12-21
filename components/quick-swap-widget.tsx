"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowDownUp, Clock, Fuel, TrendingUp, AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react"
import { zunoDex, type SwapQuote } from "@/lib/zunodex"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { toast } from "sonner"

interface QuickSwapWidgetProps {
  compact?: boolean
  defaultInputToken?: string
  defaultOutputToken?: string
  onSwapComplete?: (tx: { hash: string; inputToken: string; outputToken: string; amount: string }) => void
}

export function QuickSwapWidget({
  compact = false,
  defaultInputToken = "ETH",
  defaultOutputToken = "USDC.ETH",
  onSwapComplete,
}: QuickSwapWidgetProps) {
  const { address, signer, isConnected } = useWeb3()
  const { translateTerm, isWeb2User } = useUserType()

  const [inputToken, setInputToken] = useState(defaultInputToken)
  const [outputToken, setOutputToken] = useState(defaultOutputToken)
  const [inputAmount, setInputAmount] = useState("")
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [slippage, setSlippage] = useState(0.5)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const tokens = zunoDex.getSupportedTokens()

  // Fetch balances on mount and address change
  useEffect(() => {
    if (address) {
      zunoDex.getZRC20Balances(address).then(setBalances).catch(console.error)
    }
  }, [address])

  // Debounced quote fetching
  useEffect(() => {
    if (!inputAmount || Number.parseFloat(inputAmount) <= 0) {
      setQuote(null)
      setError(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoadingQuote(true)
      setError(null)
      try {
        const q = await zunoDex.getQuote(inputToken, outputToken, inputAmount, slippage)
        setQuote(q)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get quote")
        setQuote(null)
      } finally {
        setIsLoadingQuote(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [inputAmount, inputToken, outputToken, slippage])

  const handleSwapTokens = useCallback(() => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
    setInputAmount("")
    setQuote(null)
  }, [inputToken, outputToken])

  const handleMaxClick = useCallback(() => {
    const balance = balances[inputToken] || "0"
    setInputAmount(balance)
  }, [balances, inputToken])

  const handleSwap = async () => {
    if (!signer || !quote || !address) {
      toast.error("Please connect your wallet")
      return
    }

    setIsSwapping(true)
    try {
      const tx = await zunoDex.executeSwap(signer, inputToken, outputToken, inputAmount, address, slippage, true)

      toast.success(
        isWeb2User
          ? `Exchange completed! ${inputAmount} ${inputToken} → ${quote.outputAmount} ${outputToken}`
          : `Swap executed! TX: ${tx.hash.slice(0, 10)}...`,
      )

      onSwapComplete?.({
        hash: tx.hash,
        inputToken,
        outputToken,
        amount: inputAmount,
      })

      // Reset form
      setInputAmount("")
      setQuote(null)

      // Refresh balances
      zunoDex.getZRC20Balances(address).then(setBalances).catch(console.error)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Swap failed")
    } finally {
      setIsSwapping(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${seconds}s`
    return `~${Math.floor(seconds / 60)}m`
  }

  if (compact) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            {isWeb2User ? "Quick Exchange" : "Quick Swap"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={inputToken} onValueChange={setInputToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    {t.icon} {t.symbol.split(".")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex justify-center">
            <Button variant="ghost" size="icon" onClick={handleSwapTokens} className="rounded-full h-8 w-8">
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={outputToken} onValueChange={setOutputToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens
                  .filter((t) => t.symbol !== inputToken)
                  .map((t) => (
                    <SelectItem key={t.symbol} value={t.symbol}>
                      {t.icon} {t.symbol.split(".")[0]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex-1 px-3 py-2 bg-muted rounded-md text-right">
              {isLoadingQuote ? (
                <Loader2 className="h-4 w-4 animate-spin ml-auto" />
              ) : quote ? (
                <span className="font-medium">{Number.parseFloat(quote.outputAmount).toFixed(6)}</span>
              ) : (
                <span className="text-muted-foreground">0.00</span>
              )}
            </div>
          </div>

          <Button className="w-full" disabled={!quote || isSwapping || !isConnected} onClick={handleSwap}>
            {isSwapping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isWeb2User ? "Exchanging..." : "Swapping..."}
              </>
            ) : isWeb2User ? (
              "Exchange"
            ) : (
              "Swap"
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {isWeb2User ? "Currency Exchange" : "Cross-Chain Swap"}
            </CardTitle>
            <CardDescription>
              {isWeb2User
                ? "Exchange currencies instantly across networks"
                : "Swap tokens across any blockchain via ZetaChain"}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            Powered by ZetaChain
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>{isWeb2User ? "You Send" : "From"}</Label>
            {balances[inputToken] && (
              <button onClick={handleMaxClick} className="text-xs text-muted-foreground hover:text-primary">
                Balance: {Number.parseFloat(balances[inputToken]).toFixed(4)} {inputToken.split(".")[0]}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={inputToken} onValueChange={setInputToken}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    <div className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      <span>{t.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="flex-1 text-lg"
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapTokens}
            className="rounded-full h-10 w-10 border-2 bg-transparent"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Output Token */}
        <div className="space-y-2">
          <Label>{isWeb2User ? "You Receive" : "To"}</Label>
          <div className="flex gap-2">
            <Select value={outputToken} onValueChange={setOutputToken}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens
                  .filter((t) => t.symbol !== inputToken)
                  .map((t) => (
                    <SelectItem key={t.symbol} value={t.symbol}>
                      <div className="flex items-center gap-2">
                        <span>{t.icon}</span>
                        <span>{t.symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex-1 px-4 py-2 bg-muted rounded-md flex items-center justify-end">
              {isLoadingQuote ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : quote ? (
                <span className="text-lg font-semibold">{Number.parseFloat(quote.outputAmount).toFixed(6)}</span>
              ) : (
                <span className="text-lg text-muted-foreground">0.00</span>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Quote Details */}
        {quote && (
          <>
            <Separator />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {isWeb2User ? "Exchange Rate" : "Rate"}
                </span>
                <span>
                  1 {inputToken.split(".")[0]} = {quote.exchangeRate} {outputToken.split(".")[0]}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{isWeb2User ? "Minimum Received" : "Min. Received"}</span>
                <span>
                  {Number.parseFloat(quote.minimumReceived).toFixed(6)} {outputToken.split(".")[0]}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Price Impact
                </span>
                <span className={quote.priceImpact > 1 ? "text-amber-500" : "text-emerald-500"}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>

              {quote.gasFee !== "0" && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Fuel className="h-3 w-3" />
                    {isWeb2User ? "Network Fee" : "Gas Fee"}
                  </span>
                  <span>
                    {Number.parseFloat(quote.gasFee).toFixed(6)} {quote.gasToken || "ZETA"}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isWeb2User ? "Estimated Time" : "Est. Time"}
                </span>
                <span>{formatTime(quote.estimatedTime)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Route</span>
                <div className="flex items-center gap-1">
                  {quote.route.map((token, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {token.split(".")[0]}
                      </Badge>
                      {i < quote.route.length - 1 && <span className="text-muted-foreground">→</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Slippage Setting */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Slippage Tolerance</span>
                <div className="flex gap-1">
                  {[0.1, 0.5, 1.0].map((s) => (
                    <Button
                      key={s}
                      variant={slippage === s ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSlippage(s)}
                    >
                      {s}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Swap Button */}
        <Button
          className="w-full h-12 text-lg"
          disabled={!quote || isSwapping || !isConnected || !!error}
          onClick={handleSwap}
        >
          {!isConnected ? (
            "Connect Wallet"
          ) : isSwapping ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isWeb2User ? "Processing Exchange..." : "Executing Swap..."}
            </>
          ) : quote ? (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {isWeb2User ? "Confirm Exchange" : "Confirm Swap"}
            </>
          ) : isWeb2User ? (
            "Enter Amount to Exchange"
          ) : (
            "Enter Amount"
          )}
        </Button>

        {/* Powered By */}
        <p className="text-center text-xs text-muted-foreground">
          {isWeb2User
            ? "Exchanges processed securely via ZetaChain network"
            : "Cross-chain swaps powered by ZetaChain & Uniswap V2 pools"}
        </p>
      </CardContent>
    </Card>
  )
}
