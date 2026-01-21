"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Wallet, CreditCard } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface PaymentButtonProps {
  /** Recipient wallet address */
  to: string
  /** Payment amount (optional for donation mode) */
  amount?: string
  /** Token symbol (default: USDC) */
  token?: string
  /** Button label */
  label?: string
  /** Description shown in payment modal */
  description?: string
  /** Merchant/Recipient name */
  merchantName?: string
  /** Allow custom amount input */
  allowCustomAmount?: boolean
  /** Preset amounts for quick selection */
  presetAmounts?: string[]
  /** Callback when payment succeeds */
  onSuccess?: (txHash: string) => void
  /** Callback when payment fails */
  onError?: (error: Error) => void
  /** Custom button className */
  className?: string
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary"
  /** Button size */
  size?: "default" | "sm" | "lg"
  /** Disabled state */
  disabled?: boolean
}

type PaymentStatus = "idle" | "connecting" | "confirming" | "processing" | "success" | "error"

export function PaymentButton({
  to,
  amount,
  token = "USDC",
  label = "Pay",
  description,
  merchantName,
  allowCustomAmount = false,
  presetAmounts = ["5", "10", "25", "50"],
  onSuccess,
  onError,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: PaymentButtonProps) {
  const { isConnected, connectWallet, wallets, activeChain, sendToken } = useWeb3()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<PaymentStatus>("idle")
  const [customAmount, setCustomAmount] = useState(amount || "")
  const [selectedAmount, setSelectedAmount] = useState(amount || "")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const finalAmount = customAmount || selectedAmount || amount

  const handleConnect = useCallback(async () => {
    setStatus("connecting")
    try {
      await connectWallet()
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError("Failed to connect wallet")
    }
  }, [connectWallet])

  const handlePayment = useCallback(async () => {
    if (!finalAmount || !to) {
      setError("Missing payment details")
      return
    }

    setStatus("confirming")
    setError(null)

    try {
      // Request payment confirmation
      setStatus("processing")

      const result = await sendToken(to, parseFloat(finalAmount), token)

      if (result.success && result.txHash) {
        setTxHash(result.txHash)
        setStatus("success")
        onSuccess?.(result.txHash)
        toast({
          title: "Payment Successful",
          description: `Sent ${finalAmount} ${token} to ${merchantName || to.slice(0, 8)}...`,
        })
      } else {
        throw new Error(result.error || "Payment failed")
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Payment failed")
      setError(error.message)
      setStatus("error")
      onError?.(error)
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }, [finalAmount, to, token, sendToken, onSuccess, onError, toast, merchantName])

  const handleClose = () => {
    setIsOpen(false)
    // Reset state after animation
    setTimeout(() => {
      if (status === "success" || status === "error") {
        setStatus("idle")
        setTxHash(null)
        setError(null)
      }
    }, 300)
  }

  const renderContent = () => {
    switch (status) {
      case "connecting":
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Connecting wallet...</p>
          </div>
        )

      case "confirming":
      case "processing":
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {status === "confirming" ? "Waiting for confirmation..." : "Processing payment..."}
            </p>
          </div>
        )

      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Payment Complete!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {finalAmount} {token} sent successfully
              </p>
              {txHash && (
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline mt-2 block"
                >
                  View Transaction
                </a>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">
              Done
            </Button>
          </div>
        )

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <XCircle className="h-16 w-16 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Payment Failed</p>
              <p className="text-muted-foreground text-sm mt-1">{error}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStatus("idle")}>Try Again</Button>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            {/* Payment Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Pay to</p>
                  <p className="font-medium">{merchantName || `${to.slice(0, 8)}...${to.slice(-6)}`}</p>
                </div>
                <Badge variant="secondary">{token}</Badge>
              </div>

              {/* Amount Selection */}
              {!amount && allowCustomAmount && (
                <div className="space-y-3">
                  <Label>Select Amount</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {presetAmounts.map((preset) => (
                      <Button
                        key={preset}
                        variant={selectedAmount === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedAmount(preset)
                          setCustomAmount("")
                        }}
                      >
                        ${preset}
                      </Button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="Custom amount"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value)
                        setSelectedAmount("")
                      }}
                      className="pl-8"
                    />
                  </div>
                </div>
              )}

              {/* Fixed Amount Display */}
              {amount && (
                <div className="text-center py-4">
                  <p className="text-4xl font-bold">${amount}</p>
                  <p className="text-muted-foreground">{token}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!isConnected ? (
              <Button onClick={handleConnect} className="w-full" size="lg">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            ) : (
              <Button
                onClick={handlePayment}
                disabled={!finalAmount || parseFloat(finalAmount) <= 0}
                className="w-full"
                size="lg"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pay {finalAmount ? `$${finalAmount}` : ""} {token}
              </Button>
            )}

            {isConnected && wallets[activeChain] && (
              <p className="text-center text-xs text-muted-foreground">
                Paying from: {wallets[activeChain]?.slice(0, 8)}...{wallets[activeChain]?.slice(-6)}
              </p>
            )}
          </div>
        )
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
      >
        <CreditCard className="h-4 w-4" />
        {label}
        {amount && <span className="font-semibold">${amount}</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {status === "success" ? "Payment Complete" : status === "error" ? "Payment Failed" : "Complete Payment"}
            </DialogTitle>
            {description && status === "idle" && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    </>
  )
}
