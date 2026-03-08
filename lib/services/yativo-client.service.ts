/**
 * Yativo API Client Service
 *
 * Encapsulates all interactions with the Yativo Card Issuing API.
 * Yativo supports USDC/USDT-funded virtual Visa cards for online spending.
 *
 * API Base: https://smtp.yativo.com/api/v1
 * Auth: account-id + api-secret headers
 *
 * Virtual Card endpoints (extracted from Yativo frontend):
 *   POST /customer/virtual/cards/create
 *   GET  /customer/virtual/cards/list
 *   POST /customer/virtual/cards/activate
 *   POST /customer/virtual/cards/topup
 *   POST /customer/virtual/cards/withdraw
 *   POST /customer/virtual/cards/terminate
 *
 * Env vars required:
 *   - YATIVO_API_KEY     (account-id)
 *   - YATIVO_API_SECRET  (api-secret)
 *   - YATIVO_API_URL     (optional, defaults to sandbox)
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

const BASE_URL = process.env.YATIVO_API_URL ?? 'https://smtp.yativo.com/api/v1'
const API_KEY = process.env.YATIVO_API_KEY ?? ''
const API_SECRET = process.env.YATIVO_API_SECRET ?? ''

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function yativoFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Yativo API credentials not configured. Set YATIVO_API_KEY and YATIVO_API_SECRET.')
  }

  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'account-id': API_KEY,
    'api-secret': API_SECRET,
    ...(options.headers as Record<string, string> ?? {}),
  }

  console.log(`[Yativo] ${options.method ?? 'GET'} ${path}`)

  const response = await fetch(url, { ...options, headers })

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

export const yativoClient = {
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
