/**
 * AI Wallet SDK — Main SDK Class
 *
 * Provides a complete headless interface for AI agents to interact
 * with Protocol Banks: authenticate via SIWE, make payments,
 * manage session keys, create invoices, and manage vendors.
 *
 * The AI agent's private key NEVER leaves the agent — all signing
 * is done via the `signMessage` callback provided at initialization.
 */

import { createSiweMessage } from './siwe'
import { PaymentClient, SessionKeyClient, InvoiceClient, VendorClient } from './payments'
import type {
  AIWalletConfig,
  SiweSession,
  NonceResponse,
  AIWalletError as AIWalletErrorType,
} from './types'
import { AIWalletError } from './types'

export class AIWalletSDK {
  private config: Required<Pick<AIWalletConfig, 'walletAddress' | 'signMessage' | 'baseUrl' | 'chainId'>> & {
    onTokenRefresh?: (token: string) => void
  }
  private session: SiweSession | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null

  /** Payment operations (send, list, x402) */
  public readonly payments: PaymentClient
  /** Session key management (create, list, revoke) */
  public readonly sessionKeys: SessionKeyClient
  /** Invoice management (create, list) */
  public readonly invoices: InvoiceClient
  /** Vendor / contact management (create, list) */
  public readonly vendors: VendorClient

  constructor(config: AIWalletConfig) {
    this.config = {
      walletAddress: config.walletAddress,
      signMessage: config.signMessage,
      baseUrl: config.baseUrl?.replace(/\/+$/, '') || 'https://app.protocolbanks.com',
      chainId: config.chainId ?? 1,
      onTokenRefresh: config.onTokenRefresh,
    }

    // Initialize sub-clients, passing `this.request` as their fetch method
    const request = this.request.bind(this)
    this.payments = new PaymentClient(request)
    this.sessionKeys = new SessionKeyClient(request)
    this.invoices = new InvoiceClient(request)
    this.vendors = new VendorClient(request)
  }

  // ─── Authentication ─────────────────────────────────────────────────

  /**
   * Full SIWE login flow:
   * 1. GET nonce from server
   * 2. Build EIP-4361 message
   * 3. AI signs locally (private key never leaves)
   * 4. POST signature to server → receive JWT + refresh token
   * 5. Set up auto-refresh timer
   */
  async connectAndSignIn(): Promise<SiweSession> {
    // Step 1: Get nonce
    const { nonce, expiresAt: nonceExpiry } = await this.fetchJson<NonceResponse>(
      'GET',
      '/api/auth/siwe/nonce'
    )

    // Step 2: Build SIWE message
    const domain = new URL(this.config.baseUrl).host
    const message = createSiweMessage({
      address: this.config.walletAddress,
      nonce,
      domain,
      uri: this.config.baseUrl,
      chainId: this.config.chainId,
      expirationTime: nonceExpiry,
    })

    // Step 3: AI signs the message (private key stays with the AI)
    const signature = await this.config.signMessage(message)

    // Step 4: Verify on server → get JWT + refresh token
    const session = await this.fetchJson<SiweSession>(
      'POST',
      '/api/auth/siwe/verify',
      { message, signature }
    )

    this.session = session

    // Step 5: Set up auto-refresh (5 minutes before expiry)
    this.scheduleRefresh()

    this.config.onTokenRefresh?.(session.token)

    return session
  }

  /**
   * Refresh the current JWT using the refresh token.
   * Called automatically before token expiry, or manually.
   */
  async refreshSession(): Promise<void> {
    if (!this.session?.refreshToken) {
      throw new Error('No active session to refresh. Call connectAndSignIn() first.')
    }

    const result = await this.fetchJson<{ token: string; expiresAt: string; address: string }>(
      'POST',
      '/api/auth/siwe/refresh',
      { refreshToken: this.session.refreshToken }
    )

    this.session = {
      ...this.session,
      token: result.token,
      expiresAt: result.expiresAt,
    }

    this.scheduleRefresh()

    this.config.onTokenRefresh?.(result.token)
  }

  /**
   * Disconnect: clear session and cancel auto-refresh.
   */
  disconnect(): void {
    this.session = null
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * Check whether the SDK has an active (non-expired) session.
   */
  get isAuthenticated(): boolean {
    if (!this.session) return false
    return new Date(this.session.expiresAt).getTime() > Date.now()
  }

  /**
   * Get the current session (or null).
   */
  getSession(): SiweSession | null {
    return this.session
  }

  // ─── Authenticated HTTP Client ──────────────────────────────────────

  /**
   * Make an authenticated API request.
   * Automatically attaches Bearer JWT token.
   * Sub-clients call this method for all API operations.
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.session?.token) {
      throw new Error('Not authenticated. Call connectAndSignIn() first.')
    }

    // Auto-refresh if token expires within 60 seconds
    const expiresIn = new Date(this.session.expiresAt).getTime() - Date.now()
    if (expiresIn < 60_000 && this.session.refreshToken) {
      await this.refreshSession()
    }

    return this.fetchJson<T>(method, path, body, this.session.token)
  }

  // ─── Internal Helpers ───────────────────────────────────────────────

  /**
   * Low-level fetch wrapper: builds URL, sets headers, parses JSON.
   */
  private async fetchJson<T>(
    method: string,
    path: string,
    body?: unknown,
    bearerToken?: string
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: res.statusText }))
      throw new AIWalletError(
        `API ${method} ${path} failed: ${res.status} ${errorBody?.error || res.statusText}`,
        res.status,
        errorBody
      )
    }

    return res.json() as Promise<T>
  }

  /**
   * Schedule automatic token refresh 5 minutes before expiry.
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    if (!this.session?.expiresAt) return

    const expiresAt = new Date(this.session.expiresAt).getTime()
    const now = Date.now()
    // Refresh 5 minutes before expiry (or immediately if less than 5 min left)
    const refreshIn = Math.max(expiresAt - now - 5 * 60 * 1000, 0)

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshSession()
      } catch {
        // Refresh failed — session will expire naturally.
        // Consumer can check `isAuthenticated` and re-login.
      }
    }, refreshIn)
  }
}
