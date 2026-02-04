"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ShieldX, X } from "lucide-react"
import type { PreTransactionCheckResult } from "@/lib/security/web3-security"

interface SecurityWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onProceed: () => void
  securityCheck: PreTransactionCheckResult | null
  transactionDetails: {
    type: string
    amount: string
    token: string
    recipient: string
  }
}

export function SecurityWarningModal({
  isOpen,
  onClose,
  onProceed,
  securityCheck,
  transactionDetails,
}: SecurityWarningModalProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  if (!securityCheck) return null

  const getRiskIcon = () => {
    switch (securityCheck.overallRisk) {
      case "safe":
        return <ShieldCheck className="h-12 w-12 text-green-500" />
      case "low":
        return <Shield className="h-12 w-12 text-blue-500" />
      case "medium":
        return <ShieldAlert className="h-12 w-12 text-yellow-500" />
      case "high":
        return <AlertTriangle className="h-12 w-12 text-orange-500" />
      case "critical":
        return <ShieldX className="h-12 w-12 text-red-500" />
    }
  }

  const getRiskBadge = () => {
    const colors = {
      safe: "bg-green-500/20 text-green-400 border-green-500/30",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return <Badge className={`${colors[securityCheck.overallRisk]} uppercase`}>{securityCheck.overallRisk} Risk</Badge>
  }

  const canProceed = securityCheck.canProceed && (acknowledged || securityCheck.overallRisk === "safe")

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl text-white flex items-center gap-3">
              {getRiskIcon()}
              Security Check
            </DialogTitle>
            {getRiskBadge()}
          </div>
          <DialogDescription className="text-zinc-400 pt-2">
            Pre-transaction security analysis for your protection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Summary */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Transaction Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-zinc-500">Type:</span>
              <span className="text-white capitalize">{transactionDetails.type}</span>
              <span className="text-zinc-500">Amount:</span>
              <span className="text-white">
                {transactionDetails.amount} {transactionDetails.token}
              </span>
              <span className="text-zinc-500">Recipient:</span>
              <span className="text-white font-mono text-xs truncate">{transactionDetails.recipient}</span>
            </div>
          </div>

          {/* Blockers */}
          {securityCheck.blockers.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                <X className="h-4 w-4" />
                Transaction Blocked
              </h4>
              <ul className="space-y-1">
                {securityCheck.blockers.map((blocker, i) => (
                  <li key={i} className="text-sm text-red-300">
                    • {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {securityCheck.allWarnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({securityCheck.allWarnings.length})
              </h4>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {securityCheck.allWarnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-300">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Security Checks Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-300">Security Checks</h4>
            <div className="grid gap-2">
              <SecurityCheckItem
                label="Contract Verification"
                status={
                  securityCheck.checks.contractSafety.isVerified
                    ? "pass"
                    : securityCheck.checks.contractSafety.riskLevel === "critical"
                      ? "fail"
                      : "warn"
                }
              />
              <SecurityCheckItem
                label="Double Spend Protection"
                status={securityCheck.checks.doubleSpendCheck.isRisky ? "fail" : "pass"}
              />
              <SecurityCheckItem
                label="Flash Loan Risk"
                status={securityCheck.checks.flashLoanRisk.isRisky ? "warn" : "pass"}
              />
              {securityCheck.checks.approvalAnalysis && (
                <SecurityCheckItem
                  label="Signature Safety"
                  status={
                    securityCheck.checks.approvalAnalysis.riskLevel === "danger"
                      ? "fail"
                      : securityCheck.checks.approvalAnalysis.riskLevel === "warning"
                        ? "warn"
                        : "pass"
                  }
                />
              )}
              {securityCheck.checks.bridgeSecurity && (
                <SecurityCheckItem
                  label="Bridge Security"
                  status={securityCheck.checks.bridgeSecurity.isSafe ? "pass" : "warn"}
                />
              )}
            </div>
          </div>

          {/* Acknowledgment Checkbox */}
          {securityCheck.allWarnings.length > 0 && securityCheck.canProceed && (
            <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-800/50 rounded-lg">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 rounded border-zinc-600"
              />
              <span className="text-sm text-zinc-300">
                I understand the risks and want to proceed with this transaction
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-zinc-700 bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={onProceed}
            disabled={!canProceed}
            className={canProceed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-700 cursor-not-allowed"}
          >
            {canProceed ? "Proceed" : "Cannot Proceed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecurityCheckItem({
  label,
  status,
}: {
  label: string
  status: "pass" | "warn" | "fail"
}) {
  const icons = {
    pass: <ShieldCheck className="h-4 w-4 text-green-500" />,
    warn: <ShieldAlert className="h-4 w-4 text-yellow-500" />,
    fail: <ShieldX className="h-4 w-4 text-red-500" />,
  }
  const colors = {
    pass: "text-green-400",
    warn: "text-yellow-400",
    fail: "text-red-400",
  }

  return (
    <div className="flex items-center justify-between p-2 bg-zinc-800/30 rounded">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className={`flex items-center gap-1 ${colors[status]}`}>
        {icons[status]}
        <span className="text-xs uppercase">{status}</span>
      </div>
    </div>
  )
}
