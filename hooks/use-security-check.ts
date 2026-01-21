"use client"

import { useState, useCallback } from "react"
import { ethers } from "ethers"
import {
  performPreTransactionCheck,
  type PreTransactionCheckResult,
} from "@/lib/web3-security"
import { useWeb3 } from "@/contexts/web3-context"

export interface TransactionDetails {
  type: "transfer" | "swap" | "bridge" | "approval"
  from: string
  to: string
  tokenAddress: string
  amount: string
  token: string
  chainId: number
  destinationChainId?: number
}

export interface UseSecurityCheckReturn {
  isChecking: boolean
  securityResult: PreTransactionCheckResult | null
  transactionDetails: TransactionDetails | null
  showWarning: boolean
  performCheck: (details: TransactionDetails) => Promise<PreTransactionCheckResult | null>
  closeWarning: () => void
  acknowledgeAndProceed: () => void
  resetCheck: () => void
}

export function useSecurityCheck(): UseSecurityCheckReturn {
  const { provider } = useWeb3()
  const [isChecking, setIsChecking] = useState(false)
  const [securityResult, setSecurityResult] = useState<PreTransactionCheckResult | null>(null)
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  const performCheck = useCallback(
    async (details: TransactionDetails): Promise<PreTransactionCheckResult | null> => {
      if (!provider) {
        console.warn("[v0] No provider available for security check")
        return null
      }

      setIsChecking(true)
      setTransactionDetails(details)

      try {
        // Convert amount to bigint (assuming 6 decimals for stablecoins)
        const decimals = details.token === "USDC" || details.token === "USDT" ? 6 : 18
        const amountBigInt = ethers.parseUnits(details.amount, decimals)

        const result = await performPreTransactionCheck(provider as ethers.Provider, {
          type: details.type,
          from: details.from,
          to: details.to,
          tokenAddress: details.tokenAddress,
          amount: amountBigInt,
          chainId: details.chainId,
          destinationChainId: details.destinationChainId,
        })

        setSecurityResult(result)

        // Show warning modal if there are any warnings or blockers
        if (result.allWarnings.length > 0 || result.blockers.length > 0 || result.overallRisk !== "safe") {
          setShowWarning(true)
        }

        return result
      } catch (error) {
        console.error("[v0] Security check failed:", error)
        // Return a safe default if check fails
        const fallbackResult: PreTransactionCheckResult = {
          canProceed: true,
          overallRisk: "low",
          checks: {
            contractSafety: {
              isVerified: false,
              isProxy: false,
              hasUpgradeability: false,
              hasSelfDestruct: false,
              hasDangerousDelegatecall: false,
              riskLevel: "low",
              warnings: ["Security check unavailable - proceeding with caution"],
            },
            doubleSpendCheck: { isRisky: false },
            flashLoanRisk: { isRisky: false, riskFactors: [] },
          },
          allWarnings: ["Security check unavailable - proceeding with caution"],
          blockers: [],
        }
        setSecurityResult(fallbackResult)
        return fallbackResult
      } finally {
        setIsChecking(false)
      }
    },
    [provider]
  )

  const closeWarning = useCallback(() => {
    setShowWarning(false)
  }, [])

  const acknowledgeAndProceed = useCallback(() => {
    setShowWarning(false)
  }, [])

  const resetCheck = useCallback(() => {
    setSecurityResult(null)
    setTransactionDetails(null)
    setShowWarning(false)
    setIsChecking(false)
  }, [])

  return {
    isChecking,
    securityResult,
    transactionDetails,
    showWarning,
    performCheck,
    closeWarning,
    acknowledgeAndProceed,
    resetCheck,
  }
}
