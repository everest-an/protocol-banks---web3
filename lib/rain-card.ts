/**
 * Rain Card API Integration for Protocol Banks
 * 
 * Provides virtual and physical debit card issuance
 * powered by Rain's card issuing infrastructure.
 * 
 * API Reference: https://docs.rain.com/api
 */

// Rain Card Types
export interface RainCard {
  id: string
  user_id: string
  card_type: "virtual" | "physical"
  status: "pending" | "active" | "frozen" | "cancelled"
  last_four: string
  expiry_month: string
  expiry_year: string
  cardholder_name: string
  billing_address?: BillingAddress
  spending_limit: number
  balance: number
  created_at: string
  updated_at: string
}

export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  state?: string
  postal_code: string
  country: string
}

export interface CardDetails extends RainCard {
  card_number: string
  cvv: string
}

export interface CreateCardRequest {
  user_id: string
  card_type: "virtual" | "physical"
  cardholder_name: string
  billing_address: BillingAddress
  spending_limit?: number
  metadata?: Record<string, string>
}

export interface TopUpRequest {
  card_id: string
  amount: number
  currency: string
  source: "wallet" | "bank"
  source_address?: string
}

export interface Transaction {
  id: string
  card_id: string
  type: "purchase" | "refund" | "topup" | "withdrawal"
  amount: number
  currency: string
  merchant_name?: string
  merchant_category?: string
  status: "pending" | "completed" | "declined" | "reversed"
  created_at: string
  settled_at?: string
}

export interface CardStats {
  total_spent: number
  total_transactions: number
  available_balance: number
  pending_transactions: number
}

// API Configuration
const RAIN_API_URL = process.env.RAIN_API_URL || "https://api.rain.com/v1"
const RAIN_API_KEY = process.env.RAIN_API_KEY || ""

/**
 * Rain Card Service
 */
export class RainCardService {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || RAIN_API_KEY
    this.baseUrl = RAIN_API_URL
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "X-API-Version": "2024-01",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `Rain API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Create a new card (virtual or physical)
   */
  async createCard(data: CreateCardRequest): Promise<RainCard> {
    return this.request<RainCard>("/cards", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Get card by ID
   */
  async getCard(cardId: string): Promise<RainCard> {
    return this.request<RainCard>(`/cards/${cardId}`)
  }

  /**
   * Get sensitive card details (PCI compliant)
   * Requires additional authentication and should only be called
   * from secure server environment
   */
  async getCardDetails(cardId: string): Promise<CardDetails> {
    return this.request<CardDetails>(`/cards/${cardId}/sensitive`, {
      headers: {
        "X-Request-Reason": "user_view",
      },
    })
  }

  /**
   * List all cards for a user
   */
  async listCards(userId: string): Promise<RainCard[]> {
    const response = await this.request<{ cards: RainCard[] }>(
      `/cards?user_id=${userId}`
    )
    return response.cards
  }

  /**
   * Freeze a card
   */
  async freezeCard(cardId: string): Promise<RainCard> {
    return this.request<RainCard>(`/cards/${cardId}/freeze`, {
      method: "POST",
    })
  }

  /**
   * Unfreeze a card
   */
  async unfreezeCard(cardId: string): Promise<RainCard> {
    return this.request<RainCard>(`/cards/${cardId}/unfreeze`, {
      method: "POST",
    })
  }

  /**
   * Cancel a card permanently
   */
  async cancelCard(cardId: string, reason?: string): Promise<RainCard> {
    return this.request<RainCard>(`/cards/${cardId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  }

  /**
   * Update card spending limit
   */
  async updateSpendingLimit(
    cardId: string,
    limit: number
  ): Promise<RainCard> {
    return this.request<RainCard>(`/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify({ spending_limit: limit }),
    })
  }

  /**
   * Top up card balance
   */
  async topUp(data: TopUpRequest): Promise<Transaction> {
    return this.request<Transaction>("/transactions/topup", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Get card transactions
   */
  async getTransactions(
    cardId: string,
    options?: {
      limit?: number
      offset?: number
      from_date?: string
      to_date?: string
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const params = new URLSearchParams()
    params.set("card_id", cardId)
    if (options?.limit) params.set("limit", options.limit.toString())
    if (options?.offset) params.set("offset", options.offset.toString())
    if (options?.from_date) params.set("from_date", options.from_date)
    if (options?.to_date) params.set("to_date", options.to_date)

    return this.request<{ transactions: Transaction[]; total: number }>(
      `/transactions?${params.toString()}`
    )
  }

  /**
   * Get card statistics
   */
  async getCardStats(cardId: string): Promise<CardStats> {
    return this.request<CardStats>(`/cards/${cardId}/stats`)
  }

  /**
   * Get supported countries for card issuance
   */
  async getSupportedCountries(): Promise<string[]> {
    const response = await this.request<{ countries: string[] }>("/config/countries")
    return response.countries
  }
}

// Export default instance
export const rainCard = new RainCardService()
