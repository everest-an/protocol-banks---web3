/**
 * PB-Stream Client SDK
 *
 * TypeScript client for AI agents and API consumers to interact
 * with the HTTP 402 micropayment gateway.
 *
 * Usage:
 *
 * ```typescript
 * import { PBStreamClient } from "@/lib/sdk/pb-stream-client"
 *
 * const client = new PBStreamClient({
 *   baseUrl: "https://api.protocolbanks.com",
 *   sessionKey: "sk_xxx", // or channelId
 * })
 *
 * // Make API call with automatic payment
 * const response = await client.fetch("/api/ai/generate", {
 *   method: "POST",
 *   body: JSON.stringify({ prompt: "Hello" }),
 * })
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface PBStreamConfig {
  baseUrl: string
  sessionKey?: string
  channelId?: string
  autoRetry?: boolean
  maxRetries?: number
  onPaymentSuccess?: (paymentId: string, amount: string) => void
  onPaymentFailure?: (error: string) => void
  onLowBalance?: (remainingBalance: string) => void
  lowBalanceThreshold?: number
}

export interface PaymentChannel {
  id: string
  providerId: string
  depositAmount: string
  spentAmount: string
  pendingAmount: string
  status: string
  expiresAt: string
}

export interface PaymentInfo {
  paymentId?: string
  amountPaid: string
  remainingBalance: string
}

export interface FetchOptions extends RequestInit {
  skipPayment?: boolean
}

// ============================================================================
// PB-Stream Client
// ============================================================================

export class PBStreamClient {
  private config: Required<PBStreamConfig>
  private currentChannel?: PaymentChannel

  constructor(config: PBStreamConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      sessionKey: config.sessionKey || "",
      channelId: config.channelId || "",
      autoRetry: config.autoRetry ?? true,
      maxRetries: config.maxRetries ?? 3,
      onPaymentSuccess: config.onPaymentSuccess || (() => {}),
      onPaymentFailure: config.onPaymentFailure || (() => {}),
      onLowBalance: config.onLowBalance || (() => {}),
      lowBalanceThreshold: config.lowBalanceThreshold ?? 1,
    }
  }

  // ==========================================================================
  // Channel Management
  // ==========================================================================

  /**
   * Open a new payment channel
   */
  async openChannel(params: {
    providerId: string
    depositAmount: string
    settlementThreshold?: string
    durationSeconds?: number
  }): Promise<PaymentChannel> {
    const response = await globalThis.fetch(`${this.config.baseUrl}/api/pb-stream/channels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.sessionKey && { "X-Session-Key": this.config.sessionKey }),
      },
      body: JSON.stringify(params),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to open channel")
    }

    this.currentChannel = data.channel
    this.config.channelId = data.channel.id

    return data.channel
  }

  /**
   * Get current channel info
   */
  async getChannel(channelId?: string): Promise<PaymentChannel> {
    const id = channelId || this.config.channelId

    if (!id) {
      throw new Error("No channel ID specified")
    }

    const response = await globalThis.fetch(
      `${this.config.baseUrl}/api/pb-stream/channels/${id}?stats=true`,
      {
        headers: this.getAuthHeaders(),
      },
    )

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to get channel")
    }

    this.currentChannel = data.channel
    return data.channel
  }

  /**
   * Close channel and settle remaining balance
   */
  async closeChannel(channelId?: string): Promise<{ settledAmount: string }> {
    const id = channelId || this.config.channelId

    if (!id) {
      throw new Error("No channel ID specified")
    }

    const response = await globalThis.fetch(
      `${this.config.baseUrl}/api/pb-stream/channels/${id}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
    )

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to close channel")
    }

    this.currentChannel = undefined
    this.config.channelId = ""

    return { settledAmount: data.settledAmount }
  }

  /**
   * Manually trigger settlement
   */
  async settle(channelId?: string): Promise<{
    settlementId: string
    settledAmount: string
    transactionHash?: string
  }> {
    const id = channelId || this.config.channelId

    const response = await globalThis.fetch(`${this.config.baseUrl}/api/pb-stream/settle`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelId: id }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Settlement failed")
    }

    return data
  }

  // ==========================================================================
  // Payment-Enabled Fetch
  // ==========================================================================

  /**
   * Fetch with automatic micropayment handling
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const fullUrl = url.startsWith("http") ? url : `${this.config.baseUrl}${url}`

    // Add payment headers
    const headers = new Headers(options.headers)

    if (this.config.channelId) {
      headers.set("X-Payment-Channel-Id", this.config.channelId)
    }
    if (this.config.sessionKey) {
      headers.set("X-Session-Key", this.config.sessionKey)
    }

    let response = await globalThis.fetch(fullUrl, {
      ...options,
      headers,
    })

    // Handle 402 Payment Required
    if (response.status === 402 && !options.skipPayment) {
      const paymentRequired = await response.json()

      // Check if we can auto-pay
      if (this.config.autoRetry && paymentRequired.channelId) {
        const payResult = await this.pay(
          paymentRequired.channelId,
          paymentRequired.amount,
          url,
        )

        if (payResult.success) {
          // Retry the original request
          response = await globalThis.fetch(fullUrl, {
            ...options,
            headers,
          })
        } else {
          this.config.onPaymentFailure(payResult.error || "Payment failed")
          throw new PaymentRequiredError(paymentRequired)
        }
      } else {
        throw new PaymentRequiredError(paymentRequired)
      }
    }

    // Extract payment info from response headers
    const paymentId = response.headers.get("X-Payment-Id")
    const amountPaid = response.headers.get("X-Payment-Amount")
    const remainingBalance = response.headers.get("X-Remaining-Balance")

    if (paymentId && amountPaid) {
      this.config.onPaymentSuccess(paymentId, amountPaid)

      // Check for low balance warning
      if (remainingBalance) {
        const balance = parseFloat(remainingBalance)
        if (balance <= this.config.lowBalanceThreshold) {
          this.config.onLowBalance(remainingBalance)
        }
      }
    }

    return response
  }

  /**
   * Convenience method for JSON requests
   */
  async fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    })

    return response.json()
  }

  // ==========================================================================
  // Direct Payment
  // ==========================================================================

  /**
   * Make a direct payment
   */
  async pay(
    channelIdOrResource: string,
    amount: string,
    resource: string,
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const response = await globalThis.fetch(`${this.config.baseUrl}/api/pb-stream/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        channelId: this.config.channelId || channelIdOrResource,
        sessionKey: this.config.sessionKey,
        amount,
        resource,
      }),
    })

    const data = await response.json()

    if (response.status === 402) {
      return { success: false, error: data.error || "Payment required" }
    }

    if (!data.success) {
      return { success: false, error: data.error }
    }

    return { success: true, paymentId: data.paymentId }
  }

  /**
   * Check payment status before making a request
   */
  async checkPayment(
    providerId: string,
    amount: string,
  ): Promise<{ required: boolean; availableBalance?: string }> {
    const params = new URLSearchParams({
      providerId,
      amount,
      ...(this.config.channelId && { channelId: this.config.channelId }),
      ...(this.config.sessionKey && { sessionKey: this.config.sessionKey }),
    })

    const response = await globalThis.fetch(
      `${this.config.baseUrl}/api/pb-stream/pay?${params}`,
      { headers: this.getAuthHeaders() },
    )

    return response.json()
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    if (this.config.channelId) {
      headers["X-Payment-Channel-Id"] = this.config.channelId
    }
    if (this.config.sessionKey) {
      headers["X-Session-Key"] = this.config.sessionKey
    }

    return headers
  }

  /**
   * Get remaining balance
   */
  getRemainingBalance(): string {
    if (!this.currentChannel) return "0"

    const deposit = parseFloat(this.currentChannel.depositAmount)
    const spent = parseFloat(this.currentChannel.spentAmount)
    const pending = parseFloat(this.currentChannel.pendingAmount)

    return (deposit - spent - pending).toString()
  }

  /**
   * Set channel ID
   */
  setChannelId(channelId: string): void {
    this.config.channelId = channelId
  }

  /**
   * Set session key
   */
  setSessionKey(sessionKey: string): void {
    this.config.sessionKey = sessionKey
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class PaymentRequiredError extends Error {
  status = 402
  paymentInfo: {
    amount: string
    currency: string
    recipient: string
    channelId?: string
  }

  constructor(info: any) {
    super(info.message || "Payment required")
    this.name = "PaymentRequiredError"
    this.paymentInfo = {
      amount: info.amount,
      currency: info.currency || "USDC",
      recipient: info.recipient,
      channelId: info.channelId,
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PB-Stream client instance
 */
export function createPBStreamClient(config: PBStreamConfig): PBStreamClient {
  return new PBStreamClient(config)
}

// ============================================================================
// React Hook (for Next.js)
// ============================================================================

/**
 * React hook for PB-Stream client (if using in React components)
 *
 * Usage:
 * ```tsx
 * const { client, balance, openChannel, pay } = usePBStream({
 *   baseUrl: "/",
 *   sessionKey: userSessionKey,
 * })
 * ```
 */
export function createPBStreamHook(initialConfig: PBStreamConfig) {
  let client: PBStreamClient | null = null

  return {
    getClient: () => {
      if (!client) {
        client = new PBStreamClient(initialConfig)
      }
      return client
    },
    resetClient: () => {
      client = null
    },
  }
}
