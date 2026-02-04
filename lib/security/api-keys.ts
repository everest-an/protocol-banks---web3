// API Key management service
import { createClient } from "@/lib/supabase/client"
import { createHash, randomBytes } from "crypto"

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  owner_address: string
  permissions: string[]
  rate_limit_per_minute: number
  rate_limit_per_day: number
  allowed_ips?: string[]
  allowed_origins?: string[]
  expires_at?: string
  last_used_at?: string
  usage_count: number
  is_active: boolean
  created_at: string
}

export interface CreateApiKeyResult {
  apiKey: ApiKey
  secretKey: string // Only returned once on creation
}

export interface Webhook {
  id: string
  name: string
  url: string
  owner_address: string
  events: string[]
  is_active: boolean
  retry_count: number
  timeout_ms: number
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, unknown>
  status: "pending" | "delivered" | "failed"
  attempts: number
  response_status?: number
  error_message?: string
  created_at: string
  delivered_at?: string
}

// Available webhook events
export const WEBHOOK_EVENTS = [
  "payment.created",
  "payment.completed",
  "payment.failed",
  "batch_payment.created",
  "batch_payment.completed",
  "multisig.proposal_created",
  "multisig.confirmation_added",
  "multisig.executed",
  "vendor.created",
  "vendor.updated",
] as const

// Available API permissions
export const API_PERMISSIONS = [
  "read",
  "write",
  "payments.create",
  "payments.read",
  "vendors.manage",
  "analytics.read",
  "webhooks.manage",
] as const

export class ApiKeyService {
  private supabase = createClient()

  // Generate a new API key
  async createApiKey(params: {
    name: string
    ownerAddress: string
    permissions?: string[]
    rateLimitPerMinute?: number
    rateLimitPerDay?: number
    allowedIps?: string[]
    allowedOrigins?: string[]
    expiresInDays?: number
  }): Promise<CreateApiKeyResult> {
    const secretKey = `pb_${randomBytes(32).toString("hex")}`
    const keyHash = createHash("sha256").update(secretKey).digest("hex")
    const keyPrefix = secretKey.substring(0, 12)

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await this.supabase
      .from("api_keys")
      .insert({
        name: params.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        owner_address: params.ownerAddress.toLowerCase(),
        permissions: params.permissions || ["read"],
        rate_limit_per_minute: params.rateLimitPerMinute || 60,
        rate_limit_per_day: params.rateLimitPerDay || 10000,
        allowed_ips: params.allowedIps || null,
        allowed_origins: params.allowedOrigins || null,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw error

    return {
      apiKey: data,
      secretKey, // Only returned once
    }
  }

  // Validate an API key
  async validateApiKey(secretKey: string): Promise<ApiKey | null> {
    const keyHash = createHash("sha256").update(secretKey).digest("hex")

    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single()

    if (error || !data) return null

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null
    }

    // Update usage stats
    await this.supabase
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: data.usage_count + 1,
      })
      .eq("id", data.id)

    return data
  }

  // Check rate limit
  async checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; remaining: number }> {
    const { data: key } = await this.supabase
      .from("api_keys")
      .select("rate_limit_per_minute, rate_limit_per_day")
      .eq("id", apiKeyId)
      .single()

    if (!key) return { allowed: false, remaining: 0 }

    // Get usage in last minute
    const minuteAgo = new Date(Date.now() - 60000).toISOString()
    const { count: minuteCount } = await this.supabase
      .from("api_key_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .gte("created_at", minuteAgo)

    if ((minuteCount || 0) >= key.rate_limit_per_minute) {
      return { allowed: false, remaining: 0 }
    }

    // Get usage today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: dayCount } = await this.supabase
      .from("api_key_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .gte("created_at", today.toISOString())

    if ((dayCount || 0) >= key.rate_limit_per_day) {
      return { allowed: false, remaining: 0 }
    }

    return {
      allowed: true,
      remaining: key.rate_limit_per_minute - (minuteCount || 0),
    }
  }

  // Log API usage
  async logUsage(params: {
    apiKeyId: string
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.supabase.from("api_key_usage_logs").insert(params)
  }

  // Get all API keys for a user
  async getApiKeys(ownerAddress: string): Promise<ApiKey[]> {
    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .eq("owner_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  // Revoke an API key
  async revokeApiKey(keyId: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("owner_address", ownerAddress.toLowerCase())

    if (error) throw error
  }

  // Delete an API key
  async deleteApiKey(keyId: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId)
      .eq("owner_address", ownerAddress.toLowerCase())

    if (error) throw error
  }
}

export class WebhookService {
  private supabase = createClient()

  // Create a new webhook
  async createWebhook(params: {
    name: string
    url: string
    ownerAddress: string
    events: string[]
  }): Promise<{ webhook: Webhook; secret: string }> {
    const secret = `whsec_${randomBytes(32).toString("hex")}`
    const secretHash = createHash("sha256").update(secret).digest("hex")

    const { data, error } = await this.supabase
      .from("webhooks")
      .insert({
        name: params.name,
        url: params.url,
        owner_address: params.ownerAddress.toLowerCase(),
        events: params.events,
        secret_hash: secretHash,
      })
      .select()
      .single()

    if (error) throw error

    return {
      webhook: data,
      secret, // Only returned once
    }
  }

  // Get all webhooks for a user
  async getWebhooks(ownerAddress: string): Promise<Webhook[]> {
    const { data, error } = await this.supabase
      .from("webhooks")
      .select("*")
      .eq("owner_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  // Trigger a webhook event
  async triggerEvent(params: {
    ownerAddress: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<void> {
    // Find all active webhooks for this event
    const { data: webhooks } = await this.supabase
      .from("webhooks")
      .select("*")
      .eq("owner_address", params.ownerAddress.toLowerCase())
      .eq("is_active", true)
      .contains("events", [params.eventType])

    if (!webhooks || webhooks.length === 0) return

    // Create delivery records
    for (const webhook of webhooks) {
      await this.supabase.from("webhook_deliveries").insert({
        webhook_id: webhook.id,
        event_type: params.eventType,
        payload: params.payload,
        status: "pending",
      })
    }

    // In production, use a queue to process deliveries
    // For now, we'll process inline
    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook, params.eventType, params.payload)
    }
  }

  // Deliver a webhook
  private async deliverWebhook(webhook: Webhook, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const deliveryPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": eventType,
          "X-Webhook-Timestamp": new Date().toISOString(),
        },
        body: JSON.stringify(deliveryPayload),
        signal: AbortSignal.timeout(webhook.timeout_ms),
      })

      await this.supabase
        .from("webhook_deliveries")
        .update({
          status: response.ok ? "delivered" : "failed",
          response_status: response.status,
          delivered_at: response.ok ? new Date().toISOString() : null,
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("webhook_id", webhook.id)
        .eq("event_type", eventType)
        .eq("status", "pending")
    } catch (error) {
      await this.supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("webhook_id", webhook.id)
        .eq("event_type", eventType)
        .eq("status", "pending")
    }
  }

  // Get webhook deliveries
  async getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const { data, error } = await this.supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  }

  // Update webhook
  async updateWebhook(params: {
    webhookId: string
    ownerAddress: string
    updates: Partial<Pick<Webhook, "name" | "url" | "events" | "is_active">>
  }): Promise<void> {
    const { error } = await this.supabase
      .from("webhooks")
      .update(params.updates)
      .eq("id", params.webhookId)
      .eq("owner_address", params.ownerAddress.toLowerCase())

    if (error) throw error
  }

  // Delete webhook
  async deleteWebhook(webhookId: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from("webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("owner_address", ownerAddress.toLowerCase())

    if (error) throw error
  }
}

export const apiKeyService = new ApiKeyService()
export const webhookService = new WebhookService()
