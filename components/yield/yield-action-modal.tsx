/**
 * Yield Action Modal
 *
 * 存款/提现弹窗 - 支持 EVM (Aave V3) 和 TRON (JustLend)
 */

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react"

export type YieldActionType = "deposit" | "withdraw"

export interface YieldActionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: YieldActionType
  network: string
  networkType: "EVM" | "TRON"
  protocol: string
  /** Current principal balance (for withdraw max) */
  principal?: string
  /** Current total balance including interest */
  totalBalance?: string
  /** Wallet address */
  wallet: string
  /** Called after successful submission */
  onSuccess?: () => void
}

const NETWORK_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  tron: "TRON",
  "tron-nile": "TRON Nile",
}

type ModalStep = "input" | "submitting" | "success" | "error"

export function YieldActionModal({
  open,
  onOpenChange,
  action,
  network,
  networkType,
  protocol,
  principal = "0",
  totalBalance = "0",
  wallet,
  onSuccess,
}: YieldActionModalProps) {
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<ModalStep>("input")
  const [errorMsg, setErrorMsg] = useState("")
  const [fullWithdraw, setFullWithdraw] = useState(false)

  const isDeposit = action === "deposit"
  const networkName = NETWORK_NAMES[network] || network
  const maxAmount = parseFloat(totalBalance)

  const resetState = () => {
    setAmount("")
    setStep("input")
    setErrorMsg("")
    setFullWithdraw(false)
  }

  const handleClose = (open: boolean) => {
    if (!open) resetState()
    onOpenChange(open)
  }

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount)

    // Validation
    if (isDeposit) {
      if (!parsedAmount || parsedAmount < 1) {
        setErrorMsg("Minimum deposit is 1 USDT")
        return
      }
    } else {
      if (!fullWithdraw && (!parsedAmount || parsedAmount <= 0)) {
        setErrorMsg("Enter a valid withdrawal amount")
        return
      }
      if (!fullWithdraw && parsedAmount > maxAmount) {
        setErrorMsg(`Maximum withdrawal is ${maxAmount.toFixed(2)} USDT`)
        return
      }
    }

    setErrorMsg("")
    setStep("submitting")

    try {
      const endpoint = isDeposit ? "/api/yield/deposit" : "/api/yield/withdraw"
      const body = {
        merchant: wallet,
        network,
        amount: fullWithdraw ? "0" : amount,
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-address": wallet,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Operation failed")
      }

      setStep("success")
      onSuccess?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error")
      setStep("error")
    }
  }

  const handleSetMax = () => {
    if (isDeposit) return
    setFullWithdraw(true)
    setAmount(maxAmount.toFixed(6))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDeposit ? (
              <ArrowUpRight className="h-5 w-5 text-blue-500" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 text-amber-500" />
            )}
            {isDeposit ? "Deposit" : "Withdraw"} USDT
          </DialogTitle>
          <DialogDescription>
            {isDeposit
              ? `Deposit USDT into ${protocol} on ${networkName} to earn yield`
              : `Withdraw USDT from ${protocol} on ${networkName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Network info */}
        <div className="flex items-center gap-2 py-2">
          <Badge variant="outline" className="text-xs">
            {networkName}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {protocol}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {networkType}
          </Badge>
        </div>

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-4">
            {/* Balance display for withdraw */}
            {!isDeposit && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available Balance</span>
                  <span className="font-mono font-medium">
                    ${maxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Principal</span>
                  <span className="font-mono">
                    ${parseFloat(principal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT
                  </span>
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="yield-amount">Amount (USDT)</Label>
              <div className="relative">
                <Input
                  id="yield-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder={isDeposit ? "Min 1.00 USDT" : "0.00"}
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^\d*\.?\d{0,6}$/.test(val) || val === "") {
                      setAmount(val)
                      setFullWithdraw(false)
                    }
                  }}
                  className="pr-16 font-mono"
                />
                {!isDeposit && maxAmount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-blue-500 hover:text-blue-600"
                    onClick={handleSetMax}
                  >
                    MAX
                  </Button>
                )}
              </div>
            </div>

            {/* Min deposit info */}
            {isDeposit && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                Minimum deposit: 1 USDT. On-chain transaction requires wallet signature.
              </div>
            )}

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errorMsg}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className={cn(
                  isDeposit
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-amber-600 hover:bg-amber-700",
                  "text-white"
                )}
              >
                {isDeposit ? (
                  <>
                    <ArrowUpRight className="h-4 w-4 mr-1.5" />
                    Deposit
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="h-4 w-4 mr-1.5" />
                    {fullWithdraw ? "Withdraw All" : "Withdraw"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Submitting */}
        {step === "submitting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <div className="text-center space-y-1">
              <p className="font-medium">
                {isDeposit ? "Recording deposit..." : "Processing withdrawal..."}
              </p>
              <p className="text-sm text-muted-foreground">
                Please wait while we update the records
              </p>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div className="text-center space-y-1">
              <p className="font-medium">
                {isDeposit ? "Deposit Recorded" : "Withdrawal Complete"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isDeposit
                  ? `${amount} USDT deposit intent recorded for ${networkName}. Execute the on-chain transaction via your wallet.`
                  : `Withdrawal of ${fullWithdraw ? "all funds" : amount + " USDT"} from ${networkName} has been processed.`}
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Done
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div className="text-center space-y-1">
              <p className="font-medium">Operation Failed</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button onClick={() => { setStep("input"); setErrorMsg("") }}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
