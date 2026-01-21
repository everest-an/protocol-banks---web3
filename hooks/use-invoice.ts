"use client"

import { useState, useCallback } from "react"
import { useToast } from "./use-toast"

export interface Invoice {
  id: string
  invoice_id: string
  recipient_address: string
  amount: number
  token: string
  description?: string
  merchant_name?: string
  status: "pending" | "paid" | "expired" | "cancelled"
  signature: string
  tx_hash?: string
  paid_by?: string
  paid_at?: string
  expires_at: string
  created_at: string
  metadata?: Record<string, any>
}

export interface CreateInvoiceParams {
  recipientAddress: string
  amount: string
  token?: string
  description?: string
  merchantName?: string
  expiresIn?: number // milliseconds
  metadata?: Record<string, any>
}

export interface InvoiceResult {
  success: boolean
  invoice?: Invoice
  paymentLink?: string
  qrCodeData?: string
  error?: string
}

export function useInvoice() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  /**
   * Create a new invoice
   */
  const createInvoice = useCallback(
    async (params: CreateInvoiceParams): Promise<InvoiceResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create invoice")
        }

        toast({
          title: "Invoice Created",
          description: `Invoice ${data.invoice.invoice_id} created successfully`,
        })

        return {
          success: true,
          invoice: data.invoice,
          paymentLink: data.paymentLink,
          qrCodeData: data.qrCodeData,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create invoice"
        setError(message)
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        })
        return { success: false, error: message }
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  /**
   * Get invoice by ID
   */
  const getInvoice = useCallback(
    async (invoiceId: string, signature?: string): Promise<Invoice | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({ id: invoiceId })
        if (signature) params.set("sig", signature)

        const response = await fetch(`/api/invoice?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch invoice")
        }

        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch invoice"
        setError(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  /**
   * Mark invoice as paid
   */
  const markAsPaid = useCallback(
    async (invoiceId: string, txHash: string, paidBy: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/invoice", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId,
            status: "paid",
            txHash,
            paidBy,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to update invoice")
        }

        toast({
          title: "Invoice Paid",
          description: `Invoice ${invoiceId} marked as paid`,
        })

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update invoice"
        setError(message)
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  /**
   * Cancel an invoice
   */
  const cancelInvoice = useCallback(
    async (invoiceId: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/invoice", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId,
            status: "cancelled",
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to cancel invoice")
        }

        toast({
          title: "Invoice Cancelled",
          description: `Invoice ${invoiceId} has been cancelled`,
        })

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to cancel invoice"
        setError(message)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  /**
   * Generate a shareable payment link
   */
  const generatePaymentLink = useCallback((invoice: Invoice): string => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    return `${baseUrl}/pay?invoice=${invoice.invoice_id}&sig=${invoice.signature}`
  }, [])

  /**
   * Copy payment link to clipboard
   */
  const copyPaymentLink = useCallback(
    async (invoice: Invoice): Promise<boolean> => {
      try {
        const link = generatePaymentLink(invoice)
        await navigator.clipboard.writeText(link)
        toast({
          title: "Link Copied",
          description: "Payment link copied to clipboard",
        })
        return true
      } catch {
        toast({
          title: "Copy Failed",
          description: "Failed to copy link to clipboard",
          variant: "destructive",
        })
        return false
      }
    },
    [generatePaymentLink, toast],
  )

  return {
    isLoading,
    error,
    createInvoice,
    getInvoice,
    markAsPaid,
    cancelInvoice,
    generatePaymentLink,
    copyPaymentLink,
  }
}
