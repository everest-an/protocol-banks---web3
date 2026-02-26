"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Wallet, CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, Eye, Send, Users, Plus } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useToast } from "@/hooks/use-toast"
import { useDemo } from "@/contexts/demo-context"
import { authHeaders } from "@/lib/authenticated-fetch"
import { useVendors } from "@/hooks/use-vendors"
import { usePaymentHistory } from "@/hooks/use-payment-history"
import { getTokenAddress, signERC3009Authorization, executeERC3009Transfer, sendToken, getTokenBalance } from "@/lib/web3"
import { getChainInfo, SUPPORTED_CHAINS, getTokensForChain, type SupportedChainId } from "@/lib/tokens"
import { detectAddressType, validateAddress, isValidTronAddress } from "@/lib/address-utils"
import { getTokenAddress as getTronTokenAddress } from "@/lib/networks"
import { sendTRC20 } from "@/lib/services/tron-payment"
import { FeePreview } from "@/components/fee-preview"
import { SettlementMethodBadge } from "@/components/settlement-method-badge"
import { PaymentActivity } from "@/components/payment-activity"
import { PurposeTagSelector } from "@/components/purpose-tag-selector"
import { PaymentGroupSelector } from "@/components/payment-group-selector"
import { recordFee, calculateFee } from "@/lib/protocol-fees"
import { sonicBranding } from "@/lib/sonic-branding"
import { getVendorDisplayName } from "@/lib/utils"

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

function isValidAddress(address: string): boolean {
  const type = detectAddressType(address)
  return type === "EVM" || type === "TRON"
}

function isValidAmount(amount: string): boolean {
  if (!amount) return false
  const num = Number.parseFloat(amount)
  return !isNaN(num) && num > 0 && num <= 1000000000
}

async function verifyPaymentLink(params: Record<string, string | null>): Promise<PaymentVerification> {
  const result: PaymentVerification = {
    signatureValid: false,
    paramsValid: true,
    expired: false,
    tamperedFields: [],
  }

  const requiredFields = ["to", "amount", "token"]
  for (const field of requiredFields) {
    if (!params[field]) {
      result.paramsValid = false
      result.tamperedFields.push(field)
    }
  }

  const to = params.to
  if (to && !isValidAddress(to)) {
    result.paramsValid = false
    result.tamperedFields.push("to (invalid format)")
  }

  const amount = params.amount
  if (amount && (isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0)) {
    result.paramsValid = false
    result.tamperedFields.push("amount (invalid value)")
  }

  if (to) {
    const homoglyphs = /[аеіоурсхАЕІОУРСХ]/
    if (homoglyphs.test(to)) {
      result.paramsValid = false
      result.tamperedFields.push("to (contains suspicious characters)")
    }
  }

  const exp = params.exp
  if (exp) {
    const expiry = Number.parseInt(exp)
    if (!isNaN(expiry) && Date.now() > expiry) {
      result.expired = true
    }
  }

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
        result.signatureValid = false
      }
    } catch {
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
  const { isConnected, address: activeAddress, wallets, activeChain, chainId, switchNetwork } = useUnifiedWallet()
  const { toast } = useToast()
  const { isDemoMode } = useDemo()

  // Detect mode: form (no URL params) vs link (URL params present)
  const hasPaymentLinkParams = searchParams.has("to") || searchParams.has("invoice")

  // Shared state
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [txHash, setTxHash] = useState("")

  // Link mode state
  const [loading, setLoading] = useState(hasPaymentLinkParams)
  const [securityChecked, setSecurityChecked] = useState(!hasPaymentLinkParams)
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([])
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [transactionLock, setTransactionLock] = useState<TransactionLock | null>(null)
  const [verificationResult, setVerificationResult] = useState<PaymentVerification | null>(null)
  const [feeEstimate, setFeeEstimate] = useState<{ finalFee: number } | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Form mode state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [formTo, setFormTo] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formToken, setFormToken] = useState<"USDC" | "USDT" | "DAI" | "HSK">("USDC")
  const [formMemo, setFormMemo] = useState("")
  const [formPurpose, setFormPurpose] = useState("")
  const [formGroupId, setFormGroupId] = useState<string | undefined>()
  const [addressError, setAddressError] = useState("")
  const [amountError, setAmountError] = useState("")
  const [showContacts, setShowContacts] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Detect recipient address network type
  const recipientAddressType = formTo ? detectAddressType(formTo) : null
  const isTronPayment = recipientAddressType === "TRON" || activeChain === "TRON"

  // Payment history for form mode (use active wallet address)
  const activeWalletAddress = wallets[activeChain] || wallets.EVM || undefined
  const { payments: historyPayments, loading: historyLoading, refresh: refreshHistory } = usePaymentHistory({
    isDemoMode,
    walletAddress: activeWalletAddress,
    type: "sent",
  })

  // Contacts for form mode
  const { vendors, loading: vendorsLoading } = useVendors({
    isDemoMode,
    walletAddress: activeWalletAddress,
  })

  // URL params (link mode)
  const invoiceId = searchParams.get("invoice")
  const linkTo = invoice?.recipient_address || searchParams.get("to")
  const linkAmount = invoice?.amount?.toString() || searchParams.get("amount")
  const linkToken = (invoice?.token || searchParams.get("token")) as "USDC" | "USDT" | "DAI" | "HSK" | null
  const networkParam = searchParams.get("network")
  const sig = searchParams.get("sig")
  const exp = searchParams.get("exp")
  const merchantName = invoice?.merchant_name
  const description = invoice?.description

  // Resolved variables — bridge both modes
  const to = hasPaymentLinkParams ? linkTo : formTo
  const amount = hasPaymentLinkParams ? linkAmount : formAmount
  const token = hasPaymentLinkParams ? linkToken : formToken

  const isValid = to && amount && token
  // Detect if target address is TRON (for link mode)
  const resolvedIsTron = to ? detectAddressType(to) === "TRON" : isTronPayment
  const isUSDC = token === "USDC"
  const isGasless = isUSDC && activeChain === "EVM" && !resolvedIsTron

  // Form validation
  useEffect(() => {
    if (hasPaymentLinkParams) return
    if (formTo && !isValidAddress(formTo)) {
      setAddressError("Invalid address format (supports EVM 0x... and TRON T...)")
    } else {
      setAddressError("")
    }
  }, [formTo, hasPaymentLinkParams])

  useEffect(() => {
    if (hasPaymentLinkParams) return
    if (formAmount && !isValidAmount(formAmount)) {
      setAmountError("Invalid amount")
    } else {
      setAmountError("")
    }
  }, [formAmount, hasPaymentLinkParams])

  // Balance fetch for form mode
  useEffect(() => {
    async function fetchBalance() {
      if (hasPaymentLinkParams) return
      // Skip balance fetch for TRON (handled by TronLink wallet)
      if (isTronPayment) {
        setTokenBalance(null)
        return
      }
      if (!wallets.EVM || !chainId) return
      setBalanceLoading(true)
      try {
        const tokenAddr = getTokenAddress(chainId, formToken)
        if (tokenAddr) {
          const bal = await getTokenBalance(wallets.EVM, tokenAddr)
          setTokenBalance(bal)
        } else {
          setTokenBalance(null)
        }
      } catch {
        setTokenBalance(null)
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchBalance()
  }, [formToken, chainId, wallets.EVM, hasPaymentLinkParams, isTronPayment])

  // Invoice fetch (link mode only)
  useEffect(() => {
    if (invoiceId && sig) {
      setInvoiceLoading(true)
      fetch(`/api/invoice?id=${invoiceId}&sig=${sig}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            toast({ title: "Invalid Invoice", description: data.error, variant: "destructive" })
          } else {
            setInvoice(data)
          }
        })
        .catch((err) => console.error("[Pay] Invoice fetch error:", err))
        .finally(() => setInvoiceLoading(false))
    }
  }, [invoiceId, sig, toast])

  // Link verification (link mode only)
  useEffect(() => {
    if (!hasPaymentLinkParams) return

    async function verifyLink() {
      const params: Record<string, string | null> = {
        to: linkTo, amount: linkAmount, token: linkToken, network: networkParam, sig, exp,
      }
      const verification = await verifyPaymentLink(params)
      setVerificationResult(verification)

      const warnings: string[] = []
      if (verification.expired) warnings.push("This payment link has expired")
      if (!verification.signatureValid && sig) warnings.push("Payment link signature is invalid - link may have been tampered with")
      if (verification.tamperedFields.length > 0) warnings.push(`Invalid parameters detected: ${verification.tamperedFields.join(", ")}`)
      if (!sig) warnings.push("This payment link is unsigned - verify the recipient address carefully")

      setSecurityWarnings(warnings)
      setSecurityChecked(true)
      setLoading(false)
    }
    verifyLink()
  }, [linkTo, linkAmount, linkToken, networkParam, sig, exp, hasPaymentLinkParams])

  // Fee estimation (EVM only, skip for TRON)
  useEffect(() => {
    async function estimateFee() {
      if (amount && wallets.EVM && !resolvedIsTron) {
        try {
          const fee = await calculateFee(Number(amount), wallets.EVM, "standard")
          setFeeEstimate(fee)
        } catch {
          // Fee estimation non-critical
        }
      } else {
        setFeeEstimate(null)
      }
    }
    estimateFee()
  }, [amount, wallets.EVM, resolvedIsTron])

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
      if (Date.now() - lock.createdAt > 30000) {
        toast({ title: "Transaction Expired", description: "Please try again - the transaction lock has expired.", variant: "destructive" })
        return false
      }
      if (lock.params.to !== to || lock.params.amount !== amount || lock.params.token !== token) {
        toast({ title: "Security Alert", description: "Transaction parameters changed during processing - aborting for safety.", variant: "destructive" })
        return false
      }
      return true
    },
    [to, amount, token, toast],
  )

  const handlePayment = async () => {
    // Demo/test mode bypass
    if (isDemoMode) {
      setProcessing(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      const demoHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
      setTxHash(demoHash)
      setCompleted(true)
      toast({ title: "Payment Successful (Test Mode)", description: "Simulated payment completed." })
      setProcessing(false)
      return
    }

    if (!isConnected || !activeAddress) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet to continue.", variant: "destructive" })
      return
    }

    // Security warnings only apply in link mode
    if (hasPaymentLinkParams && securityWarnings.length > 0 && !showSecurityModal) {
      setShowSecurityModal(true)
      return
    }

    const lock = createLock()
    if (!lock) {
      toast({ title: "Error", description: "Failed to create transaction lock.", variant: "destructive" })
      return
    }

    setProcessing(true)
    try {
      if (!verifyLock(lock)) { setProcessing(false); return }

      // Pre-payment risk screening on recipient address
      if (to) {
        try {
          const riskRes = await fetch(`/api/risk?view=screen&address=${encodeURIComponent(to)}`, {
            headers: authHeaders(activeAddress),
          })
          if (riskRes.ok) {
            const riskData = await riskRes.json()
            if (riskData.result === "match") {
              toast({
                title: "Payment Blocked",
                description: "Recipient address flagged on sanctions list. Transaction cannot proceed.",
                variant: "destructive",
              })
              setProcessing(false)
              return
            }
            if (riskData.result === "potential_match") {
              toast({
                title: "Risk Warning",
                description: "Recipient address has a potential compliance flag. Proceeding with caution.",
              })
            }
          }
        } catch {
          // Non-blocking: proceed if risk API is unavailable
        }
      }

      // Determine if this is a TRON payment based on recipient address
      const paymentIsTron = to ? detectAddressType(to) === "TRON" : false
      const senderAddress = paymentIsTron ? wallets.TRON : wallets.EVM

      if (!senderAddress) {
        throw new Error(paymentIsTron
          ? "Please connect your TronLink wallet to send TRON payments"
          : "Please connect your EVM wallet to send payments")
      }

      // URL param tampering check (link mode only)
      if (hasPaymentLinkParams) {
        const currentTo = searchParams.get("to")
        const currentAmount = searchParams.get("amount")
        if (currentTo !== to || currentAmount !== amount) {
          throw new Error("Transaction parameters were modified - possible attack detected")
        }
      }

      let hash = ""
      let tokenAddress = ""

      if (paymentIsTron) {
        // === TRON Payment Flow ===
        const tronTokenAddr = getTronTokenAddress("tron", token || "USDT")
        if (!tronTokenAddr) throw new Error(`Token ${token} not supported on TRON network`)
        tokenAddress = tronTokenAddr

        toast({ title: "Confirm in TronLink", description: "Please confirm the transaction in your TronLink wallet." })

        if (!verifyLock(lock)) { setProcessing(false); return }

        try {
          hash = await sendTRC20(tronTokenAddr, to!, amount!)
        } catch (tronError: any) {
          throw new Error(tronError.action
            ? `${tronError.message}. ${tronError.action}`
            : `TRON transfer failed: ${tronError.message}`)
        }
      } else {
        // === EVM Payment Flow ===
        tokenAddress = getTokenAddress(chainId, token || "USDC") || ""
        if (!tokenAddress) throw new Error("Token not supported on this network")

        // Balance check (EVM only)
        try {
          const balance = await getTokenBalance(wallets.EVM!, tokenAddress)
          if (parseFloat(balance) < parseFloat(amount!)) {
            toast({
              title: "Insufficient Balance",
              description: `You need ${amount} ${token} but only have ${parseFloat(balance).toFixed(6)} ${token}`,
              variant: "destructive",
            })
            setProcessing(false)
            return
          }
        } catch {
          toast({ title: "Balance Check Failed", description: "Unable to verify balance.", variant: "destructive" })
          setProcessing(false)
          return
        }

        if (isGasless) {
          toast({ title: "Signing Authorization", description: "Please sign the x402 payment authorization." })
          const auth = await signERC3009Authorization(tokenAddress, wallets.EVM!, to!, amount!, chainId)

          if (!verifyLock(lock)) { setProcessing(false); return }

          toast({ title: "Processing Payment", description: "Submitting your secure payment..." })

          try {
            hash = await executeERC3009Transfer(tokenAddress, wallets.EVM!, to!, amount!, auth)
          } catch (erc3009Error: any) {
            throw new Error(`ERC-3009 transfer failed: ${erc3009Error.message}`)
          }

          // x402 settlement (non-blocking)
          try {
            await fetch("/api/x402/settle", {
              method: "POST",
              headers: authHeaders(senderAddress, { "Content-Type": "application/json" }, { isDemoMode }),
              body: JSON.stringify({
                authorizationId: auth.nonce || `auth_${Date.now()}`,
                transactionHash: hash, chainId, amount: amount!, token: token || "USDC",
                from: wallets.EVM, to: to!,
              }),
            })
          } catch {
            // Non-blocking
          }
        } else {
          toast({ title: "Confirm Transaction", description: "Please confirm the transaction in your wallet." })

          if (!verifyLock(lock)) { setProcessing(false); return }

          try {
            hash = await sendToken(tokenAddress, to!, amount!)
          } catch (sendError: any) {
            throw new Error(`Transaction failed: ${sendError.message}`)
          }
        }
      }

      // Record payment to database
      try {
        const payload: Record<string, unknown> = {
          tx_hash: hash,
          from_address: senderAddress,
          to_address: to,
          token_symbol: token,
          token: tokenAddress,
          amount: amount,
          amount_usd: Number(amount),
          chain: paymentIsTron ? "tron" : chainId.toString(),
          network_type: paymentIsTron ? "TRON" : "EVM",
          type: "sent",
          status: "completed",
          ...(formMemo && { memo: formMemo }),
          ...(formPurpose && { purpose: formPurpose }),
          ...(formGroupId && { group_id: formGroupId }),
        }

        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: authHeaders(senderAddress, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        })

        if (response.ok) {
          const { payment: paymentData } = await response.json()
          if (paymentData) {
            await recordFee({
              paymentId: paymentData.id,
              amount: Number(amount),
              fromAddress: senderAddress!,
              tokenSymbol: token!,
              chainId: paymentIsTron ? 728126428 : chainId,
              tier: "standard",
              collectionMethod: "deferred",
            })
          }
        }
      } catch (dbError) {
        console.error("[Pay] Database recording failed:", dbError)
        try {
          await fetch('/api/payment/retry-queue', {
            method: 'POST',
            headers: authHeaders(senderAddress, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              txHash: hash,
              paymentData: {
                tx_hash: hash, from_address: senderAddress, to_address: to,
                token_symbol: token, token_address: tokenAddress,
                amount: amount, amount_usd: Number(amount), status: "completed",
              }
            })
          })
        } catch {
          // Retry queue also failed, but payment succeeded on-chain
        }
      }

      setTxHash(hash)
      setCompleted(true)
      toast({ title: "Payment Successful", description: "Your payment has been processed securely." })
    } catch (error: any) {
      console.error("Payment failed:", error)
      toast({ title: "Payment Failed", description: error.message || "Something went wrong.", variant: "destructive" })
    } finally {
      setProcessing(false)
      setTransactionLock(null)
    }
  }

  const handleSecurityConfirm = () => {
    setShowSecurityModal(false)
    handlePayment()
  }

  const resetForm = () => {
    setCompleted(false)
    setTxHash("")
    setFormTo("")
    setFormAmount("")
    setFormToken("USDC")
    setFormMemo("")
    setFormPurpose("")
    setFormGroupId(undefined)
    setShowPaymentDialog(false)
    refreshHistory()
  }

  // Play success sound when completed
  useEffect(() => {
    if (completed) {
      sonicBranding.play("personal-success")
    }
  }, [completed])

  // === SUCCESS SCREEN (shared) ===
  if (completed) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <GlassCard className="border-green-500/20 bg-green-500/5">
          <GlassCardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <GlassCardTitle className="text-green-500">Payment Successful</GlassCardTitle>
            <GlassCardDescription>Your payment has been processed.</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="rounded-lg bg-card border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">{amount} {token}</span>
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
            {hasPaymentLinkParams ? (
              <Button className="w-full bg-transparent" variant="outline" onClick={() => window.close()}>
                Close Window
              </Button>
            ) : (
              <Button className="w-full" variant="outline" onClick={resetForm}>
                <Send className="mr-2 h-4 w-4" />
                Send Another Payment
              </Button>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  // === LINK MODE: Loading / Error guards ===
  if (hasPaymentLinkParams) {
    if (loading || invoiceLoading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          {invoiceLoading && <p className="ml-3 text-sm text-muted-foreground">Loading invoice...</p>}
        </div>
      )
    }

    if (verificationResult?.expired) {
      return (
        <div className="container max-w-md mx-auto py-20 px-4">
          <GlassCard className="border-destructive/20 bg-destructive/5">
            <GlassCardHeader>
              <GlassCardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Payment Link Expired
              </GlassCardTitle>
              <GlassCardDescription>
                This payment link has expired. Please request a new payment link from the recipient.
              </GlassCardDescription>
            </GlassCardHeader>
          </GlassCard>
        </div>
      )
    }

    if (!isValid || (verificationResult && !verificationResult.paramsValid)) {
      return (
        <div className="container max-w-md mx-auto py-20 px-4">
          <GlassCard className="border-destructive/20 bg-destructive/5">
            <GlassCardHeader>
              <GlassCardTitle className="text-destructive flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Invalid Payment Link
              </GlassCardTitle>
              <GlassCardDescription>
                {verificationResult?.tamperedFields && verificationResult.tamperedFields.length > 0
                  ? `Security check failed: ${verificationResult.tamperedFields.join(", ")}`
                  : "The payment link is missing required information. Please check the URL and try again."}
              </GlassCardDescription>
            </GlassCardHeader>
          </GlassCard>
        </div>
      )
    }

    // === LINK MODE: Payment card ===
    return (
      <div className="container max-w-lg mx-auto py-20 px-4">
        {showSecurityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <GlassCard className="max-w-md w-full border-yellow-500/20 bg-card">
              <GlassCardHeader>
                <GlassCardTitle className="text-yellow-500 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Security Warnings
                </GlassCardTitle>
                <GlassCardDescription>Please review the following warnings before proceeding:</GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div className="space-y-2">
                  {securityWarnings.map((warning, i) => (
                    <Alert key={i} className="bg-yellow-500/5 border-yellow-500/20">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-sm">{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowSecurityModal(false)}>Cancel</Button>
                  <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black" onClick={handleSecurityConfirm}>I Understand, Proceed</Button>
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>
        )}

        <GlassCard className="border-border shadow-lg">
          <GlassCardHeader className="text-center border-b border-border/50 pb-8">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <GlassCardTitle className="text-2xl">{merchantName || "Payment Request"}</GlassCardTitle>
            <GlassCardDescription>
              {description || (
                <>You are paying{" "}<span className="text-foreground font-medium">{amount} {token}</span></>
              )}
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="pt-8 space-y-6">
            <div className="flex items-center justify-center gap-2">
              {securityWarnings.length === 0 ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <ShieldCheck className="h-3 w-3 mr-1" />Security Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  <ShieldAlert className="h-3 w-3 mr-1" />{securityWarnings.length} Warning{securityWarnings.length > 1 ? "s" : ""}
                </Badge>
              )}
              {sig && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Eye className="h-3 w-3 mr-1" />Signed Link
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-mono text-xs bg-background px-2 py-1 rounded border truncate max-w-[180px]">{to}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-lg">{amount} <span className="text-sm text-muted-foreground">{token}</span></span>
                </div>
                {isGasless && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">x402 Protocol</Badge>
                    <span className="text-xs text-muted-foreground">Gasless payment enabled</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Settlement Method</span>
                  <SettlementMethodBadge method={chainId === 8453 ? "cdp" : "relayer"} chainId={chainId} />
                </div>
              </div>

              {amount && Number(amount) > 0 && wallets.EVM && (
                <FeePreview amount={Number(amount)} walletAddress={wallets.EVM} tokenSymbol={token || "USDC"} compact={true} />
              )}

              {!isConnected && (
                <Alert className="bg-primary/5 border-primary/20">
                  <AlertTitle>Connect Wallet</AlertTitle>
                  <AlertDescription className="text-muted-foreground">Connect your wallet to complete this payment securely.</AlertDescription>
                </Alert>
              )}
            </div>

            <Button size="lg" className="w-full" onClick={handlePayment} disabled={!isConnected || processing}>
              {processing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <>Pay {amount} {token}{feeEstimate && <span className="text-xs ml-1 opacity-70">(+${feeEstimate.finalFee.toFixed(2)} fee)</span>}</>
              )}
            </Button>
          </GlassCardContent>
        </GlassCard>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <span className="font-bold text-foreground">x402 Protocol</span>
          </div>
        </div>
      </div>
    )
  }

  // === FORM MODE: History-first with payment dialog ===
  const formIsValid = formTo && isValidAddress(formTo) && formAmount && isValidAmount(formAmount) && formToken && !addressError && !amountError
  const chainInfo = getChainInfo(chainId)
  // Network display name: auto-detect from recipient address or show connected chain
  const networkDisplayName = isTronPayment ? "TRON" : (chainInfo?.name || `Chain ${chainId}`)

  // Map history payments for PaymentActivity component
  const activityPayments = historyPayments.map((p) => ({
    id: p.id,
    timestamp: p.timestamp || p.created_at,
    from_address: p.from_address,
    to_address: p.to_address,
    amount: String(p.amount),
    amount_usd: p.amount_usd || Number(p.amount),
    status: p.status,
    token_symbol: p.token_symbol || p.token,
    tx_hash: p.tx_hash,
    notes: p.notes,
    memo: p.memo,
    category: p.category,
    vendor: p.vendor_name ? { name: p.vendor_name } : undefined,
  }))

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header with Initiate Payment button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Payments</h1>
            <p className="text-sm text-muted-foreground">Send crypto to any wallet address</p>
          </div>
        </div>
        <Button onClick={() => setShowPaymentDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Initiate Payment
        </Button>
      </div>

      {/* Test Mode Indicator */}
      {isDemoMode && (
        <Alert className="bg-yellow-500/5 border-yellow-500/20">
          <AlertDescription className="text-sm text-yellow-600">
            Test Mode — transactions will be simulated
          </AlertDescription>
        </Alert>
      )}

      {/* Payment History */}
      <PaymentActivity
        payments={activityPayments}
        walletAddress={activeWalletAddress}
        loading={historyLoading}
        showAll
        title="Payment History"
        description="Your sent payment activity"
      />

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Payment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Network Selector */}
            <div className="space-y-2">
              <Label>Network</Label>
              {isTronPayment ? (
                <div className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">Auto-detected</span>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">TRON</Badge>
                </div>
              ) : (
                <Select
                  value={chainId.toString()}
                  onValueChange={(v) => {
                    const targetChainId = parseInt(v)
                    if (targetChainId !== chainId) {
                      switchNetwork(targetChainId)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id.toString()}>
                        {chain.icon} {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Recipient Address */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="recipient">Recipient Address</Label>
                {vendors.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowContacts(!showContacts)}>
                    <Users className="h-3 w-3 mr-1" />
                    Contacts
                  </Button>
                )}
              </div>
              <Input
                id="recipient"
                placeholder="0x... (EVM) or T... (TRON)"
                value={formTo}
                onChange={(e) => setFormTo(e.target.value.trim())}
                className={`font-mono ${addressError ? "border-destructive" : ""}`}
              />
              {formTo && !addressError && recipientAddressType && (
                <p className="text-xs text-muted-foreground">
                  Detected: <span className="font-medium text-foreground">{recipientAddressType === "TRON" ? "TRON Network" : networkDisplayName}</span>
                </p>
              )}
              {addressError && <p className="text-sm text-destructive">{addressError}</p>}

              {/* Contact Picker */}
              {showContacts && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {vendorsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading contacts...</div>
                  ) : vendors.filter(v => v.wallet_address && isValidAddress(v.wallet_address)).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No contacts with valid addresses</div>
                  ) : (
                    vendors
                      .filter(v => v.wallet_address && isValidAddress(v.wallet_address))
                      .slice(0, 10)
                      .map((vendor) => {
                        const addrType = detectAddressType(vendor.wallet_address)
                        return (
                          <button
                            key={vendor.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between items-center border-b last:border-b-0"
                            onClick={() => { setFormTo(vendor.wallet_address); setShowContacts(false) }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{getVendorDisplayName(vendor)}</span>
                              <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{addrType}</span>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                              {vendor.wallet_address.slice(0, 6)}...{vendor.wallet_address.slice(-4)}
                            </span>
                          </button>
                        )
                      })
                  )}
                </div>
              )}
            </div>

            {/* Token + Amount */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Token</Label>
                <Select value={formToken} onValueChange={(v) => setFormToken(v as "USDC" | "USDT" | "DAI" | "HSK")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isTronPayment ? (
                      <>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="USDC">USDC</SelectItem>
                      </>
                    ) : (
                      <>
                        {getTokensForChain(chainId as SupportedChainId).map((t) => (
                          <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
                        ))}
                        {getTokensForChain(chainId as SupportedChainId).length === 0 && (
                          <>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="USDT">USDT</SelectItem>
                          </>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount</Label>
                  {isConnected && tokenBalance !== null && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setFormAmount(tokenBalance)}
                    >
                      Bal: {balanceLoading ? "..." : parseFloat(tokenBalance).toFixed(2)} {formToken}
                    </button>
                  )}
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className={amountError ? "border-destructive" : ""}
                />
                {amountError && <p className="text-sm text-destructive">{amountError}</p>}
              </div>
            </div>

            {/* Purpose Tag */}
            <div className="space-y-2">
              <Label>Purpose</Label>
              <PurposeTagSelector value={formPurpose} onChange={setFormPurpose} />
            </div>

            {/* Payment Group */}
            <div className="space-y-2">
              <Label>Payment Group (optional)</Label>
              <PaymentGroupSelector
                ownerAddress={activeWalletAddress || ""}
                value={formGroupId}
                onChange={setFormGroupId}
              />
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label htmlFor="memo">Memo / Note</Label>
              <Textarea
                id="memo"
                placeholder="Add a note for this payment..."
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Gasless Badge */}
            {isGasless && (
              <div className="flex items-center gap-2 py-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">x402 Protocol</Badge>
                <span className="text-xs text-muted-foreground">Gasless payment enabled</span>
              </div>
            )}

            {/* TRON energy notice */}
            {isTronPayment && (
              <div className="flex items-center gap-2 py-2">
                <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">TRON TRC20</Badge>
                <span className="text-xs text-muted-foreground">Requires energy/bandwidth (TronLink)</span>
              </div>
            )}

            {/* Settlement Method */}
            <div className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-md">
              <span className="text-muted-foreground">Settlement</span>
              {isTronPayment ? (
                <Badge variant="secondary">TRON Direct</Badge>
              ) : (
                <SettlementMethodBadge method={chainId === 8453 ? "cdp" : "relayer"} chainId={chainId} />
              )}
            </div>

            {/* Fee Preview (EVM only) */}
            {!isTronPayment && formAmount && Number(formAmount) > 0 && wallets.EVM && (
              <FeePreview amount={Number(formAmount)} walletAddress={wallets.EVM} tokenSymbol={formToken} compact={true} />
            )}

            {/* Connect Wallet Prompt */}
            {!isConnected && !isDemoMode && (
              <Alert className="bg-primary/5 border-primary/20">
                <AlertTitle>Connect Wallet</AlertTitle>
                <AlertDescription>
                  {isTronPayment
                    ? "Connect your TronLink wallet to send TRON payments."
                    : "Connect your wallet to send payments."}
                </AlertDescription>
              </Alert>
            )}

            {/* TRON wallet not connected warning */}
            {isTronPayment && isConnected && !wallets.TRON && (
              <Alert className="bg-yellow-500/5 border-yellow-500/20">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-sm text-yellow-600">
                  TronLink wallet not detected. Please install TronLink and connect to send TRON payments.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handlePayment}
              disabled={(!isConnected && !isDemoMode) || processing || !formIsValid || (isTronPayment && !wallets.TRON && !isDemoMode)}
            >
              {processing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send {formAmount ? `${formAmount} ${formToken}` : "Payment"}
                  {isTronPayment && <span className="text-xs ml-1 opacity-70">(TRON)</span>}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
