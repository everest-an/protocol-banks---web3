"use client"

import { useState, useEffect, useCallback } from "react"

// ============================================
// Types
// ============================================

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
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

export interface CreateApiKeyParams {
  name: string
  permissions?: string[]
  rate_limit_per_minute?: number
  rate_limit_per_day?: number
  allowed_ips?: string[]
  allowed_origins?: string[]
  expires_at?: string
}

export interface CreateApiKeyResult {
  key: ApiKey
  secret: string
}

export interface UseApiKeysReturn {
  apiKeys: ApiKey[]
  loading: boolean
  error: string | null
  createKey: (params: CreateApiKeyParams) => Promise<CreateApiKeyResult>
  deleteKey: (id: string) => Promise<void>
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

async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
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
// Hook Implementation
// ============================================

export function useApiKeys(): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load API keys
  const loadApiKeys = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiRequest<{ success: boolean; keys: ApiKey[]; count: number }>(
        "/api/settings/api-keys"
      )
      setApiKeys(response.keys || [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load API keys"
      setError(message)
      console.error("[useApiKeys] Load error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create API key
  const createKey = useCallback(async (params: CreateApiKeyParams): Promise<CreateApiKeyResult> => {
    const response = await apiRequest<{
      success: boolean
      key: ApiKey
      secret: string
      message: string
    }>("/api/settings/api-keys", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        permissions: params.permissions || ["read"],
        rate_limit_per_minute: params.rate_limit_per_minute,
        rate_limit_per_day: params.rate_limit_per_day,
        allowed_ips: params.allowed_ips,
        allowed_origins: params.allowed_origins,
        expires_at: params.expires_at,
      }),
    })

    // Add new key to state
    setApiKeys((prev) => [response.key, ...prev])

    return {
      key: response.key,
      secret: response.secret,
    }
  }, [])

  // Delete API key
  const deleteKey = useCallback(async (id: string): Promise<void> => {
    await apiRequest<{ success: boolean }>(`/api/settings/api-keys/${id}`, {
      method: "DELETE",
    })

    // Remove key from state
    setApiKeys((prev) => prev.filter((k) => k.id !== id))
  }, [])

  // Load on mount
  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])

  return {
    apiKeys,
    loading,
    error,
    createKey,
    deleteKey,
    refresh: loadApiKeys,
  }
}

// Export API permissions for UI
export const API_PERMISSIONS = ["read", "write", "payments", "webhooks", "admin"] as const
export type ApiPermission = (typeof API_PERMISSIONS)[number]
