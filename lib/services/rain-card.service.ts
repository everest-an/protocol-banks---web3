/**
 * Rain card issuing client (outbound).
 *
 * Rain's model differs from Yativo's: the user completes a KYC application and
 * receives a per-user deposit contract, users fund their own card by sending
 * stablecoins to that address, and cards are issued per user. Card secrets
 * (PAN/CVC) come back ENCRYPTED and must be relayed to the browser, which
 * decrypts locally — plaintext card data must never reach this server.
 *
 * Auth: `Api-Key` header. Base URL: RAIN_API_URL, defaulting to the dev
 * sandbox. Production access requires a partner agreement with Rain; the
 * webhook side is already received by services/webhook-handler (RAIN_WEBHOOK_SECRET).
 *
 * Endpoints implemented (from the public Rain issuing API):
 *   POST /applications/user            KYC application → userId
 *   POST /users/:userId/contracts      create the per-user deposit contract
 *   GET  /users/:userId/contracts      deposit address per chain
 *   POST /users/:userId/cards          issue a card
 *   GET  /cards?userId=…               list a user's cards
 *   GET  /cards/:cardId/secrets        encrypted PAN/CVC (SessionId relay)
 *   GET  /users/:userId/balances       spending power
 */
import { logger } from "@/lib/logger/structured-logger"

const DEFAULT_BASE_URL = "https://api-dev.raincards.xyz/v1/issuing"
const REQUEST_TIMEOUT_MS = 15_000

export interface RainConfig {
  apiKey: string
  baseUrl: string
}

export interface RainUserApplication {
  userId: string
  applicationStatus: string
}

export interface RainContract {
  id?: string
  chainId: number
  depositAddress: string
  [key: string]: unknown
}

export interface RainCard {
  id: string
  type: string
  status: string
  last4?: string
  expirationMonth?: string
  expirationYear?: string
  limit?: { frequency: string; amount: number }
  [key: string]: unknown
}

export interface RainEncryptedSecrets {
  encryptedPan: string
  encryptedCvc: string
  [key: string]: unknown
}

export interface RainBalances {
  spendingPower: number
  [key: string]: unknown
}

export function rainConfig(): RainConfig | null {
  const apiKey = process.env.RAIN_API_KEY
  if (!apiKey) return null
  return { apiKey, baseUrl: process.env.RAIN_API_URL || DEFAULT_BASE_URL }
}

export function isRainConfigured(): boolean {
  return rainConfig() !== null
}

/** Rain's KYC application payload (sandbox accepts historical/test values). */
export interface RainApplicationInput {
  firstName: string
  lastName: string
  email: string
  walletAddress: string
  birthDate: string
  nationalId: string
  countryOfIssue: string
  address: {
    line1: string
    city: string
    region: string
    postalCode: string
    countryCode: string
  }
  ipAddress: string
  phoneCountryCode: string
  phoneNumber: string
  annualSalary: string
  accountPurpose: string
  expectedMonthlyVolume: string
  isTermsOfServiceAccepted: boolean
}

async function rainRequest<T>(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}): Promise<T> {
  const config = rainConfig()
  if (!config) {
    throw new Error(
      "Rain is not configured (set RAIN_API_KEY). Refusing to fabricate a card operation.",
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Api-Key": config.apiKey,
        "Content-Type": "application/json",
        ...extraHeaders,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Rain API error [${response.status}] ${path}: ${text.slice(0, 200)}`)
    }
    return (text ? JSON.parse(text) : {}) as T
  } finally {
    clearTimeout(timer)
  }
}

export const rainCardService = {
  isConfigured: isRainConfigured,

  /** Submit the KYC application; Rain returns the userId used by every other call. */
  async createUserApplication(input: RainApplicationInput): Promise<RainUserApplication> {
    const result = await rainRequest<{ id: string; applicationStatus: string }>("/applications/user", {
      method: "POST",
      body: JSON.stringify(input),
    })
    logger.info("[Rain] user application submitted", { component: "rain-card", userId: result.id })
    return { userId: result.id, applicationStatus: result.applicationStatus }
  },

  /** Create the per-user deposit contract (users fund their card there). */
  async createUserContract(userId: string, chainId: number): Promise<void> {
    await rainRequest(`/users/${encodeURIComponent(userId)}/contracts`, {
      method: "POST",
      body: JSON.stringify({ chainId }),
    })
  },

  /** Deposit addresses per chain — the funding target shown to the user. */
  async getUserContracts(userId: string): Promise<RainContract[]> {
    const contracts = await rainRequest<RainContract[] | { data?: RainContract[] }>(
      `/users/${encodeURIComponent(userId)}/contracts`,
    )
    return Array.isArray(contracts) ? contracts : contracts.data ?? []
  },

  /** Issue a virtual card for an approved user. */
  async issueCard(
    userId: string,
    options: { displayName: string; limit?: { frequency: string; amount: number } } = { displayName: "" },
  ): Promise<RainCard> {
    return rainRequest<RainCard>(`/users/${encodeURIComponent(userId)}/cards`, {
      method: "POST",
      body: JSON.stringify({
        type: "virtual",
        status: "active",
        displayName: options.displayName,
        ...(options.limit ? { limit: options.limit } : {}),
      }),
    })
  },

  async listCards(userId: string, limit = 20): Promise<RainCard[]> {
    const cards = await rainRequest<RainCard[] | { data?: RainCard[] }>(
      `/cards?userId=${encodeURIComponent(userId)}&limit=${limit}`,
    )
    return Array.isArray(cards) ? cards : cards.data ?? []
  },

  /**
   * Encrypted PAN/CVC. `sessionId` is minted in the browser, which holds the
   * AES key — this server only relays the ciphertext and never sees plaintext.
   */
  async getCardSecrets(cardId: string, sessionId: string): Promise<RainEncryptedSecrets> {
    return rainRequest<RainEncryptedSecrets>(
      `/cards/${encodeURIComponent(cardId)}/secrets`,
      {},
      { SessionId: sessionId },
    )
  },

  async getUserBalances(userId: string): Promise<RainBalances> {
    const balances = await rainRequest<RainBalances & { data?: RainBalances }>(
      `/users/${encodeURIComponent(userId)}/balances`,
    )
    return (balances.data ?? balances) as RainBalances
  },
}

export type RainCardService = typeof rainCardService
