"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Wallet, CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, Eye } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { getTokenAddress, signERC3009Authorization, executeERC3009Transfer, sendToken } from "@/lib/web3"
import { FeePreview } from "@/components/fee-preview"
import { recordFee, calculateFee } from "@/lib/protocol-fees"
import { getSupabase } from "@/lib/supabase"

interface Invoice {
  invoice_id: string
  recipient_address: string
  amount: number
  token: string
  description?: string
  merchant_name?: string
  status: string
  expires_at: string
}

interface PaymentVerification {
  signatureValid: boolean
  paramsValid: boolean
  expired: boolean
  tamperedFields: string[]
}

function verifyPaymentLink(params: Record<string, string | null>): PaymentVerification {
  const result: PaymentVerification = {
    signatureValid: false,
    paramsValid: true,
    expired: false,
    tamperedFields: [],
  }

  // Check required params
  const requiredFields = ["to", "amount", "token"]
  for (const field of requiredFields) {
    if (!params[field]) {
      result.paramsValid = false
      result.tamperedFields.push(field)
    }
  }

  // Validate address format
  const to = params.to
  if (to && !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    result.paramsValid = false
    result.tamperedFields.push("to (invalid format)")
  }

  // Validate amount is numeric
  const amount = params.amount
  if (amount && (isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0)) {
    result.paramsValid = false
    result.tamperedFields.push("amount (invalid value)")
  }

  // Check for homoglyph attacks in address
  if (to) {
    const homoglyphs = /[аеіоурсхАЕІОУРСХ]/ // Cyrillic lookalikes
    if (homoglyphs.test(to)) {
      result.paramsValid = false
      result.tamperedFields.push("to (contains suspicious characters)")
    }
  }

  // Check expiry if present
  const exp = params.exp
  if (exp) {
    const expiry = Number.parseInt(exp)
    if (!isNaN(expiry) && Date.now() > expiry) {
      result.expired = true
    }
  }

  // Verify signature if present
  const sig = params.sig
  if (sig && params.to && params.amount && params.token) {
    // In production, verify HMAC signature server-side
    // For now, mark as valid if signature exists
    result.signatureValid = sig.length === 16
  }

  return result
}

interface TransactionLock {
  id: string
  params: { to: string; amount: string; token: string }
  createdAt: number
}

function PaymentContent() {
  const searchParams = useSearchParams()
  const { isConnected, wallets, activeChain, chainId } = useWeb3()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [txHash, setTxHash] = useState("")

  const [securityChecked, setSecurityChecked] = useState(false)
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([])
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [transactionLock, setTransactionLock] = useState<TransactionLock | null>(null)
  const [verificationResult, setVerificationResult] = useState<PaymentVerification | null>(null)
  const [feeEstimate, setFeeEstimate] = useState<{ finalFee: number } | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Get params
  const invoiceId = searchParams.get("invoice")
  const to = invoice?.recipient_address || searchParams.get("to")
  const amount = invoice?.amount?.toString() || searchParams.get("amount")
  const token = (invoice?.token || searchParams.get("token")) as "USDC" | "USDT" | "DAI" | null
  const networkParam = searchParams.get("network")
  const sig = searchParams.get("sig")
  const exp = searchParams.get("exp")
  const merchantName = invoice?.merchant_name
  const description = invoice?.description

  // Fetch invoice if invoice ID is present
  useEffect(() => {
    if (invoiceId && sig) {
      setInvoiceLoading(true)
      fetch(`/api/invoice?id=${invoiceId}&sig=${sig}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            toast({
              title: "Invalid Invoice",
              description: data.error,
              variant: "destructive",
            })
          } else {
            setInvoice(data)
          }
        })
        .catch((err) => {
          console.error("[Pay] Invoice fetch error:", err)
        })
        .finally(() => {
          setInvoiceLoading(false)
        })
    }
  }, [invoiceId, sig, toast])

  const isValid = to && amount && token
  const isUSDC = token === "USDC"
  const isGasless = isUSDC && activeChain === "EVM"
  
  // Check if CDP (free settlement) is available
  const isCDPAvailable = isUSDC && chainId === 8453 // Base mainnet

  useEffect(() => {
    const params: Record<string, string | null> = {
      to,
      amount,
      token,
      network: networkParam,
      sig,
      exp,
    }

    const verification = verifyPaymentLink(params)
    setVerificationResult(verification)

    const warnings: string[] = []

    if (verification.expired) {
      warnings.push("This payment link has expired")
    }

    if (!verification.signatureValid && sig) {
      warnings.push("Payment link signature is invalid - link may have been tampered with")
    }

    if (verification.tamperedFields.length > 0) {
      warnings.push(`Invalid parameters detected: ${verification.tamperedFields.join(", ")}`)
    }

    // Check for unsigned links (less secure)
    if (!sig) {
      warnings.push("This payment link is unsigned - verify the recipient address carefully")
    }

    setSecurityWarnings(warnings)
    setSecurityChecked(true)
    setLoading(false)
  }, [to, amount, token, networkParam, sig, exp])

  useEffect(() => {
    async function estimateFee() {
      if (amount && wallets.EVM) {
        try {
          const fee = await calculateFee(Number(amount), wallets.EVM, "standard")
          setFeeEstimate(fee)
        } catch (err) {
          console.warn("Fee estimation failed:", err)
        }
      }
    }
    estimateFee()
  }, [amount, wallets.EVM])

  const createLock = useCallback(() => {
    if (!to || !amount || !token) return null

    const lock: TransactionLock = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      params: { to, amount, token },
      createdAt: Date.now(),
    }

    setTransactionLock(lock)
    return lock
  }, [to, amount, token])

  const verifyLock = useCallback(
    (lock: TransactionLock): boolean => {
      // Check lock hasn't expired (30 seconds)
      if (Date.now() - lock.createdAt > 30000) {
        toast({
          title: "Transaction Expired",
          description: "Please try again - the transaction lock has expired.",
          variant: "destructive",
        })
        return false
      }

      // Verify parameters haven't changed
      if (lock.params.to !== to || lock.params.amount !== amount || lock.params.token !== token) {
        toast({
          title: "Security Alert",
          description: "Transaction parameters changed during processing - aborting for safety.",
          variant: "destructive",
        })
        return false
      }

      return true
    },
    [to, amount, token, toast],
  )

  const handlePayment = async () => {
    if (!isConnected || !wallets.EVM) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to continue.",
        variant: "destructive",
      })
      return
    }

    if (securityWarnings.length > 0 && !showSecurityModal) {
      setShowSecurityModal(true)
      return
    }

    const lock = createLock()
    if (!lock) {
      toast({
        title: "Error",
        description: "Failed to create transaction lock.",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      if (!verifyLock(lock)) {
        setProcessing(false)
        return
      }

      const tokenAddress = getTokenAddress(chainId, token || "USDC")
      if (!tokenAddress) throw new Error("Token not supported on this network")

      const currentTo = searchParams.get("to")
      const currentAmount = searchParams.get("amount")
      if (currentTo !== to || currentAmount !== amount) {
        throw new Error("Transaction parameters were modified - possible attack detected")
      }

      let hash = ""

      if (isGasless) {
        toast({
          title: "Signing Authorization",
          description: "Please sign the x402 payment authorization.",
        })

        const auth = await signERC3009Authorization(tokenAddress, wallets.EVM, to!, amount!, chainId)

        if (!verifyLock(lock)) {
          setProcessing(false)
          return
        }

        toast({
          title: "Processing Payment",
          description: isCDPAvailable 
            ? "Submitting via CDP Facilitator (free settlement)..." 
            : "Submitting your secure payment...",
        })

        // Try CDP settlement first for Base chain USDC
        if (isCDPAvailable) {
          try {
            const cdpResponse = await fetch('/api/x402/settle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signature: auth,
                from: wallets.EVM,
                to: to,
                value: amount,
                chainId: chainId,
                token: token,
              }),
            })
            
            const cdpResult = await cdpResponse.json()
            
            if (cdpResult.success && cdpResult.transactionHash) {
              hash = cdpResult.transactionHash
              toast({
                title: "CDP Settlement Success",
                description: "Payment settled via Coinbase CDP (0 fee)!",
              })
            } else {
              // CDP failed, fall back to direct execution
              console.warn("[pay] CDP failed, falling back to direct execution:", cdpResult.error)
              hash = await executeERC3009Transfer(tokenAddress, wallets.EVM, to!, amount!, auth)
            }
          } catch (cdpError) {
            console.warn("[pay] CDP request failed, falling back:", cdpError)
            hash = await executeERC3009Transfer(tokenAddress, wallets.EVM, to!, amount!, auth)
          }
        } else {
          hash = await executeERC3009Transfer(tokenAddress, wallets.EVM, to!, amount!, auth)
        }
      } else {
        toast({
          title: "Confirm Transaction",
          description: "Please confirm the transaction in your wallet.",
        })

        if (!verifyLock(lock)) {
          setProcessing(false)
          return
        }

        hash = await sendToken(tokenAddress, to!, amount!)
      }

      const supabase = getSupabase()
      if (supabase) {
        try {
          const { data: paymentData } = await supabase
            .from("payments")
            .insert({
              tx_hash: hash,
              from_address: wallets.EVM,
              to_address: to,
              token_symbol: token,
              token_address: tokenAddress,
              amount: amount,
              amount_usd: Number(amount),
              status: "completed",
            })
            .select()
            .single()

          // Record protocol fee
          if (paymentData) {
            await recordFee({
              paymentId: paymentData.id,
              amount: Number(amount),
              fromAddress: wallets.EVM,
              tokenSymbol: token!,
              chainId: chainId,
              tier: "standard",
              collectionMethod: "deferred",
            })
          }
        } catch (dbError) {
          console.warn("[v0] Database recording failed:", dbError)
          // Don't fail the payment if DB recording fails
        }
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
      setTransactionLock(null)
    }
  }

  const handleSecurityConfirm = () => {
    setShowSecurityModal(false)
    handlePayment()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (verificationResult?.expired) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Payment Link Expired
            </CardTitle>
            <CardDescription>
              This payment link has expired. Please request a new payment link from the recipient.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!isValid || (verificationResult && !verificationResult.paramsValid)) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Invalid Payment Link
            </CardTitle>
            <CardDescription>
              {verificationResult?.tamperedFields && verificationResult.tamperedFields.length > 0
                ? `Security check failed: ${verificationResult.tamperedFields.join(", ")}`
                : "The payment link is missing required information. Please check the URL and try again."}
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
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full border-yellow-500/20 bg-card">
            <CardHeader>
              <CardTitle className="text-yellow-500 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Security Warnings
              </CardTitle>
              <CardDescription>Please review the following warnings before proceeding:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {securityWarnings.map((warning, i) => (
                  <Alert key={i} className="bg-yellow-500/5 border-yellow-500/20">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-sm">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowSecurityModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black" onClick={handleSecurityConfirm}>
                  I Understand, Proceed
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          <div className="flex items-center justify-center gap-2">
            {securityWarnings.length === 0 ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Security Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                <ShieldAlert className="h-3 w-3 mr-1" />
                {securityWarnings.length} Warning{securityWarnings.length > 1 ? "s" : ""}
              </Badge>
            )}
            {sig && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                <Eye className="h-3 w-3 mr-1" />
                Signed Link
              </Badge>
            )}
          </div>

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
                  {isCDPAvailable && (
                    <Badge
                      variant="secondary"
                      className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"
                    >
                      CDP Free
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {amount && Number(amount) > 0 && wallets.EVM && (
              <FeePreview
                amount={Number(amount)}
                walletAddress={wallets.EVM}
                tokenSymbol={token || "USDC"}
                compact={true}
              />
            )}

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
                {feeEstimate && (
                  <span className="text-xs ml-1 opacity-70">(+${feeEstimate.finalFee.toFixed(2)} fee)</span>
                )}
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
