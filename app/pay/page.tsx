"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Wallet, CheckCircle2, AlertCircle } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { getTokenAddress, signERC3009Authorization, executeERC3009Transfer, sendToken } from "@/lib/web3"

function PaymentContent() {
  const searchParams = useSearchParams()
  const { isConnected, wallets, activeChain, chainId } = useWeb3()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [txHash, setTxHash] = useState("")

  const to = searchParams.get("to")
  const amount = searchParams.get("amount")
  const token = searchParams.get("token") as "USDC" | "USDT" | "DAI" | null
  const networkParam = searchParams.get("network")

  const isValid = to && amount && token

  const isUSDC = token === "USDC"
  // x402 logic: If USDC and on EVM, we use gasless/EIP-3009
  const isGasless = isUSDC && activeChain === "EVM"

  useEffect(() => {
    // Simulate initial loading/validation
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const handlePayment = async () => {
    if (!isConnected || !wallets.EVM) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to continue.",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const tokenAddress = getTokenAddress(chainId, token || "USDC")
      if (!tokenAddress) throw new Error("Token not supported on this network")

      let hash = ""

      if (isGasless) {
        // x402 Flow
        toast({
          title: "Signing Authorization",
          description: "Please sign the x402 payment authorization.",
        })

        const auth = await signERC3009Authorization(tokenAddress, wallets.EVM, to!, amount!, chainId)

        toast({
          title: "Processing Payment",
          description: "Submitting your secure payment...",
        })

        hash = await executeERC3009Transfer(tokenAddress, wallets.EVM, to!, amount!, auth)
      } else {
        // Standard Flow
        toast({
          title: "Confirm Transaction",
          description: "Please confirm the transaction in your wallet.",
        })
        hash = await sendToken(tokenAddress, to!, amount!)
      }

      setTxHash(hash)
      setCompleted(true)
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed securely.",
      })
    } catch (error: any) {
      console.error("Payment failed:", error)
      toast({
        title: "Payment Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isValid) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Invalid Payment Link
            </CardTitle>
            <CardDescription>
              The payment link is missing required information. Please check the URL and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-green-500">Payment Successful</CardTitle>
            <CardDescription>Your payment has been processed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-card border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">
                  {amount} {token}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium truncate max-w-[200px]">{to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction Hash</span>
                <span className="font-mono text-xs truncate max-w-[150px]">{txHash}</span>
              </div>
            </div>
            <Button className="w-full bg-transparent" variant="outline" onClick={() => window.close()}>
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-lg mx-auto py-20 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center border-b border-border/50 pb-8">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Payment Request</CardTitle>
          <CardDescription>
            You are paying{" "}
            <span className="text-foreground font-medium">
              {amount} {token}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-mono text-xs bg-background px-2 py-1 rounded border truncate max-w-[180px]">
                  {to}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-lg">
                  {amount} <span className="text-sm text-muted-foreground">{token}</span>
                </span>
              </div>
              {isGasless && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Badge
                    variant="secondary"
                    className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                  >
                    x402 Protocol
                  </Badge>
                  <span className="text-xs text-muted-foreground">Gasless payment enabled</span>
                </div>
              )}
            </div>

            {!isConnected ? (
              <Alert className="bg-primary/5 border-primary/20">
                <AlertTitle>Connect Wallet</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Connect your wallet to complete this payment securely.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <Button size="lg" className="w-full" onClick={handlePayment} disabled={!isConnected || processing}>
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Pay {amount} {token}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Powered by</span>
          <span className="font-bold text-foreground">x402 Protocol</span>
        </div>
      </div>
    </div>
  )
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  )
}
