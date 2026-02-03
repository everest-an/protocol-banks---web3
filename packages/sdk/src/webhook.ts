/**
 * Webhook Module
 *
 * Verify incoming webhook signatures and manage webhook subscriptions.
 */

import type { ProtocolBanksConfig } from "./types"

export interface WebhookEvent {
  event: string
  timestamp: string
  data: Record<string, any>
  delivery_id?: string
}

export interface WebhookConfig {
  /** Webhook name */
  name: string
  /** Delivery URL */
  url: string
  /** Events to subscribe to */
  events: string[]
}

export class Webhook {
  private config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  /**
   * Verify an incoming webhook signature (server-side only).
   *
   * Use this in your webhook handler to validate that the request
   * came from Protocol Banks.
   *
   * @example
   * ```ts
   * const pb = new ProtocolBanks({ apiKey: 'pk_...' });
   *
   * app.post('/webhook', (req, res) => {
   *   const signature = req.headers['x-webhook-signature'];
   *   const timestamp = req.headers['x-webhook-timestamp'];
   *   const body = JSON.stringify(req.body);
   *
   *   if (!pb.webhooks.verify(body, signature, 'whsec_...')) {
   *     return res.status(401).send('Invalid signature');
   *   }
   *
   *   // Process event
   *   const event = req.body;
   *   console.log('Received event:', event.event);
   *   res.status(200).send('OK');
   * });
   * ```
   */
  verify(payload: string, signature: string, secret: string): boolean {
    // Dynamically import crypto for Node.js environments
    try {
      const crypto = require("crypto")
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex")

      // Timing-safe comparison
      if (signature.length !== expectedSignature.length) {
        return false
      }

      const sigBuffer = Buffer.from(signature, "hex")
      const expectedBuffer = Buffer.from(expectedSignature, "hex")

      if (sigBuffer.length !== expectedBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    } catch {
      // Fallback for non-Node environments (browser)
      return this.verifyBrowser(payload, signature, secret)
    }
  }

  /**
   * Browser-compatible signature verification using Web Crypto API
   */
  private verifyBrowser(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    // Web Crypto API is async, so this sync fallback does manual comparison
    // For browser environments, use verifyAsync instead
    console.warn(
      "Webhook verification in browser is not recommended. Use server-side verification.",
    )
    return false
  }

  /**
   * Async signature verification using Web Crypto API (works in browser and Node.js)
   */
  async verifyAsync(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      // Try Node.js crypto first
      const crypto = require("crypto")
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex")

      const sigBuffer = Buffer.from(signature, "hex")
      const expectedBuffer = Buffer.from(expectedSignature, "hex")

      if (sigBuffer.length !== expectedBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    } catch {
      // Fallback to Web Crypto API
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secret)
      const payloadData = encoder.encode(payload)

      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )

      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        payloadData,
      )

      const expectedHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // Constant-time comparison
      if (signature.length !== expectedHex.length) {
        return false
      }

      let result = 0
      for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i)
      }
      return result === 0
    }
  }

  /**
   * Construct a webhook event from a raw request
   */
  constructEvent(
    payload: string,
    signature: string,
    secret: string,
  ): WebhookEvent {
    if (!this.verify(payload, signature, secret)) {
      throw new Error("Invalid webhook signature")
    }

    const event = JSON.parse(payload)
    return event as WebhookEvent
  }

  /**
   * Create a new webhook subscription
   */
  async create(options: WebhookConfig): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/webhooks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
      },
      body: JSON.stringify(options),
    })

    return response.json()
  }

  /**
   * List webhook subscriptions
   */
  async list(): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/webhooks`, {
      headers: {
        "X-API-Key": this.config.apiKey,
      },
    })

    return response.json()
  }

  /**
   * Delete a webhook subscription
   */
  async delete(webhookId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(`${baseUrl}/api/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: {
        "X-API-Key": this.config.apiKey,
      },
    })

    return response.json()
  }

  /**
   * Get recent webhook deliveries
   */
  async getDeliveries(webhookId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || "https://protocol-banks.vercel.app"

    const response = await fetch(
      `${baseUrl}/api/webhooks/${webhookId}/deliveries`,
      {
        headers: {
          "X-API-Key": this.config.apiKey,
        },
      },
    )

    return response.json()
  }
}
