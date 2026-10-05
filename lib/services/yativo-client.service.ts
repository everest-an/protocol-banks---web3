/**
 * Yativo Crypto API Client Service
 *
 * Encapsulates interactions with the Yativo Crypto platform (crypto.yativo.com):
 * crypto-funded virtual cards, wallets, accounts and the card issuer program.
 *
 * API base:  https://crypto-api.yativo.com/api        (live)
 *            https://crypto-sandbox.yativo.com/api    (sandbox — card features are mock)
 * Auth:      POST /auth/token { api_key, api_secret } → Bearer token (60 min).
 *            API keys are created in the crypto dashboard and require 2FA on
 *            the account. Tokens are cached and re-fetched on a 401.
 *
 * Env vars:
 *   - YATIVO_API_KEY     (API key from the crypto dashboard)
 *   - YATIVO_API_SECRET  (secret shown once at key creation)
 *   - YATIVO_BASE_URL    (optional; defaults to the live crypto API)
 *
 * @module lib/services/yativo-client.service
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type YativoCardStatus = 'active' | 'inactive' | 'frozen' | 'terminated' | 'pending'
export type YativoFundingToken = 'USDC' | 'USDT'

export interface YativoCard {
  id: string
  card_id?: string
  last4?: string
  card_number?: string
  status: YativoCardStatus
  balance: number
  currency: string
  spending_limit: number | null
  brand?: string
  card_name?: string
  created_at: string
  updated_at: string
}

export interface YativoCardDetails extends YativoCard {
  pan: string
  cvv: string
  expiry_month: string
  expiry_year: string
  billing_address?: {
    line1: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}

export interface YativoBalance {
  available: number
  pending: number
  currency: string
}

export interface YativoWalletBalance {
  status: string
  data: Array<{
    currency: string
    balance: number
    available_balance: number
  }>
}

export interface YativoDepositAddress {
  address: string
  network: string
  token: YativoFundingToken
  memo?: string
}

export interface YativoCreateCardParams {
  /** Customer ID (required by Yativo) */
  customer_id?: string
  /** Initial funding amount in USD */
  amount: number
  /** Card name/label */
  name_on_card?: string
  /** Card brand: visa or mastercard */
  brand?: string
  /** Card currency */
  currency?: string
}

export interface YativoFundCardParams {
  card_id: string
  amount: number
}

export interface YativoApiResponse<T = unknown> {
  status: string
  status_code: number
  message: string
  data: T
}

// ─── Config ─────────────────────────────────────────────────────────────────

// Yativo Crypto platform API.
// Sandbox: https://crypto-sandbox.yativo.com/api (cards are mock there)
const BASE_URL =
  process.env.YATIVO_BASE_URL ?? process.env.YATIVO_API_URL ?? 'https://crypto-api.yativo.com/api'
const API_KEY = process.env.YATIVO_API_KEY ?? ''
const API_SECRET = process.env.YATIVO_API_SECRET ?? ''

// ─── Auth ───────────────────────────────────────────────────────────────────
//
// The crypto platform exchanges an API key + secret for a short-lived Bearer
// token: POST /auth/token { api_key, api_secret } → access_token (60 min).
// Contract verified against the live API — bad keys answer
//   401 {"success":false,"error":"Invalid, expired, or revoked API key"}.
// Tokens are cached until shortly before expiry and re-fetched on a 401.

let tokenCache: { token: string; expiresAt: number } | null = null

async function fetchBearerToken(): Promise<string> {
  const path = '/auth/token'
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, api_secret: API_SECRET }),
  })
  const text = await response.text()
  let data: Record<string, unknown> | null = null
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Yativo auth returned non-JSON [${response.status}] ${path}: ${text.slice(0, 200)}`)
  }
  if (!response.ok) {
    const message = (data?.message as string) ?? (data?.error as string) ?? text.slice(0, 200)
    throw new Error(`Yativo auth failed [${response.status}] ${path}: ${message}`)
  }
  const nested = (data?.data ?? {}) as Record<string, unknown>
  const token = (nested.access_token ?? data?.access_token) as string | undefined
  const expiresIn = Number(nested.expires_in ?? data?.expires_in ?? 3600)
  if (!token) throw new Error(`Yativo auth response missing access_token: ${text.slice(0, 200)}`)
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
}

async function authHeaders(): Promise<Record<string, string>> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return { Authorization: `Bearer ${tokenCache.token}` }
  }
  return { Authorization: `Bearer ${await fetchBearerToken()}` }
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function yativoFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOnAuthFailure = true,
): Promise<T> {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Yativo API credentials not configured. Set YATIVO_API_KEY and YATIVO_API_SECRET.')
  }

  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(await authHeaders()),
    ...(options.headers as Record<string, string> ?? {}),
  }

  console.log(`[Yativo] ${options.method ?? 'GET'} ${path}`)

  const response = await fetch(url, { ...options, headers })

  // A stale token looks identical to bad credentials; refresh once and retry.
  if (response.status === 401 && retryOnAuthFailure) {
    tokenCache = null
    return yativoFetch<T>(path, options, false)
  }

  const responseText = await response.text()
  let responseData: T

  try {
    responseData = JSON.parse(responseText) as T
  } catch {
    throw new Error(`Yativo API returned non-JSON [${response.status}] ${path}: ${responseText.substring(0, 200)}`)
  }

  if (!response.ok) {
    const errorMsg = (responseData as YativoApiResponse)?.message ?? responseText.substring(0, 200)
    const errorData = (responseData as YativoApiResponse)?.data
    throw new Error(`Yativo API error [${response.status}] ${path}: ${errorMsg} ${JSON.stringify(errorData)}`)
  }

  return responseData
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * True when a failure means the provider is unconfigured or rejected our
 * credentials — a provisioning problem (503), not a server fault (500).
 */
export function isYativoConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /not configured|auth failed|invalid login credentials|invalid or revoked|Yativo API error \[401\]/i.test(
    message,
  )
}

export const yativoClient = {
  /**
   * List the accounts on the crypto platform (connectivity check).
   * Endpoint: GET /accounts/get-accounts
   */
  async getAccounts(): Promise<unknown> {
    return yativoFetch<unknown>('/accounts/get-accounts')
  },

  /**
   * Get the platform's wallet balances on Yativo.
   */
  async getWalletBalance(): Promise<YativoWalletBalance> {
    return yativoFetch<YativoWalletBalance>('/wallet/balance')
  },

  /**
   * Get total balance across all wallets.
   */
  async getTotalBalance(): Promise<YativoApiResponse<{ total_balance: number }>> {
    return yativoFetch<YativoApiResponse<{ total_balance: number }>>('/wallet/balance/total')
  },

  /**
   * Get the USDC/USDT deposit address for funding the platform balance.
   * Users send stablecoins to this address; Yativo converts 1:1 to USD.
   */
  async getDepositAddress(token: YativoFundingToken = 'USDC'): Promise<YativoApiResponse<YativoDepositAddress>> {
    return yativoFetch<YativoApiResponse<YativoDepositAddress>>(`/wallet/deposit-address?token=${token}`)
  },

  /**
   * List all virtual cards.
   * Endpoint: GET /customer/virtual/cards/list
   */
  async listCards(): Promise<YativoApiResponse<YativoCard[]>> {
    return yativoFetch<YativoApiResponse<YativoCard[]>>('/customer/virtual/cards/list')
  },

  /**
   * Create a new virtual Visa card.
   * Endpoint: POST /customer/virtual/cards/create
   */
  async createCard(params: YativoCreateCardParams): Promise<YativoApiResponse<YativoCard>> {
    return yativoFetch<YativoApiResponse<YativoCard>>('/customer/virtual/cards/create', {
      method: 'POST',
      body: JSON.stringify({
        amount: params.amount,
        name_on_card: params.name_on_card ?? 'Protocol Banks Card',
        brand: params.brand ?? 'visa',
        currency: params.currency ?? 'USD',
        ...(params.customer_id ? { customer_id: params.customer_id } : {}),
      }),
    })
  },

  /**
   * Activate a virtual card.
   * Endpoint: POST /customer/virtual/cards/activate
   */
  async activateCard(cardId: string): Promise<YativoApiResponse<YativoCard>> {
    return yativoFetch<YativoApiResponse<YativoCard>>('/customer/virtual/cards/activate', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId }),
    })
  },

  /**
   * Top up (add funds to) an existing card.
   * Endpoint: POST /customer/virtual/cards/topup
   */
  async fundCard(params: YativoFundCardParams): Promise<YativoApiResponse<YativoCard>> {
    return yativoFetch<YativoApiResponse<YativoCard>>('/customer/virtual/cards/topup', {
      method: 'POST',
      body: JSON.stringify({
        card_id: params.card_id,
        amount: params.amount,
      }),
    })
  },

  /**
   * Withdraw funds from a card back to platform balance.
   * Endpoint: POST /customer/virtual/cards/withdraw
   */
  async withdrawFromCard(cardId: string, amount: number): Promise<YativoApiResponse<YativoCard>> {
    return yativoFetch<YativoApiResponse<YativoCard>>('/customer/virtual/cards/withdraw', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId, amount }),
    })
  },

  /**
   * Terminate (permanently close) a card.
   * Endpoint: POST /customer/virtual/cards/terminate
   */
  async terminateCard(cardId: string): Promise<YativoApiResponse<{ success: boolean }>> {
    return yativoFetch<YativoApiResponse<{ success: boolean }>>('/customer/virtual/cards/terminate', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId }),
    })
  },

  /**
   * Get business details.
   */
  async getBusinessDetails(): Promise<YativoApiResponse<unknown>> {
    return yativoFetch<YativoApiResponse<unknown>>('/business/details')
  },

  /**
   * Get all supported currencies.
   */
  async getCurrencies(): Promise<YativoApiResponse<unknown[]>> {
    return yativoFetch<YativoApiResponse<unknown[]>>('/currencies/all')
  },
}
