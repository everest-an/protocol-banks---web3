"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowRight, DollarSign, Building2, ExternalLink, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUserType } from "@/contexts/user-type-context"
import { getOffRampQuote, getOffRampWidgetUrl, type OffRampProvider, type OffRampQuote } from "@/lib/offramp"

interface OffRampModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress: string
  balance?: string
}

export function OffRampModal({ open, onOpenChange, walletAddress, balance = "0" }: OffRampModalProps) {
  const { toast } = useToast()
  const { isWeb2User, t } = useUserType()
  const [amount, setAmount] = useState("")
  const [provider, setProvider] = useState<OffRampProvider>("coinbase")
  const [currency, setCurrency] = useState("USD")
  const [quote, setQuote] = useState<OffRampQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"input" | "confirm" | "processing" | "complete">("input")

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("input")
      setQuote(null)
      setAmount("")
    }
  }, [open])

  // Get quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || Number.parseFloat(amount) <= 0) {
        setQuote(null)
        return
      }

      try {
        const newQuote = await getOffRampQuote(amount, "USDC", currency, provider)
        setQuote(newQuote)
      } catch (error) {
        console.error("Failed to get quote:", error)
      }
    }

    const debounce = setTimeout(fetchQuote, 500)
    return () => clearTimeout(debounce)
  }, [amount, currency, provider])

  const handleContinue = () => {
    if (!quote) return
    setStep("confirm")
  }

  const handleWithdraw = () => {
    setStep("processing")

    // Open provider widget in new window
    const widgetUrl = getOffRampWidgetUrl(provider, {
      walletAddress,
      amount,
      token: "USDC",
      targetCurrency: currency,
    })

    if (widgetUrl) {
      window.open(widgetUrl, "_blank", "width=500,height=700")
    }

    // Simulate completion after delay (in production, webhook would confirm)
    setTimeout(() => {
      setStep("complete")
      toast({
        title: isWeb2User ? "Withdrawal Initiated" : "Off-Ramp Initiated",
        description: isWeb2User
          ? "Your funds will arrive in your bank account within 1-3 business days."
          : "USDC transfer initiated. Check your provider for status.",
      })
    }, 2000)
  }

  const providers = [
    { value: "coinbase", label: "Coinbase", fee: "1.5%", speed: "1-3 days" },
    { value: "transak", label: "Transak", fee: "2.0%", speed: "1-5 days" },
    { value: "moonpay", label: "MoonPay", fee: "1.75%", speed: "2-4 days" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-500" />
            {isWeb2User ? "Withdraw to Bank" : "Off-Ramp (Sell Crypto)"}
          </DialogTitle>
          <DialogDescription>
            {isWeb2User
              ? "Convert your digital dollars to cash in your bank account"
              : "Convert USDC to fiat and withdraw to your bank"}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-6 py-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label>{isWeb2User ? "Amount to Withdraw" : "Amount (USDC)"}</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9 text-lg"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isWeb2User ? "Available balance" : "Balance"}: ${balance} {isWeb2User ? "" : "USDC"}
              </p>
            </div>

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>{isWeb2User ? "Withdrawal Method" : "Provider"}</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as OffRampProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{p.label}</span>
                        <span className="text-xs text-muted-foreground ml-4">
                          {p.fee} fee · {p.speed}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>{isWeb2User ? "Receive In" : "Target Currency"}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quote Preview */}
            {quote && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isWeb2User ? "You send" : "Input"}</span>
                    <span>
                      ${quote.inputAmount} {isWeb2User ? "" : quote.inputToken}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isWeb2User ? "Fee" : "Provider Fee"}</span>
                    <span>-${quote.fee}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>{isWeb2User ? "You receive" : "Output"}</span>
                    <span className="text-green-500">
                      ${quote.outputAmount} {quote.outputCurrency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button className="w-full" onClick={handleContinue} disabled={!quote || Number.parseFloat(amount) <= 0}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "confirm" && quote && (
          <div className="space-y-6 py-4">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="text-3xl font-bold">${quote.outputAmount}</div>
                <p className="text-muted-foreground">
                  {isWeb2User ? "Will be deposited to your bank account" : `${quote.outputCurrency} via ${provider}`}
                </p>
                <Badge variant="outline" className="mt-2">
                  Processing time: 1-3 business days
                </Badge>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("input")}>
                Back
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleWithdraw}>
                {isWeb2User ? "Withdraw" : "Confirm Off-Ramp"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              {isWeb2User ? "Processing your withdrawal..." : "Initiating off-ramp..."}
            </p>
            <p className="text-xs text-muted-foreground">Complete the transaction in the provider window</p>
          </div>
        )}

        {step === "complete" && (
          <div className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <h3 className="font-semibold text-lg">{isWeb2User ? "Withdrawal Initiated!" : "Off-Ramp Complete!"}</h3>
              <p className="text-muted-foreground mt-2">
                {isWeb2User ? "Funds will arrive in 1-3 business days" : "Check your provider for transaction status"}
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
