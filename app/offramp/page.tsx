"use client"

import { useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowDown,
  Banknote,
  Building2,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Clock,
  RefreshCw,
} from "lucide-react"

interface Quote {
  id: string
  sourceAmount: string
  sourceToken: string
  targetAmount: string
  targetCurrency: string
  exchangeRate: number
  fees: {
    networkFee: string
    serviceFee: string
    totalFee: string
  }
  expiresAt: string
  provider: string
}

const TOKENS = [
  { symbol: "USDC", name: "USD Coin", icon: "UC" },
  { symbol: "USDT", name: "Tether", icon: "UT" },
  { symbol: "ETH", name: "Ethereum", icon: "ET" },
  { symbol: "DAI", name: "Dai", icon: "DA" },
]

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
]

const PAYMENT_METHODS = [
  { id: "bank_transfer" as const, name: "Bank Transfer", icon: Building2, description: "1-3 business days" },
  { id: "card" as const, name: "Debit Card", icon: CreditCard, description: "Instant" },
]

type Step = "configure" | "review" | "processing" | "complete"

export default function OfframpPage() {
  const { isConnected, wallet } = useWeb3()
  const [step, setStep] = useState<Step>("configure")
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [sourceToken, setSourceToken] = useState("USDC")
  const [targetCurrency, setTargetCurrency] = useState("USD")
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "card">("bank_transfer")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState("")

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/offramp/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          sourceToken,
          sourceChain: 8453, // Base
          targetCurrency,
          paymentMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to get quote")
        return
      }

      setQuote(data)
      setStep("review")
    } catch {
      setError("Failed to get quote. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const executeOfframp = async () => {
    if (!quote) return

    setLoading(true)
    setStep("processing")
    setError("")

    try {
      const response = await fetch("/api/offramp/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          provider: quote.provider,
          sourceToken,
          sourceChain: 8453,
          amount,
          targetCurrency,
          paymentMethod,
          walletAddress: wallet,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to execute off-ramp")
        setStep("review")
        return
      }

      setStep("complete")
    } catch {
      setError("Transaction failed. Please try again.")
      setStep("review")
    } finally {
      setLoading(false)
    }
  }

  const currencySymbol = CURRENCIES.find(c => c.code === targetCurrency)?.symbol || "$"

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">Off-Ramp</h1>
          <p className="text-muted-foreground">Convert crypto to fiat currency</p>
        </div>

        {/* Step: Configure */}
        {step === "configure" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">You Send</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="text-2xl font-mono h-14"
                    />
                  </div>
                  <Select value={sourceToken} onValueChange={setSourceToken}>
                    <SelectTrigger className="w-32 h-14">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOKENS.map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{token.symbol}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preset amounts */}
                <div className="flex gap-2">
                  {["100", "500", "1000", "5000"].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(preset)}
                      className="flex-1"
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <div className="p-2 rounded-full bg-muted">
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">You Receive</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                  <SelectTrigger className="h-14">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{currency.symbol}</span>
                          <span>{currency.name} ({currency.code})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${paymentMethod === method.id ? "bg-primary/10" : "bg-muted"}`}>
                      <method.icon className={`h-5 w-5 ${paymentMethod === method.id ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{method.name}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                    {paymentMethod === method.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={getQuote}
              disabled={!amount || parseFloat(amount) <= 0 || loading}
              className="w-full h-12 text-lg"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Getting Quote...</>
              ) : (
                "Get Quote"
              )}
            </Button>
          </>
        )}

        {/* Step: Review Quote */}
        {step === "review" && quote && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quote Summary</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Expires in 5 minutes</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Exchange display */}
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">You send</p>
                    <p className="text-3xl font-bold font-mono">{quote.sourceAmount} {quote.sourceToken}</p>
                  </div>
                  <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">You receive</p>
                    <p className="text-3xl font-bold font-mono text-green-500">
                      {currencySymbol}{quote.targetAmount} {quote.targetCurrency}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="font-mono">1 {quote.sourceToken} = {currencySymbol}{quote.exchangeRate.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span className="font-mono">{currencySymbol}{quote.fees.networkFee}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Fee</span>
                    <span className="font-mono">{currencySymbol}{quote.fees.serviceFee}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Total Fee</span>
                    <span className="font-mono">{currencySymbol}{quote.fees.totalFee}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Provider</span>
                    <Badge variant="secondary" className="capitalize">{quote.provider}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="capitalize">{paymentMethod.replace("_", " ")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep("configure"); setQuote(null); }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={executeOfframp}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <>Confirm <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing Off-Ramp</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Converting {amount} {sourceToken} to {targetCurrency}. This may take a moment...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-green-500/10 mb-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Off-Ramp Initiated</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  Your {amount} {sourceToken} is being converted to {currencySymbol}{quote?.targetAmount} {targetCurrency}.
                </p>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {paymentMethod === "bank_transfer" ? "1-3 business days" : "Instant"}
                </Badge>
              </CardContent>
            </Card>

            <Button
              onClick={() => {
                setStep("configure")
                setQuote(null)
                setAmount("")
              }}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              New Off-Ramp
            </Button>
          </>
        )}

        {/* Security footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Powered by regulated off-ramp providers</span>
        </div>
      </div>
    </div>
  )
}
