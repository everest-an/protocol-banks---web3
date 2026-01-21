"use client"

import { useState, useCallback } from "react"
import { useSecurityCheck } from "./use-security-check"
import { useAuditLog } from "./use-audit-log"

interface PaymentDetails {
  recipient: string
  amount: number
  token: string
  chainId?: number
  memo?: string
}

interface ConfirmationState {
  step: "idle" | "security-check" | "biometric" | "confirming" | "confirmed" | "failed"
  securityWarnings: string[]
  requiresBiometric: boolean
  error: string | null
}

export function usePaymentConfirmation() {
  const [state, setState] = useState<ConfirmationState>({
    step: "idle",
    securityWarnings: [],
    requiresBiometric: false,
    error: null,
  })
  
  const { performCheck } = useSecurityCheck()
  const { logAction } = useAuditLog()

  const initiateConfirmation = useCallback(async (
    payment: PaymentDetails,
    options?: {
      skipSecurityCheck?: boolean
      skipBiometric?: boolean
    }
  ): Promise<{ approved: boolean; warnings: string[] }> => {
    setState(prev => ({ ...prev, step: "security-check", error: null }))

    try {
      // Step 1: Security Check (unless skipped)
      let warnings: string[] = []
      if (!options?.skipSecurityCheck) {
        const securityResult = await performCheck({
          to: payment.recipient,
          value: payment.amount.toString(),
          chainId: payment.chainId || 8453,
        })
        
        warnings = securityResult.warnings || []
        setState(prev => ({ 
          ...prev, 
          securityWarnings: warnings,
          requiresBiometric: securityResult.riskLevel === "high" || payment.amount > 1000
        }))

        if (securityResult.shouldBlock) {
          setState(prev => ({ ...prev, step: "failed", error: "Transaction blocked due to security concerns" }))
          await logAction("payment_blocked", { payment, reason: "security_check_failed" })
          return { approved: false, warnings }
        }
      }

      // Step 2: Biometric verification for high-value transactions
      const needsBiometric = !options?.skipBiometric && (
        state.requiresBiometric || payment.amount > 1000
      )

      if (needsBiometric) {
        setState(prev => ({ ...prev, step: "biometric" }))
        // The actual biometric check should be handled by the UI component
        // This hook just tracks the state
      }

      // Step 3: Final confirmation
      setState(prev => ({ ...prev, step: "confirming" }))
      
      await logAction("payment_initiated", {
        recipient: payment.recipient,
        amount: payment.amount,
        token: payment.token,
        warnings: warnings.length,
      })

      setState(prev => ({ ...prev, step: "confirmed" }))
      return { approved: true, warnings }

    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        step: "failed", 
        error: error.message || "Confirmation failed" 
      }))
      return { approved: false, warnings: [] }
    }
  }, [performCheck, logAction, state.requiresBiometric])

  const confirmBiometric = useCallback(() => {
    setState(prev => ({ ...prev, step: "confirming" }))
  }, [])

  const cancelBiometric = useCallback(() => {
    setState(prev => ({ ...prev, step: "failed", error: "Biometric verification cancelled" }))
  }, [])

  const reset = useCallback(() => {
    setState({
      step: "idle",
      securityWarnings: [],
      requiresBiometric: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    initiateConfirmation,
    confirmBiometric,
    cancelBiometric,
    reset,
  }
}
