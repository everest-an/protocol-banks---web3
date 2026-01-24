"use client"

import { useState, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { useToast } from "@/hooks/use-toast"
import type { Recipient, PaymentResult } from "@/types"
import { processBatchPayment } from "@/lib/services/payment-service"
import {
  createFailedItem,
  retryFailedItems,
  storeFailedItems,
  type FailedItem,
} from "@/services"

export interface BatchPaymentState {
  isProcessing: boolean
  isRetrying: boolean
  progress: number
  currentIndex: number
  results: PaymentResult[]
  failedItems: FailedItem[]
  error: string | null
  feeBreakdown: {
    totalAmount: string
    totalFees: string
    netAmount: string
  } | null
  report: string | null
}

export interface UseBatchPaymentReturn extends BatchPaymentState {
  executeBatch: (recipients: Recipient[]) => Promise<void>
  retryFailed: () => Promise<void>
  reset: () => void
  downloadReport: () => void
  // API integration methods
  uploadFile: (file: File) => Promise<{ batchId: string; itemCount: number } | null>
  validateBatch: (batchId: string) => Promise<{ valid: boolean; errors: string[] }>
  submitBatch: (batchId: string) => Promise<{ success: boolean; txHash?: string }>
  batchStatus: string | null
  loading: boolean
}

const initialState: BatchPaymentState = {
  isProcessing: false,
  isRetrying: false,
  progress: 0,
  currentIndex: 0,
  results: [],
  failedItems: [],
  error: null,
  feeBreakdown: null,
  report: null,
}

export function useBatchPayment(): UseBatchPaymentReturn {
  const { address } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [state, setState] = useState<BatchPaymentState>(initialState)

  const executeBatch = useCallback(
    async (recipients: Recipient[]) => {
      if (!address) {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        })
        return
      }

      if (recipients.length === 0) {
        toast({
          title: "Error",
          description: "No recipients to process",
          variant: "destructive",
        })
        return
      }

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        progress: 0,
        currentIndex: 0,
        results: [],
        error: null,
      }))

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setState((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 5, 90),
          }))
        }, 200)

        // Execute batch payment using the service layer
        const result = await processBatchPayment(recipients, address, isDemoMode)

        clearInterval(progressInterval)

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          results: result.results,
          feeBreakdown: result.feeBreakdown
            ? {
                totalAmount: result.feeBreakdown.totalAmount?.toString() || "0",
                totalFees: result.feeBreakdown.totalFees?.toString() || "0",
                netAmount: result.feeBreakdown.totalNetAmount?.toString() || "0",
              }
            : null,
          report: result.report || null,
        }))

        // Track failed items for retry
        const failedResults = result.results.filter((r) => !r.success)
        const failedItems: FailedItem[] = failedResults.map((r, idx) => 
          createFailedItem(
            `failed_${Date.now()}_${idx}`,
            r.recipient,
            r.amount,
            r.token || "USDT",
            r.error || "Unknown error"
          )
        )

        if (failedItems.length > 0) {
          setState((prev) => ({ ...prev, failedItems }))
          // Store failed items for later recovery
          await storeFailedItems(failedItems)
        }

        toast({
          title: "Batch Payment Complete",
          description: `${result.successCount} of ${recipients.length} payments successful. Total: $${result.totalPaid}${failedItems.length > 0 ? `. ${failedItems.length} failed - can retry.` : ""}`,
        })
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: error.message || "Batch payment failed",
        }))

        toast({
          title: "Batch Payment Failed",
          description: error.message || "An error occurred during batch processing",
          variant: "destructive",
        })
      }
    },
    [address, isDemoMode, toast],
  )

  const retryFailed = useCallback(async () => {
    if (state.failedItems.length === 0) {
      toast({
        title: "No Failed Items",
        description: "There are no failed payments to retry",
      })
      return
    }

    setState((prev) => ({ ...prev, isRetrying: true, error: null }))

    try {
      const retryResult = await retryFailedItems(
        state.failedItems,
        async (item) => {
          // Convert failed item back to recipient and process
          const recipients: Recipient[] = [{
            address: item.recipient,
            amount: item.amount,
            token: item.token,
          }]
          
          const result = await processBatchPayment(recipients, address!, isDemoMode)
          const paymentResult = result.results[0]
          
          return {
            id: item.id,
            success: paymentResult?.success || false,
            transactionHash: paymentResult?.txHash,
            error: paymentResult?.error,
          }
        }
      )

      setState((prev) => ({
        ...prev,
        isRetrying: false,
        failedItems: retryResult.stillFailed,
        results: [
          ...prev.results,
          ...retryResult.results.filter(r => r.success).map(r => ({
            success: true,
            recipient: state.failedItems.find(f => f.id === r.id)?.recipient || "",
            amount: state.failedItems.find(f => f.id === r.id)?.amount || 0,
            txHash: r.transactionHash,
          }))
        ],
      }))

      toast({
        title: "Retry Complete",
        description: `${retryResult.successCount} succeeded, ${retryResult.failureCount} still failed`,
      })
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isRetrying: false,
        error: error.message || "Retry failed",
      }))

      toast({
        title: "Retry Failed",
        description: error.message || "An error occurred during retry",
        variant: "destructive",
      })
    }
  }, [state.failedItems, address, isDemoMode, toast])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  const downloadReport = useCallback(() => {
    if (!state.report) {
      toast({
        title: "No Report",
        description: "No report available to download",
        variant: "destructive",
      })
      return
    }

    const blob = new Blob([state.report], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `batch-payment-report-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Report Downloaded",
      description: "The batch payment report has been downloaded",
    })
  }, [state.report, toast])

  // API integration methods
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const uploadFile = useCallback(async (file: File): Promise<{ batchId: string; itemCount: number } | null> => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const response = await fetch("/api/batch-payment/upload", {
        method: "POST",
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error("Upload failed")
      }
      
      const data = await response.json()
      setBatchStatus("uploaded")
      return { batchId: data.batchId, itemCount: data.itemCount }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [toast])

  const validateBatch = useCallback(async (batchId: string): Promise<{ valid: boolean; errors: string[] }> => {
    setLoading(true)
    try {
      const response = await fetch(`/api/batch-payment/${batchId}/validate`, {
        method: "POST",
      })
      
      if (!response.ok) {
        throw new Error("Validation failed")
      }
      
      const data = await response.json()
      setBatchStatus(data.valid ? "validated" : "invalid")
      return { valid: data.valid, errors: data.errors || [] }
    } catch (error: any) {
      return { valid: false, errors: [error.message || "Validation failed"] }
    } finally {
      setLoading(false)
    }
  }, [])

  const submitBatch = useCallback(async (batchId: string): Promise<{ success: boolean; txHash?: string }> => {
    setLoading(true)
    try {
      const response = await fetch(`/api/batch-payment/${batchId}/execute`, {
        method: "POST",
      })
      
      if (!response.ok) {
        throw new Error("Submission failed")
      }
      
      const data = await response.json()
      setBatchStatus("completed")
      return { success: true, txHash: data.txHash }
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit batch",
        variant: "destructive",
      })
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [toast])

  return {
    ...state,
    executeBatch,
    retryFailed,
    reset,
    downloadReport,
    // API integration
    uploadFile,
    validateBatch,
    submitBatch,
    batchStatus,
    loading,
  }
}
