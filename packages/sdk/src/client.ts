/**
 * Protocol Banks SDK Client
 *
 * Main entry point for interacting with Protocol Banks APIs.
 */

import type { ProtocolBanksConfig, PaymentResult } from "./types"
import { PaymentLink } from "./payment-link"
import { Invoice } from "./invoice"
import { Checkout } from "./checkout"
import { Webhook } from "./webhook"

export class ProtocolBanks {
  private config: Required<
    Pick<ProtocolBanksConfig, "apiKey" | "baseUrl" | "defaultToken">
  > &
    ProtocolBanksConfig

  /** Payment Links module */
  public paymentLinks: PaymentLink
  /** Invoicing module */
  public invoices: Invoice
  /** Checkout module */
  public checkout: Checkout
  /** Webhooks module */
  public webhooks: Webhook

  constructor(config: ProtocolBanksConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "https://protocol-banks.vercel.app",
      defaultToken: config.defaultToken || "USDC",
    }

    this.paymentLinks = new PaymentLink(this.config)
    this.invoices = new Invoice(this.config)
    this.checkout = new Checkout(this.config)
    this.webhooks = new Webhook(this.config)
  }

  /**
   * Create an embeddable payment iframe
   */
  embed(options: {
    container: HTMLElement | string
    to: string
    amount?: string
    token?: string
    merchantName?: string
    theme?: "light" | "dark"
    onSuccess?: (result: PaymentResult) => void
    onError?: (error: Error) => void
  }): { destroy: () => void } {
    const container =
      typeof options.container === "string"
        ? document.querySelector(options.container)
        : options.container

    if (!container) {
      throw new Error("Container element not found")
    }

    const params = new URLSearchParams({
      to: options.to,
      token: options.token || this.config.defaultToken,
    })

    if (options.amount) params.set("amount", options.amount)
    if (options.merchantName) params.set("merchant", options.merchantName)
    if (options.theme) params.set("theme", options.theme)

    const iframe = document.createElement("iframe")
    iframe.src = `${this.config.baseUrl}/embed/pay?${params.toString()}`
    iframe.style.width = "100%"
    iframe.style.height = "500px"
    iframe.style.border = "none"
    iframe.style.borderRadius = "12px"
    iframe.allow = "payment"

    // Listen for postMessage events from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(this.config.baseUrl).origin) return

      const data = event.data
      if (data.type === "payment_success" && options.onSuccess) {
        options.onSuccess({
          success: true,
          id: data.txHash || "",
          paymentUrl: "",
          status: "paid",
          txHash: data.txHash,
        })
      }
      if (data.type === "payment_error" && options.onError) {
        options.onError(new Error(data.error || "Payment failed"))
      }
    }

    window.addEventListener("message", handleMessage)
    container.appendChild(iframe)

    return {
      destroy: () => {
        window.removeEventListener("message", handleMessage)
        iframe.remove()
      },
    }
  }

  /**
   * Generate a payment URL for direct redirect
   */
  getPaymentUrl(options: {
    to: string
    amount: string
    token?: string
    merchantName?: string
  }): string {
    const params = new URLSearchParams({
      to: options.to,
      amount: options.amount,
      token: options.token || this.config.defaultToken,
    })

    if (options.merchantName) params.set("merchant", options.merchantName)

    return `${this.config.baseUrl}/pay?${params.toString()}`
  }

  /**
   * Make an authenticated API request
   */
  async request<T = any>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api${path}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.config.apiKey,
    }

    if (this.config.apiSecret) {
      headers["X-API-Secret"] = this.config.apiSecret
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }))
      throw new Error(error.error || `API request failed: ${response.status}`)
    }

    return response.json()
  }
}
