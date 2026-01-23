"use client"

import { useState, useEffect, useCallback } from "react"

// ============================================
// Types
// ============================================

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  retry_count: number
  timeout_ms: number
  created_at: string
  updated_at: string
  last_triggered_at?: string
  success_count: number
  failure_count: number
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, any>
  status: "pending" | "delivered" | "failed" | "retrying"
  attempts: number
  response_status?: number
  response_body?: string
  error_message?: string
  created_at: string
  delivered_at?: string
}

export interface CreateWebhookParams {
  name: string
  url: string
  events: string[]
  retry_count?: number
  timeout_ms?: number
}

export interface UpdateWebhookParams {
  name?: string
  url?: string
  events?: string[]
  is_active?: boolean
  retry_count?: number
  timeout_ms?: number
}

export interface CreateWebhookResult {
  webhook: Webhook
  secret: string
}

export interface TestWebhookResult {
  success: boolean
  status_code?: number
  response_time_ms?: number
  error?: string
}

export interface UseWebhooksReturn {
  webhooks: Webhook[]
  loading: boolean
  error: string | null
  createWebhook: (params: CreateWebhookParams) => Promise<CreateWebhookResult>
  updateWebhook: (id: string, params: UpdateWebhookParams) => Promise<void>
  deleteWebhook: (id: string) => Promise<void>
  testWebhook: (id: string) => Promise<TestWebhookResult>
  getDeliveries: (id: string) => Promise<WebhookDelivery[]>
  refresh: () => Promise<void>
}

// ============================================
// API Helper
// ============================================

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed with status ${response.status}`,
      response.status
    )
  }

  return data as T
}

// ============================================
// Webhook Events
// ============================================

export const WEBHOOK_EVENTS = [
  "payment.created",
  "payment.completed",
  "payment.failed",
  "batch_payment.created",
  "batch_payment.completed",
  "multisig.proposal_created",
  "multisig.executed",
  "subscription.created",
  "subscription.payment_due",
  "subscription.payment_completed",
  "subscription.cancelled",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

// ============================================
// Hook Implementation
// ============================================

export function useWebhooks(): UseWebhooksReturn {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load webhooks
  const loadWebhooks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiRequest<{ success: boolean; webhooks: Webhook[] }>(
        "/api/webhooks"
      )
      setWebhooks(response.webhooks || [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load webhooks"
      setError(message)
      console.error("[useWebhooks] Load error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create webhook
  const createWebhook = useCallback(async (params: CreateWebhookParams): Promise<CreateWebhookResult> => {
    const response = await apiRequest<{
      success: boolean
      webhook: Webhook
      secret: string
    }>("/api/webhooks", {
      method: "POST",
      body: JSON.stringify(params),
    })

    setWebhooks((prev) => [response.webhook, ...prev])

    return {
      webhook: response.webhook,
      secret: response.secret,
    }
  }, [])

  // Update webhook
  const updateWebhook = useCallback(async (id: string, params: UpdateWebhookParams): Promise<void> => {
    const response = await apiRequest<{ success: boolean; webhook: Webhook }>(
      `/api/webhooks/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(params),
      }
    )

    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? response.webhook : w))
    )
  }, [])

  // Delete webhook
  const deleteWebhook = useCallback(async (id: string): Promise<void> => {
    await apiRequest<{ success: boolean }>(`/api/webhooks/${id}`, {
      method: "DELETE",
    })

    setWebhooks((prev) => prev.filter((w) => w.id !== id))
  }, [])

  // Test webhook
  const testWebhook = useCallback(async (id: string): Promise<TestWebhookResult> => {
    const response = await apiRequest<{
      success: boolean
      status_code?: number
      response_time_ms?: number
      error?: string
    }>(`/api/webhooks/${id}/test`, {
      method: "POST",
    })

    return {
      success: response.success,
      status_code: response.status_code,
      response_time_ms: response.response_time_ms,
      error: response.error,
    }
  }, [])

  // Get deliveries
  const getDeliveries = useCallback(async (id: string): Promise<WebhookDelivery[]> => {
    const response = await apiRequest<{ success: boolean; deliveries: WebhookDelivery[] }>(
      `/api/webhooks/${id}/deliveries`
    )

    return response.deliveries || []
  }, [])

  // Load on mount
  useEffect(() => {
    loadWebhooks()
  }, [loadWebhooks])

  return {
    webhooks,
    loading,
    error,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    getDeliveries,
    refresh: loadWebhooks,
  }
}
