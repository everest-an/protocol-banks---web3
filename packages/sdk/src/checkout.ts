/**
 * Checkout Module
 *
 * Create checkout sessions for merchant acquiring.
 */

import type { ProtocolBanksConfig, CheckoutConfig, PaymentResult } from "./types"

export class Checkout {
  private config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  /**
   * Create a new checkout order
   */
  async create(options: CheckoutConfig): Promise<PaymentResult> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/acquiring/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify({
        merchant_id: options.merchantId,
        amount: parseFloat(options.amount),
        currency: options.currency || "USD",
        token: options.token || this.config.defaultToken || "USDC",
        notify_url: options.notifyUrl,
        return_url: options.returnUrl,
        metadata: options.metadata,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return {
        success: false,
        id: "",
        paymentUrl: "",
        status: "failed",
        error: data.error || "Failed to create checkout",
      }
    }

    const checkoutUrl = `${baseUrl}/checkout?order=${data.order.order_no}`

    return {
      success: true,
      id: data.order.order_no,
      paymentUrl: checkoutUrl,
      qrCodeData: checkoutUrl,
      status: "pending",
    }
  }

  /**
   * Get order status
   */
  async getStatus(orderNo: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/acquiring/orders/${orderNo}`, {
      headers: {
        "X-API-Key": this.config.apiKey,
      },
    })

    return response.json()
  }

  /**
   * List orders for a merchant
   */
  async listOrders(
    merchantId?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"
    const params = new URLSearchParams()
    if (merchantId) params.set("merchantId", merchantId)
    if (options?.limit) params.set("limit", options.limit.toString())
    if (options?.offset) params.set("offset", options.offset.toString())

    const response = await fetch(
      `${baseUrl}/api/acquiring/orders?${params.toString()}`,
      {
        headers: {
          "X-API-Key": this.config.apiKey,
        },
      },
    )

    return response.json()
  }

  /**
   * Open checkout in a popup window
   */
  openPopup(options: CheckoutConfig): Promise<PaymentResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.create(options)
        if (!result.success) {
          reject(new Error(result.error || "Failed to create checkout"))
          return
        }

        const width = 450
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2

        const popup = window.open(
          result.paymentUrl,
          "protocol-banks-checkout",
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
        )

        if (!popup) {
          reject(new Error("Popup blocked. Please allow popups for this site."))
          return
        }

        // Monitor popup close
        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval)
            // Check final status
            this.getStatus(result.id).then((status) => {
              if (status.order?.status === "paid") {
                resolve({
                  ...result,
                  status: "paid",
                  txHash: status.order.tx_hash,
                })
              } else {
                resolve({
                  ...result,
                  status: "cancelled",
                })
              }
            }).catch(() => {
              resolve({ ...result, status: "cancelled" })
            })
          }
        }, 500)
      } catch (error: any) {
        reject(error)
      }
    })
  }
}
