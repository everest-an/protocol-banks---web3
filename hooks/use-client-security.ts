"use client"

import { useCallback } from "react"
import {
  getCSRFToken,
  secureFetch,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
} from "@/lib/client-security"

/**
 * Hook for secure client-side operations
 * Provides CSRF protection and safe storage access
 */
export function useClientSecurity() {
  /**
   * Make a secure API request with CSRF protection
   */
  const secureRequest = useCallback(
    async (url: string, options: RequestInit = {}): Promise<{ data: any | null; error: string | null }> => {
      try {
        const response = await secureFetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return {
            data: null,
            error: errorData.error || `Request failed with status ${response.status}`,
          }
        }

        const data = await response.json()
        return { data, error: null }
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : "Request failed",
        }
      }
    },
    []
  )

  /**
   * Secure POST request
   */
  const securePost = useCallback(
    async (url: string, body: unknown): Promise<{ data: any | null; error: string | null }> => {
      return secureRequest(url, {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    [secureRequest]
  )

  /**
   * Secure PUT request
   */
  const securePut = useCallback(
    async (url: string, body: unknown): Promise<{ data: any | null; error: string | null }> => {
      return secureRequest(url, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    [secureRequest]
  )

  /**
   * Secure DELETE request
   */
  const secureDelete = useCallback(
    async (url: string): Promise<{ data: any | null; error: string | null }> => {
      return secureRequest(url, {
        method: "DELETE",
      })
    },
    [secureRequest]
  )

  /**
   * Safe localStorage get with type safety
   */
  const getStoredValue = useCallback((key: string, defaultValue: any): any => {
    return safeLocalStorageGet(key, defaultValue)
  }, [])

  /**
   * Safe localStorage set
   */
  const setStoredValue = useCallback((key: string, value: unknown): boolean => {
    return safeLocalStorageSet(key, value)
  }, [])

  /**
   * Safe localStorage remove
   */
  const removeStoredValue = useCallback((key: string): void => {
    safeLocalStorageRemove(key)
  }, [])

  /**
   * Get CSRF token for manual use
   */
  const getCsrfToken = useCallback(async (): Promise<string> => {
    return getCSRFToken()
  }, [])

  return {
    // Secure API requests
    secureRequest,
    securePost,
    securePut,
    secureDelete,
    // Storage utilities
    getStoredValue,
    setStoredValue,
    removeStoredValue,
    // CSRF token
    getCsrfToken,
  }
}
