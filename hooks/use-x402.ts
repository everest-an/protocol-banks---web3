"use client"

import { useState, useCallback, useMemo } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { X402Client, type X402PaymentRequest } from "@/lib/x402-client"
import { CHAIN_IDS } from "@/lib/web3"

export interface UseX402Options {
  autoSign?: boolean
  maxAutoAmount?: number
}

export interface UseX402Return {
  client: X402Client | null
  isReady: boolean
  pendingPayment: X402PaymentRequest | null
  isProcessing: boolean
  fetch: (url: string, options?: RequestInit) => Promise<Response>
  approvePayment: () => Promise<void>
  rejectPayment: () => void
}

/**
 * Hook for x402 Payment Required protocol
 * Automatically handles HTTP 402 responses with payment flow
 */
export function useX402(options: UseX402Options = {}): UseX402Return {
  const { address, chainId } = useWeb3()
  const { toast } = useToast()
  const [pendingPayment, setPendingPayment] = useState<X402PaymentRequest | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingResolve, setPendingResolve] = useState<((value: boolean) => void) | null>(null)

  const client = useMemo(() => {
    if (!address) return null
    return new X402Client({
      walletAddress: address,
      chainId: chainId || CHAIN_IDS.BASE,
      autoSign: options.autoSign ?? false,
      maxAutoAmount: options.maxAutoAmount ?? 1,
    })
  }, [address, chainId, options.autoSign, options.maxAutoAmount])

  const isReady = !!client

  const handlePaymentRequired = useCallback(
    async (request: X402PaymentRequest): Promise<boolean> => {
      // For small amounts with auto-sign enabled, approve automatically
      if (options.autoSign && Number.parseFloat(request.amount) <= (options.maxAutoAmount ?? 1)) {
        return true
      }

      // Show payment request to user
      setPendingPayment(request)

      // Wait for user decision
      return new Promise<boolean>((resolve) => {
        setPendingResolve(() => resolve)
      })
    },
    [options.autoSign, options.maxAutoAmount],
  )

  const x402Fetch = useCallback(
    async (url: string, fetchOptions?: RequestInit): Promise<Response> => {
      if (!client) {
        throw new Error("Wallet not connected")
      }

      setIsProcessing(true)

      try {
        const response = await client.fetch(url, fetchOptions, handlePaymentRequired)
        return response
      } catch (error: any) {
        if (error.message === "Payment declined by user") {
          toast({
            title: "Payment Declined",
            description: "You declined the payment request",
          })
        } else {
          toast({
            title: "Request Failed",
            description: error.message || "Failed to complete x402 request",
            variant: "destructive",
          })
        }
        throw error
      } finally {
        setIsProcessing(false)
        setPendingPayment(null)
        setPendingResolve(null)
      }
    },
    [client, handlePaymentRequired, toast],
  )

  const approvePayment = useCallback(async () => {
    if (pendingResolve) {
      pendingResolve(true)
    }
  }, [pendingResolve])

  const rejectPayment = useCallback(() => {
    if (pendingResolve) {
      pendingResolve(false)
    }
    setPendingPayment(null)
    setPendingResolve(null)
  }, [pendingResolve])

  return {
    client,
    isReady,
    pendingPayment,
    isProcessing,
    fetch: x402Fetch,
    approvePayment,
    rejectPayment,
  }
}
