/**
 * Authenticated Fetch Utility
 *
 * Wraps the native fetch to automatically include:
 * - x-wallet-address (connected user)
 * - x-test-mode=true (guest / test mode)
 *
 * Policy:
 * - Logged-in users always use real mode (no x-test-mode header).
 * - Guests default to test mode for demo data.
 *
 * Usage:
 *   import { createAuthenticatedFetch } from "@/lib/authenticated-fetch"
 *   const authFetch = createAuthenticatedFetch(walletAddress)
 *   const res = await authFetch("/api/payments")
 */

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
 * Helper to build headers object with wallet address included.
 * Useful when you need to pass headers inline.
 */
export function authHeaders(
  walletAddress: string | null | undefined,
  extra?: Record<string, string>,
  options?: AuthHeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }

  if (walletAddress) {
    headers["x-wallet-address"] = walletAddress
    delete headers["x-test-mode"]
    return headers
  }

  const shouldUseTestMode = options?.isDemoMode ?? true
  if (shouldUseTestMode) {
    headers["x-test-mode"] = "true"
  }

  return headers
}
