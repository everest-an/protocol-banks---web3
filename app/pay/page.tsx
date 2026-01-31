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
import { getTokenAddress, signERC3009Authorization, executeERC3009Transfer, sendToken, getTokenBalance } from "@/lib/web3"
import { FeePreview } from "@/components/fee-preview"
import { SettlementMethodBadge } from "@/components/settlement-method-badge"
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

async function verifyPaymentLink(params: Record<string, string | null>): Promise<PaymentVerification> {
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

  // ✅ P0 IMPROVEMENT: Server-side HMAC signature verification
  const sig = params.sig
  if (sig && params.to && params.amount && params.token) {
    try {
      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: params.to,
          amount: params.amount,
          token: params.token,
          exp: params.exp,
          sig
        }),
      })

      if (response.ok) {
        const { valid } = await response.json()
        result.signatureValid = valid
      } else {
        console.error('[Pay] Signature verification failed:', await response.text())
        result.signatureValid = false
      }
    } catch (error) {
      console.error('[Pay] Signature verification error:', error)
      result.signatureValid = false
    }
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

  useEffect(() => {
    async function verifyLink() {
      const params: Record<string, string | null> = {
        to,
        amount,
        token,
        network: networkParam,
        sig,
        exp,
      }

      const verification = await verifyPaymentLink(params)
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
    }

    verifyLink()
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

      console.log("[Pay] Payment details:", {
        chainId,
        chainName: chainId === 1 ? "Ethereum" : chainId === 42161 ? "Arbitrum" : chainId === 8453 ? "Base" : "Unknown",
        token,
        tokenAddress,
        to,
        amount,
        walletAddress: wallets.EVM,
      })

      // ✅ P0 IMPROVEMENT: Balance check before payment
      try {
        const balance = await getTokenBalance(wallets.EVM, tokenAddress)
        const requiredAmount = parseFloat(amount!)

        if (parseFloat(balance) < requiredAmount) {
          toast({
            title: "Insufficient Balance",
            description: `You need ${amount} ${token} but only have ${parseFloat(balance).toFixed(6)} ${token}`,
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
      } catch (balanceError: any) {
        console.error("[Pay] Balance check failed:", balanceError)
        toast({
          title: "Balance Check Failed",
          description: "Unable to verify balance. Please check your wallet connection.",
          variant: "destructive",
        })
        setProcessing(false)
        return
      }

      const currentTo = searchParams.get("to")
      const currentAmount = searchParams.get("amount")
      if (currentTo !== to || currentAmount !== amount) {
        throw new Error("Transaction parameters were modified - possible attack detected")
      }

      let hash = ""

      console.log("[Pay] Payment method:", {
        isGasless,
        isUSDC,
        token,
        activeChain,
      })

      if (isGasless) {
        console.log("[Pay] Using Gasless (ERC-3009) payment method")

        toast({
          title: "Signing Authorization",
          description: "Please sign the x402 payment authorization.",
        })

        console.log("[Pay] Calling signERC3009Authorization...")

        const auth = await signERC3009Authorization(tokenAddress, wallets.EVM, to!, amount!, chainId)

        console.log("[Pay] Authorization signed:", auth)

        if (!verifyLock(lock)) {
          setProcessing(false)
          return
        }

        toast({
          title: "Processing Payment",
          description: "Submitting your secure payment...",
        })

        console.log("[Pay] Calling executeERC3009Transfer...")

        try {
          hash = await executeERC3009Transfer(tokenAddress, wallets.EVM, to!, amount!, auth)
          console.log("[Pay] ERC3009 transfer executed, hash:", hash)
        } catch (erc3009Error: any) {
          console.error("[Pay] executeERC3009Transfer failed:", erc3009Error)
          throw new Error(`ERC-3009 transfer failed: ${erc3009Error.message}`)
        }

        // Settle via x402 API - Base chain uses CDP (0 fee), others use Relayer
        try {
          const settleResponse = await fetch("/api/x402/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authorizationId: auth.nonce || `auth_${Date.now()}`,
              transactionHash: hash,
              chainId,
              amount: amount!,
              token: token || "USDC",
              from: wallets.EVM,
              to: to!,
            }),
          })

          if (settleResponse.ok) {
            const settleData = await settleResponse.json()
            console.log("[v0] x402 settlement:", settleData)
          }
        } catch (settleErr) {
          console.warn("[v0] x402 settle warning:", settleErr)
          // Non-blocking - payment already succeeded
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

        console.log("[Pay] Calling sendToken with:", {
          tokenAddress,
          to,
          amount,
          walletAddress: wallets.EVM,
          chainId,
        })

        try {
          hash = await sendToken(tokenAddress, to!, amount!)
          console.log("[Pay] Transaction hash received:", hash)
        } catch (sendError: any) {
          console.error("[Pay] sendToken failed:", sendError)
          throw new Error(`Transaction failed: ${sendError.message}`)
        }
      }

      // ✅ P0 IMPROVEMENT: Database write with retry queue fallback
      const supabase = getSupabase()
      if (supabase) {
        try {
          const { data: paymentData, error: dbError } = await supabase
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

          if (dbError) throw dbError

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
        } catch (dbError: any) {
          console.error("[Pay] Database recording failed:", dbError)

          // Add to retry queue to prevent data loss
          try {
            await fetch('/api/payment/retry-queue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                txHash: hash,
                paymentData: {
                  tx_hash: hash,
                  from_address: wallets.EVM,
                  to_address: to,
                  token_symbol: token,
                  token_address: tokenAddress,
                  amount: amount,
                  amount_usd: Number(amount),
                  status: "completed",
                }
              })
            })

            console.log("[Pay] Payment queued for retry")
          } catch (retryError) {
            console.error("[Pay] Retry queue failed:", retryError)
            // Even if retry queue fails, don't block transaction success display
          }
        }
      }

      // Update invoice status if this was an invoice payment
      if (invoiceId && invoice) {
        try {
          const updateResponse = await fetch('/api/invoice', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceId: invoice.invoice_id,
              status: 'paid',
              txHash: hash,
              paidBy: wallets.EVM,
            }),
          })
          
          if (updateResponse.ok) {
            console.log("[Pay] Invoice status updated to paid")
          } else {
            console.error("[Pay] Failed to update invoice status")
          }
        } catch (invoiceUpdateError) {
          console.error("[Pay] Invoice update error:", invoiceUpdateError)
          // Non-blocking - payment already succeeded
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

  if (loading || invoiceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {invoiceLoading && (
          <p className="ml-3 text-sm text-muted-foreground">Loading invoice...</p>
        )}
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
          <CardTitle className="text-2xl">
            {merchantName || "Payment Request"}
          </CardTitle>
          <CardDescription>
            {description || (
              <>
                You are paying{" "}
                <span className="text-foreground font-medium">
                  {amount} {token}
                </span>
              </>
            )}
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
                </div>
              )}
              {/* Settlement Method Badge - Base chain (8453) uses CDP with 0 fee */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Settlement Method</span>
                <SettlementMethodBadge method={chainId === 8453 ? "cdp" : "relayer"} chainId={chainId} />
              </div>
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
