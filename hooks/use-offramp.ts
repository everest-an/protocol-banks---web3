"use client"

import { useState, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import {
  getOffRampQuote,
  initiateOffRamp,
  getOffRampStatus,
  getOffRampHistory,
  type OffRampProvider,
  type OffRampQuote,
  type OffRampTransaction,
} from "@/lib/offramp"

export interface UseOffRampReturn {
  quote: OffRampQuote | null
  transaction: OffRampTransaction | null
  history: OffRampTransaction[]
  isLoading: boolean
  isQuoting: boolean
  error: string | null
  getQuote: (amount: string, token?: "USDC" | "USDT", currency?: string, provider?: OffRampProvider) => Promise<void>
  initiate: (amount: string, provider: OffRampProvider, currency?: string) => Promise<void>
  checkStatus: (transactionId: string) => Promise<void>
  loadHistory: () => Promise<void>
  reset: () => void
}

/**
 * Hook for off-ramp (crypto to fiat) operations
 */
export function useOffRamp(): UseOffRampReturn {
  const { address, chainId } = useWeb3()
  const { toast } = useToast()
  const [quote, setQuote] = useState<OffRampQuote | null>(null)
  const [transaction, setTransaction] = useState<OffRampTransaction | null>(null)
  const [history, setHistory] = useState<OffRampTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getQuote = useCallback(
    async (
      amount: string,
      token: "USDC" | "USDT" = "USDC",
      currency = "USD",
      provider: OffRampProvider = "coinbase",
    ) => {
      if (!amount || Number.parseFloat(amount) <= 0) {
        setQuote(null)
        return
      }

      setIsQuoting(true)
      setError(null)

      try {
        const newQuote = await getOffRampQuote(amount, token, currency, provider)
        setQuote(newQuote)
      } catch (err: any) {
        setError(err.message || "Failed to get quote")
        toast({
          title: "Quote Failed",
          description: err.message || "Could not get off-ramp quote",
          variant: "destructive",
        })
      } finally {
        setIsQuoting(false)
      }
    },
    [toast],
  )

  const initiate = useCallback(
    async (amount: string, provider: OffRampProvider, currency = "USD") => {
      if (!address) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet first",
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const tx = await initiateOffRamp({
          walletAddress: address,
          amount,
          token: "USDC",
          chainId: chainId || 8453,
          targetCurrency: currency,
          provider,
        })

        setTransaction(tx)

        toast({
          title: "Off-Ramp Initiated",
          description: `Withdrawal of $${amount} initiated via ${provider}`,
        })
      } catch (err: any) {
        setError(err.message || "Failed to initiate off-ramp")
        toast({
          title: "Off-Ramp Failed",
          description: err.message || "Could not initiate withdrawal",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [address, chainId, toast],
  )

  const checkStatus = useCallback(
    async (transactionId: string) => {
      setIsLoading(true)

      try {
        const status = await getOffRampStatus(transactionId)
        if (status) {
          setTransaction(status)
        }
      } catch (err: any) {
        setError(err.message || "Failed to check status")
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const loadHistory = useCallback(async () => {
    if (!address) return

    setIsLoading(true)

    try {
      const txHistory = await getOffRampHistory(address)
      setHistory(txHistory)
    } catch (err: any) {
      setError(err.message || "Failed to load history")
    } finally {
      setIsLoading(false)
    }
  }, [address])

  const reset = useCallback(() => {
    setQuote(null)
    setTransaction(null)
    setError(null)
  }, [])

  return {
    quote,
    transaction,
    history,
    isLoading,
    isQuoting,
    error,
    getQuote,
    initiate,
    checkStatus,
    loadHistory,
    reset,
  }
}
