/**
 * Invoice Module
 *
 * Create and manage crypto invoices.
 */

import type { ProtocolBanksConfig, InvoiceConfig, PaymentResult } from "./types"

export class Invoice {
  private config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  /**
   * Create a new invoice
   */
  async create(options: InvoiceConfig): Promise<PaymentResult> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify({
        recipientAddress: options.recipientAddress,
        amount: options.amount,
        token: options.token || this.config.defaultToken || "USDC",
        description: options.description,
        merchantName: options.merchantName,
        amountFiat: options.amountFiat,
        fiatCurrency: options.fiatCurrency,
        expiresIn: (options.expiresInHours || 24) * 60 * 60 * 1000,
        metadata: {
          ...options.metadata,
          customerName: options.customer?.name,
          customerEmail: options.customer?.email,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok || (!data.success && !data.invoice)) {
      return {
        success: false,
        id: "",
        paymentUrl: "",
        status: "failed",
        error: data.error || "Failed to create invoice",
      }
    }

    return {
      success: true,
      id: data.invoice.invoice_id,
      paymentUrl: data.paymentLink,
      qrCodeData: data.qrCodeData,
      status: "pending",
    }
  }

  /**
   * Get invoice details
   */
  async get(invoiceId: string, signature?: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"
    const params = new URLSearchParams({ id: invoiceId })
    if (signature) params.set("sig", signature)

    const response = await fetch(`${baseUrl}/api/invoice?${params.toString()}`, {
      headers: {
        "X-API-Key": this.config.apiKey,
      },
    })

    return response.json()
  }

  /**
   * Update invoice status (e.g., after payment)
   */
  async updateStatus(
    invoiceId: string,
    status: string,
    txHash?: string,
    paidBy?: string,
  ): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/invoice`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify({ invoiceId, status, txHash, paidBy }),
    })

    return response.json()
  }

  /**
   * Get printable invoice export URL
   */
  getExportUrl(invoiceId: string, signature?: string): string {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"
    const params = new URLSearchParams({ id: invoiceId })
    if (signature) params.set("sig", signature)
    return `${baseUrl}/api/invoice/export?${params.toString()}`
  }

  /**
   * List invoices for a merchant
   */
  async list(options?: { status?: string; limit?: number; offset?: number }): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"
    const params = new URLSearchParams()
    if (options?.status) params.set("status", options.status)
    if (options?.limit) params.set("limit", options.limit.toString())
    if (options?.offset) params.set("offset", options.offset.toString())

    const response = await fetch(`${baseUrl}/api/invoice/list?${params.toString()}`, {
      headers: {
        "X-API-Key": this.config.apiKey,
      },
    })

    return response.json()
  }
}
