/**
 * Payment Links Module
 *
 * Create and manage no-code payment links.
 */

import type { ProtocolBanksConfig, PaymentLinkConfig, PaymentResult } from "./types"

export class PaymentLink {
  private config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  /**
   * Create a new payment link
   */
  async create(options: PaymentLinkConfig): Promise<PaymentResult> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/acquiring/payment-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        amount: options.amount,
        token: options.token || this.config.defaultToken || "USDC",
        recipientAddress: options.recipientAddress,
        amountType: options.amount ? "fixed" : "customer_input",
        redirectUrl: options.redirectUrl,
        expiresAt: options.expiresIn
          ? new Date(Date.now() + options.expiresIn * 1000).toISOString()
          : undefined,
        brandColor: options.branding?.color,
        logoUrl: options.branding?.logoUrl,
        distributeAsset: !!options.assetDistribution,
        assetType: options.assetDistribution?.type,
        assetContractAddress: options.assetDistribution?.contractAddress,
        assetTokenId: options.assetDistribution?.tokenId,
        assetAmount: options.assetDistribution?.amount,
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
        error: data.error || "Failed to create payment link",
      }
    }

    return {
      success: true,
      id: data.link.link_id,
      paymentUrl: data.paymentUrl,
      shortUrl: data.shortUrl,
      qrCodeData: data.paymentUrl,
      status: "pending",
    }
  }

  /**
   * Get payment link details
   */
  async get(linkId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(
      `${baseUrl}/api/acquiring/payment-links?linkId=${linkId}`,
      {
        headers: {
          "X-API-Key": this.config.apiKey,
        },
      },
    )

    return response.json()
  }

  /**
   * List all payment links
   */
  async list(merchantId?: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"
    const params = merchantId ? `?merchantId=${merchantId}` : ""

    const response = await fetch(
      `${baseUrl}/api/acquiring/payment-links${params}`,
      {
        headers: {
          "X-API-Key": this.config.apiKey,
        },
      },
    )

    return response.json()
  }

  /**
   * Update a payment link
   */
  async update(
    linkId: string,
    updates: Partial<PaymentLinkConfig> & { status?: string },
  ): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/acquiring/payment-links`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify({ linkId, ...updates }),
    })

    return response.json()
  }

  /**
   * Delete a payment link
   */
  async delete(linkId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(
      `${baseUrl}/api/acquiring/payment-links?linkId=${linkId}`,
      {
        method: "DELETE",
        headers: {
          "X-API-Key": this.config.apiKey,
        },
      },
    )

    return response.json()
  }
}
