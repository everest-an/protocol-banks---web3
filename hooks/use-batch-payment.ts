"use client"

import { useState, useCallback } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { useToast } from "@/hooks/use-toast"
import type { PaymentRecipient } from "@/types"

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

export interface PaymentResult {
  success: boolean
  recipient: string
  amount: number | string
  token?: string
  txHash?: string
  error?: string
}

export interface FailedItem {
  id: string
  recipient: string
  amount: string
  token: string
  error: string
  retryCount: number
}

export interface UseBatchPaymentReturn extends BatchPaymentState {
  executeBatch: (recipients: PaymentRecipient[]) => Promise<void>
  retryFailed: () => Promise<void>
  reset: () => void
  downloadReport: () => void
  uploadFile: (file: File) => Promise<PaymentRecipient[]>
  validateBatch: (recipients: PaymentRecipient[]) => { isValid: boolean; errors: string[] }
  submitBatch: (recipients: PaymentRecipient[]) => Promise<void>
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
  const { wallets, activeChain } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [state, setState] = useState<BatchPaymentState>(initialState)
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const currentWallet = wallets[activeChain] || wallets.EVM

  const uploadFile = useCallback(async (file: File): Promise<PaymentRecipient[]> => {
    // Parse CSV/Excel file and return recipients
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const recipients: PaymentRecipient[] = []
          
          // Skip header row
          for (let i = 1; i < lines.length; i++) {
            const [address, amount, token, vendorName] = lines[i].split(',').map(s => s.trim())
            if (address && amount) {
              recipients.push({
                id: `${Date.now()}_${i}`,
                address,
                amount,
                token: token || 'USDT',
                vendorName: vendorName || '',
              })
            }
          }
          resolve(recipients)
        } catch (err) {
          reject(new Error('Failed to parse file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }, [])

  const validateBatch = useCallback((recipients: PaymentRecipient[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    // Regex patterns
    const ethRegex = /^0x[a-fA-F0-9]{40}$/
    const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    const btcRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/
    const tronRegex = /^T[a-zA-Z0-9]{33}$/

    recipients.forEach((r, idx) => {
      const chain = r.chain ? r.chain.toUpperCase() : 'EVM'
      let isValidAddress = false

      // Validate address based on chain
      switch (chain) {
        case 'SOLANA':
        case 'SOL':
          isValidAddress = solRegex.test(r.address)
          break
        case 'BITCOIN':
        case 'BTC':
          isValidAddress = btcRegex.test(r.address)
          break
        case 'TRON':
        case 'TRX':
          isValidAddress = tronRegex.test(r.address)
          break
        case 'EVM':
        case 'ETH':
        case 'BSC':
        case 'POLYGON':
        default:
          isValidAddress = ethRegex.test(r.address)
          break
      }

      if (!r.address || !isValidAddress) {
        errors.push(`Row ${idx + 1}: Invalid address format for chain ${chain}`)
      }
      if (!r.amount || isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0) {
        errors.push(`Row ${idx + 1}: Invalid amount`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
    }
  }, [])

  const submitBatch = useCallback(async (recipients: PaymentRecipient[]) => {
    await executeBatch(recipients)
  }, [])

  const executeBatch = useCallback(
    async (recipients: PaymentRecipient[]) => {
      if (!currentWallet) {
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
      setLoading(true)
      setBatchStatus('processing')

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setState((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 5, 90),
          }))
        }, 200)

        // In demo mode, simulate success
        if (isDemoMode) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          clearInterval(progressInterval)
          
          const results: PaymentResult[] = recipients.map(r => ({
            success: true,
            recipient: r.address,
            amount: r.amount,
            token: r.token,
            txHash: `0x${Math.random().toString(16).slice(2)}`,
          }))

          setState((prev) => ({
            ...prev,
            isProcessing: false,
            progress: 100,
            results,
            feeBreakdown: {
              totalAmount: recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0).toString(),
              totalFees: '0',
              netAmount: recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0).toString(),
            },
          }))
          setBatchStatus('completed')
          setLoading(false)

          toast({
            title: "Batch Payment Complete",
            description: `${recipients.length} payments successful (Test Mode)`,
          })
          return
        }

        // Real API call
        const response = await fetch('/api/batch-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: recipients.map(r => ({
              address: r.address,
              amount: r.amount,
              token: r.token,
              memo: r.vendorName,
            })),
            fromAddress: currentWallet,
          }),
        })

        clearInterval(progressInterval)

        if (!response.ok) {
          throw new Error('Batch payment failed')
        }

        const data = await response.json()

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          results: data.results || [],
        }))
        setBatchStatus('completed')
        setLoading(false)

        toast({
          title: "Batch Payment Complete",
          description: `${data.successCount || recipients.length} payments processed`,
        })
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: error.message || "Batch payment failed",
        }))
        setBatchStatus('failed')
        setLoading(false)

        toast({
          title: "Batch Payment Failed",
          description: error.message || "An error occurred during batch processing",
          variant: "destructive",
        })
      }
    },
    [currentWallet, isDemoMode, toast],
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
      // Convert failed items to recipients and retry
      const recipients: PaymentRecipient[] = state.failedItems.map(item => ({
        id: item.id,
        address: item.recipient,
        amount: item.amount,
        token: item.token,
      }))

      await executeBatch(recipients)
      
      setState((prev) => ({
        ...prev,
        isRetrying: false,
        failedItems: [],
      }))
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isRetrying: false,
        error: error.message || "Retry failed",
      }))
    }
  }, [state.failedItems, executeBatch, toast])

  const reset = useCallback(() => {
    setState(initialState)
    setBatchStatus(null)
    setLoading(false)
  }, [])

  const downloadReport = useCallback(() => {
    if (state.results.length === 0) {
      toast({
        title: "No Report",
        description: "No results available to download",
        variant: "destructive",
      })
      return
    }

    const csv = [
      'recipient,amount,token,status,txHash,error',
      ...state.results.map(r => 
        `${r.recipient},${r.amount},${r.token || 'USDT'},${r.success ? 'success' : 'failed'},${r.txHash || ''},${r.error || ''}`
      )
    ].join('\n')

    const blob = new Blob([csv], { type: "text/csv" })
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
  }, [state.results, toast])

  return {
    ...state,
    executeBatch,
    retryFailed,
    reset,
    downloadReport,
    uploadFile,
    validateBatch,
    submitBatch,
    batchStatus,
    loading,
  }
}
