/**
 * Authenticated Fetch Utility
 *
 * Wraps the native fetch to automatically include:
 * - Authorization: Bearer <SIWE JWT> (the actual credential — see lib/auth/siwe-client.ts)
 * - x-wallet-address (identity hint; cross-checked server-side, never trusted alone)
 * - x-test-mode=true (guest / test mode)
 *
 * Policy:
 * - Logged-in users always use real mode (no x-test-mode header).
 * - Guests default to test mode for demo data.
 * - Email/OAuth users authenticate via the httpOnly session cookie, which
 *   same-origin fetch sends automatically.
 *
 * Usage:
 *   import { createAuthenticatedFetch } from "@/lib/authenticated-fetch"
 *   const authFetch = createAuthenticatedFetch(walletAddress)
 *   const res = await authFetch("/api/payments")
 */

import { getAccessToken, refreshSiweToken } from "@/lib/auth/siwe-client"

type AuthHeaderOptions = {
  isDemoMode?: boolean
}

export function createAuthenticatedFetch(
  walletAddress: string | null | undefined,
  options?: AuthHeaderOptions,
) {
  return async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers)

    // Always attach wallet address if available
    if (walletAddress && !headers.has("x-wallet-address")) {
      headers.set("x-wallet-address", walletAddress)
    }

    // Attach the SIWE JWT — this is what actually authenticates the request.
    if (walletAddress && !headers.has("authorization")) {
      let token = getAccessToken(walletAddress)
      if (!token) {
        // Access token expired — try a silent refresh before the request.
        token = await refreshSiweToken()
        if (token && getAccessToken(walletAddress) !== token) {
          // Refreshed token belongs to a different address — don't use it.
          token = getAccessToken(walletAddress)
        }
      }
      if (token) headers.set("authorization", `Bearer ${token}`)
    }

    // Guest users default to test mode unless explicitly disabled.
    // Connected users are always real mode.
    const shouldUseTestMode = !walletAddress && (options?.isDemoMode ?? true)
    if (shouldUseTestMode && !headers.has("x-test-mode")) {
      headers.set("x-test-mode", "true")
    }

    if (walletAddress && headers.has("x-test-mode")) {
      headers.delete("x-test-mode")
    }

    return fetch(input, {
      ...init,
      headers,
    })
  }
}

/**
 * Helper to build headers object with wallet address + SIWE JWT included.
 * Useful when you need to pass headers inline.
 *
 * Note: this is synchronous — it attaches the stored access token but cannot
 * silently refresh an expired one. Prefer createAuthenticatedFetch() for
 * long-lived pages.
 */
export function authHeaders(
  walletAddress: string | null | undefined,
  extra?: Record<string, string>,
  options?: AuthHeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }

  if (walletAddress) {
    headers["x-wallet-address"] = walletAddress
    const token = getAccessToken(walletAddress)
    if (token && !headers["authorization"] && !headers["Authorization"]) {
      headers["authorization"] = `Bearer ${token}`
    }
    delete headers["x-test-mode"]
    return headers
  }

  const shouldUseTestMode = options?.isDemoMode ?? true
  if (shouldUseTestMode) {
    headers["x-test-mode"] = "true"
  }

  return headers
}
