/**
 * SIWE Client (browser-side)
 *
 * Implements the Sign-In-With-Ethereum flow against our own backend:
 *   GET  /api/auth/siwe/nonce   → single-use nonce
 *   POST /api/auth/siwe/verify  → { token, refreshToken, expiresAt, address }
 *   POST /api/auth/siwe/refresh → { token, expiresAt }
 *
 * The resulting JWT is what authenticates every /api/* call (see
 * lib/middleware/api-auth.ts). The x-wallet-address header alone no longer
 * authenticates.
 *
 * Storage: localStorage under `pb_siwe_session`. The message format below MUST
 * stay in sync with parseSiweMessage() in lib/auth/siwe.ts (EIP-4361).
 */

const STORAGE_KEY = "pb_siwe_session"
/** Refresh the access token when it has less than this many ms left. */
const EXPIRY_SKEW_MS = 60_000

export interface SiweSession {
  token: string
  refreshToken: string
  /** ISO timestamp of access-token expiry */
  expiresAt: string
  address: string
}

export type SignMessageFn = (message: string) => Promise<string>

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

export function getStoredSiweSession(): SiweSession | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SiweSession
    if (!parsed?.token || !parsed?.address || !parsed?.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

function storeSiweSession(session: SiweSession): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable (private mode etc.) — auth degrades to per-page state
  }
}

export function clearSiweSession(): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function tokenIsFresh(session: SiweSession): boolean {
  const expiresAt = Date.parse(session.expiresAt)
  if (Number.isNaN(expiresAt)) return false
  return expiresAt - EXPIRY_SKEW_MS > Date.now()
}

/**
 * Synchronously return a usable access token for the given address, or null.
 * Does NOT attempt refresh — use ensureSiweToken() for that.
 */
export function getAccessToken(address?: string | null): string | null {
  const session = getStoredSiweSession()
  if (!session) return null
  if (address && session.address.toLowerCase() !== address.toLowerCase()) return null
  if (!tokenIsFresh(session)) return null
  return session.token
}

/**
 * Build an EIP-4361 message compatible with parseSiweMessage() on the server.
 */
export function buildClientSiweMessage(params: {
  address: string
  nonce: string
  chainId?: number
}): string {
  const domain = window.location.host
  const uri = window.location.origin
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Protocol Banks",
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${params.chainId ?? 1}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n")
}

/**
 * Full SIWE login: nonce → sign → verify. Stores and returns the session.
 * Throws if the user rejects the signature or verification fails.
 */
export async function siweLogin(
  address: string,
  signMessage: SignMessageFn,
  chainId?: number,
): Promise<SiweSession> {
  const nonceRes = await fetch("/api/auth/siwe/nonce")
  if (!nonceRes.ok) throw new Error(`SIWE nonce request failed (${nonceRes.status})`)
  const { nonce } = await nonceRes.json()
  if (!nonce) throw new Error("SIWE nonce missing in response")

  const message = buildClientSiweMessage({ address, nonce, chainId })
  const signature = await signMessage(message)

  const verifyRes = await fetch("/api/auth/siwe/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, signature }),
  })
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}))
    throw new Error(body?.error || `SIWE verification failed (${verifyRes.status})`)
  }

  const data = await verifyRes.json()
  const session: SiweSession = {
    token: data.token,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    address: data.address || address,
  }
  storeSiweSession(session)
  return session
}

/**
 * Try to obtain a fresh access token using the stored refresh token.
 * Returns null (and clears storage on hard failure) when not possible.
 */
export async function refreshSiweToken(): Promise<string | null> {
  const session = getStoredSiweSession()
  if (!session?.refreshToken) return null

  try {
    const res = await fetch("/api/auth/siwe/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
    if (!res.ok) {
      // Refresh token revoked/expired — force a new login next time
      if (res.status === 401) clearSiweSession()
      return null
    }
    const data = await res.json()
    if (!data?.token) return null
    storeSiweSession({ ...session, token: data.token, expiresAt: data.expiresAt })
    return data.token as string
  } catch {
    return null
  }
}

/**
 * Ensure a usable access token for `address`:
 *   1. valid stored token → return it
 *   2. stored refresh token → refresh
 *   3. signMessage provided → interactive SIWE login
 * Returns null when none of the above succeed.
 */
export async function ensureSiweToken(
  address: string,
  signMessage?: SignMessageFn,
  chainId?: number,
): Promise<string | null> {
  const existing = getAccessToken(address)
  if (existing) return existing

  const stored = getStoredSiweSession()
  if (stored && stored.address.toLowerCase() === address.toLowerCase()) {
    const refreshed = await refreshSiweToken()
    if (refreshed) return refreshed
  }

  if (signMessage) {
    const session = await siweLogin(address, signMessage, chainId)
    return session.token
  }

  return null
}
