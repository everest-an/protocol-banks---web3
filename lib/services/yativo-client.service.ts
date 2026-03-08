/**
 * Yativo API Client Service
 *
 * Encapsulates all interactions with the Yativo Card Issuing API.
 * Yativo supports USDC/USDT-funded virtual Visa cards for online spending.
 *
 * API Docs: https://docs.yativo.com
 * Env vars required:
 *   - YATIVO_API_KEY
 *   - YATIVO_API_SECRET
 *   - YATIVO_API_URL (optional, defaults to production)
 *
 * @module lib/services/yativo-client.service
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type YativoCardStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'PENDING'
export type YativoFundingToken = 'USDC' | 'USDT'

export interface YativoCard {
  id: string
  last4: string
  status: YativoCardStatus
  balance: number
  currency: string
  spending_limit: number | null
  created_at: string
  updated_at: string
}

export interface YativoCardDetails extends YativoCard {
  pan: string      // Full card number
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

export interface YativoDepositAddress {
  address: string
  network: string
  token: YativoFundingToken
  memo?: string
}

export interface YativoCreateCardParams {
  /** Initial funding amount in USD */
  initial_amount: number
  /** Optional spending limit */
  spending_limit?: number
  /** Card label for identification */
  label?: string
}

export interface YativoFundCardParams {
  card_id: string
  amount: number
}

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.YATIVO_API_URL ?? 'https://api.yativo.com/v1'
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
    'X-API-Key': API_KEY,
    'X-API-Secret': API_SECRET,
    ...(options.headers as Record<string, string> ?? {}),
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(`Yativo API error [${response.status}] ${path}: ${errorBody}`)
  }

  return response.json() as Promise<T>
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const yativoClient = {
  /**
   * Get the platform's current USD balance on Yativo.
   * This balance is funded by USDC/USDT deposits.
   */
  async getPlatformBalance(): Promise<YativoBalance> {
    return yativoFetch<YativoBalance>('/accounts/balance')
  },

  /**
   * Get the USDC/USDT deposit address for funding the platform balance.
   * Users send stablecoins to this address; Yativo converts 1:1 to USD.
   */
  async getDepositAddress(token: YativoFundingToken = 'USDC'): Promise<YativoDepositAddress> {
    return yativoFetch<YativoDepositAddress>(`/accounts/deposit-address?token=${token}`)
  },

  /**
   * List all virtual cards issued by this platform.
   */
  async listCards(): Promise<YativoCard[]> {
    const res = await yativoFetch<{ data: YativoCard[] }>('/cards')
    return res.data
  },

  /**
   * Create a new virtual Visa card and fund it from the platform balance.
   * The card is immediately ready for online spending.
   */
  async createCard(params: YativoCreateCardParams): Promise<YativoCard> {
    return yativoFetch<YativoCard>('/cards', {
      method: 'POST',
      body: JSON.stringify({
        initial_amount: params.initial_amount,
        spending_limit: params.spending_limit ?? params.initial_amount,
        label: params.label,
        currency: 'USD',
      }),
    })
  },

  /**
   * Get full card details including PAN, CVV, and expiry.
   * This is a sensitive operation and should be logged.
   */
  async getCardDetails(cardId: string): Promise<YativoCardDetails> {
    return yativoFetch<YativoCardDetails>(`/cards/${cardId}/details`)
  },

  /**
   * Get card summary (balance, status) without exposing sensitive credentials.
   */
  async getCard(cardId: string): Promise<YativoCard> {
    return yativoFetch<YativoCard>(`/cards/${cardId}`)
  },

  /**
   * Add funds to an existing card from the platform balance.
   */
  async fundCard(params: YativoFundCardParams): Promise<YativoCard> {
    return yativoFetch<YativoCard>(`/cards/${params.card_id}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: params.amount }),
    })
  },

  /**
   * Freeze a card to temporarily block all transactions.
   */
  async freezeCard(cardId: string): Promise<YativoCard> {
    return yativoFetch<YativoCard>(`/cards/${cardId}/freeze`, { method: 'POST' })
  },

  /**
   * Unfreeze a previously frozen card.
   */
  async unfreezeCard(cardId: string): Promise<YativoCard> {
    return yativoFetch<YativoCard>(`/cards/${cardId}/unfreeze`, { method: 'POST' })
  },

  /**
   * Permanently close a card. This action is irreversible.
   * Any remaining balance is returned to the platform balance.
   */
  async closeCard(cardId: string): Promise<{ success: boolean; refunded_amount: number }> {
    return yativoFetch(`/cards/${cardId}/close`, { method: 'POST' })
  },
}
