/**
 * Off-Ramp Service Integration
 *
 * Converts crypto (USDC) back to fiat currency via multiple providers.
 * Tries real provider APIs when configured, falls back to mock quotes for development.
 *
 * Supported Providers:
 * - Coinbase Onramp/Offramp API
 * - Bridge.xyz
 * - Transak
 * - MoonPay (widget-only)
 */

import { prisma } from "@/lib/prisma"

// ============================================
// Types
// ============================================

export type OffRampProvider = "coinbase" | "bridge" | "transak" | "moonpay"

export interface OffRampRequest {
  walletAddress: string
  amount: string
  token: "USDC" | "USDT"
  chainId: number
  targetCurrency: string // USD, EUR, etc.
  bankAccount?: {
    type: "ach" | "sepa" | "wire"
    accountNumber?: string
    routingNumber?: string
    iban?: string
    swift?: string
  }
  provider: OffRampProvider
}

export interface OffRampQuote {
  provider: OffRampProvider | "mock"
  inputAmount: string
  inputToken: string
  outputAmount: string
  outputCurrency: string
  fee: string
  exchangeRate: string
  expiresAt: number
  quoteId: string
}

export interface OffRampTransaction {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  provider: OffRampProvider
  inputAmount: string
  inputToken: string
  outputAmount: string
  outputCurrency: string
  txHash?: string
  createdAt: string
  completedAt?: string
  bankReference?: string
}

// ============================================
// Provider Configuration
// ============================================

const PROVIDER_CONFIG = {
  coinbase: {
    apiUrl: process.env.COINBASE_ONRAMP_API_URL,
    apiKey: process.env.COINBASE_ONRAMP_API_KEY,
    get enabled() { return !!this.apiKey },
  },
  bridge: {
    apiUrl: process.env.BRIDGE_API_URL || "https://api.bridge.xyz",
    apiKey: process.env.BRIDGE_API_KEY,
    get enabled() { return !!this.apiKey },
  },
  transak: {
    apiUrl: process.env.TRANSAK_API_URL || "https://api.transak.com",
    apiKey: process.env.TRANSAK_API_KEY,
    get enabled() { return !!this.apiKey },
  },
}

// ============================================
// Quote Functions
// ============================================

/**
 * Get off-ramp quote from provider.
 * Tries the requested provider first, then falls back to others, then mock.
 */
export async function getOffRampQuote(
  amount: string,
  token: "USDC" | "USDT",
  targetCurrency = "USD",
  provider: OffRampProvider = "coinbase",
): Promise<OffRampQuote> {
  // Try the requested provider first
  const providerQuoteFns: Record<string, () => Promise<OffRampQuote | null>> = {
    bridge: () => getBridgeQuote(amount, token, targetCurrency),
    coinbase: () => getCoinbaseQuote(amount, token, targetCurrency),
    transak: () => getTransakQuote(amount, token, targetCurrency),
  }

  // Try requested provider
  if (providerQuoteFns[provider]) {
    const quote = await providerQuoteFns[provider]()
    if (quote) return quote
  }

  // Try other providers as fallback
  for (const [name, fn] of Object.entries(providerQuoteFns)) {
    if (name === provider) continue
    const quote = await fn()
    if (quote) return quote
  }

  // No provider available: mock only for explicit local development; refuse
  // otherwise so callers never act on a quote that no provider gave.
  if (process.env.ALLOW_MOCK_EXECUTION === "true" && process.env.NODE_ENV !== "production") {
    console.warn("[OffRamp] ALLOW_MOCK_EXECUTION enabled — returning a MOCK quote (local development only)")
    return getMockQuote(amount, token, targetCurrency, provider)
  }
  throw new Error(
    "No off-ramp provider configured. Set BRIDGE_API_KEY, COINBASE_ONRAMP_API_KEY or TRANSAK_API_KEY. " +
      "Refusing to return a mock quote — for local testing set ALLOW_MOCK_EXECUTION=true.",
  )
}

/**
 * Get quote from Bridge.xyz
 */
async function getBridgeQuote(
  amount: string,
  token: string,
  targetCurrency: string,
): Promise<OffRampQuote | null> {
  if (!PROVIDER_CONFIG.bridge.enabled) return null

  try {
    const response = await fetch(`${PROVIDER_CONFIG.bridge.apiUrl}/v0/quotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PROVIDER_CONFIG.bridge.apiKey!,
      },
      body: JSON.stringify({
        source_currency: token,
        destination_currency: targetCurrency,
        amount,
        on_ramp_or_off_ramp: "off_ramp",
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const totalFee = parseFloat(data.total_fee || "0")

    return {
      provider: "bridge",
      inputAmount: amount,
      inputToken: token,
      outputAmount: data.destination_amount || "0",
      outputCurrency: targetCurrency,
      fee: totalFee.toFixed(2),
      exchangeRate: (data.exchange_rate || 1).toString(),
      expiresAt: Date.now() + 300000,
      quoteId: data.id || `bridge_${Date.now()}`,
    }
  } catch (error) {
    console.error("[OffRamp] Bridge quote error:", error)
    return null
  }
}

/**
 * Get quote from Coinbase
 */
async function getCoinbaseQuote(
  amount: string,
  token: string,
  targetCurrency: string,
): Promise<OffRampQuote | null> {
  if (!PROVIDER_CONFIG.coinbase.enabled) return null

  try {
    const response = await fetch(`${PROVIDER_CONFIG.coinbase.apiUrl}/offramp/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PROVIDER_CONFIG.coinbase.apiKey}`,
      },
      body: JSON.stringify({
        purchase_currency: targetCurrency,
        payment_currency: token,
        payment_amount: amount,
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const totalFee = parseFloat(data.total_fee || "0")

    return {
      provider: "coinbase",
      inputAmount: amount,
      inputToken: token,
      outputAmount: data.purchase_amount || "0",
      outputCurrency: targetCurrency,
      fee: totalFee.toFixed(2),
      exchangeRate: (data.exchange_rate || 1).toString(),
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 300000,
      quoteId: data.quote_id || `cb_${Date.now()}`,
    }
  } catch (error) {
    console.error("[OffRamp] Coinbase quote error:", error)
    return null
  }
}

/**
 * Get quote from Transak
 */
async function getTransakQuote(
  amount: string,
  token: string,
  targetCurrency: string,
): Promise<OffRampQuote | null> {
  if (!PROVIDER_CONFIG.transak.enabled) return null

  try {
    const response = await fetch(
      `${PROVIDER_CONFIG.transak.apiUrl}/api/v2/currencies/price?` +
      new URLSearchParams({
        fiatCurrency: targetCurrency,
        cryptoCurrency: token,
        isBuyOrSell: "SELL",
        cryptoAmount: amount,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const totalFee = parseFloat(data.response?.totalFee?.toString() || "0")

    return {
      provider: "transak",
      inputAmount: amount,
      inputToken: token,
      outputAmount: data.response?.fiatAmount?.toString() || "0",
      outputCurrency: targetCurrency,
      fee: totalFee.toFixed(2),
      exchangeRate: (data.response?.conversionPrice || 1).toString(),
      expiresAt: Date.now() + 300000,
      quoteId: `transak_${Date.now()}`,
    }
  } catch (error) {
    console.error("[OffRamp] Transak quote error:", error)
    return null
  }
}

/**
 * Mock quote for development when no provider is configured
 */
function getMockQuote(
  amount: string,
  token: string,
  targetCurrency: string,
  provider: OffRampProvider,
): OffRampQuote {
  const parsedAmount = Number.parseFloat(amount)
  const fee = parsedAmount * 0.015 // 1.5% fee estimate
  const outputAmount = (parsedAmount - fee).toFixed(2)

  return {
    provider,
    inputAmount: amount,
    inputToken: token,
    outputAmount,
    outputCurrency: targetCurrency,
    fee: fee.toFixed(2),
    exchangeRate: "1.00",
    expiresAt: Date.now() + 300000,
    quoteId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  }
}

// ============================================
// Transaction Functions
// ============================================

/**
 * Initiate off-ramp transaction via provider API
 */
export async function initiateOffRamp(request: OffRampRequest): Promise<OffRampTransaction> {
  const transactionId = `offramp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  // Try to execute via provider API
  let providerOrderId: string | undefined
  let outputAmount = (Number.parseFloat(request.amount) * 0.985).toFixed(2)

  if (request.provider === "bridge" && PROVIDER_CONFIG.bridge.enabled) {
    try {
      const response = await fetch(`${PROVIDER_CONFIG.bridge.apiUrl}/v0/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": PROVIDER_CONFIG.bridge.apiKey!,
        },
        body: JSON.stringify({
          amount: request.amount,
          on_behalf_of: request.walletAddress,
          source: {
            payment_rail: "ethereum",
            currency: request.token,
            from_address: request.walletAddress,
          },
          destination: {
            payment_rail: request.bankAccount?.type === "sepa" ? "sepa" : "ach",
            currency: request.targetCurrency,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        providerOrderId = data.id
        if (data.destination_amount) {
          outputAmount = data.destination_amount
        }
      }
    } catch (error) {
      console.error("[OffRamp] Bridge execution error:", error)
    }
  } else if (request.provider === "coinbase" && PROVIDER_CONFIG.coinbase.enabled) {
    try {
      const response = await fetch(`${PROVIDER_CONFIG.coinbase.apiUrl}/offramp/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PROVIDER_CONFIG.coinbase.apiKey}`,
        },
        body: JSON.stringify({
          wallet_address: request.walletAddress,
          amount: request.amount,
          currency: request.token,
          target_currency: request.targetCurrency,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        providerOrderId = data.order_id
        if (data.target_amount) {
          outputAmount = data.target_amount
        }
      }
    } catch (error) {
      console.error("[OffRamp] Coinbase execution error:", error)
    }
  }

  const transaction: OffRampTransaction = {
    id: transactionId,
    status: "pending",
    provider: request.provider,
    inputAmount: request.amount,
    inputToken: request.token,
    outputAmount,
    outputCurrency: request.targetCurrency,
    createdAt: new Date().toISOString(),
  }

  // Record in database
  try {
    await prisma.offrampTransaction.create({
      data: {
        reference_id: transactionId,
        wallet_address: request.walletAddress.toLowerCase(),
        provider: request.provider,
        provider_tx_id: providerOrderId,
        crypto_amount: parseFloat(request.amount),
        token: request.token,
        chain_id: request.chainId,
        fiat_amount: parseFloat(outputAmount),
        fiat_currency: request.targetCurrency,
        payout_method: request.bankAccount?.type || "bank_transfer",
        status: "pending",
      },
    })
  } catch (error) {
    console.warn("[OffRamp] DB recording failed:", error)
  }

  return transaction
}

/**
 * Get off-ramp transaction status
 */
export async function getOffRampStatus(transactionId: string): Promise<OffRampTransaction | null> {
  try {
    const data = await prisma.offrampTransaction.findUnique({
      where: { reference_id: transactionId },
    })

    if (!data) return null

    return {
      id: data.reference_id,
      status: data.status as OffRampTransaction["status"],
      provider: data.provider as OffRampProvider,
      inputAmount: data.crypto_amount.toString(),
      inputToken: data.token,
      outputAmount: data.fiat_amount.toString(),
      outputCurrency: data.fiat_currency,
      txHash: data.tx_hash || undefined,
      createdAt: data.created_at.toISOString(),
      bankReference: data.bank_details || undefined,
    }
  } catch {
    return null
  }
}

/**
 * Get user's off-ramp history
 */
export async function getOffRampHistory(walletAddress: string): Promise<OffRampTransaction[]> {
  try {
    const data = await prisma.offrampTransaction.findMany({
      where: { wallet_address: walletAddress.toLowerCase() },
      orderBy: { created_at: "desc" },
      take: 50,
    })

    return data.map((row) => ({
      id: row.reference_id,
      status: row.status as OffRampTransaction["status"],
      provider: row.provider as OffRampProvider,
      inputAmount: row.crypto_amount.toString(),
      inputToken: row.token,
      outputAmount: row.fiat_amount.toString(),
      outputCurrency: row.fiat_currency,
      txHash: row.tx_hash || undefined,
      createdAt: row.created_at.toISOString(),
      bankReference: row.bank_details || undefined,
    }))
  } catch {
    return []
  }
}

/**
 * Auto off-ramp trigger
 * Automatically initiates off-ramp when balance exceeds threshold
 */
export async function checkAutoOffRamp(
  walletAddress: string,
  currentBalance: number,
  thresholdAmount = 1000,
  keepAmount = 100,
  provider: OffRampProvider = "coinbase",
): Promise<OffRampTransaction | null> {
  if (currentBalance <= thresholdAmount) {
    return null
  }

  const amountToWithdraw = currentBalance - keepAmount

  return initiateOffRamp({
    walletAddress,
    amount: amountToWithdraw.toString(),
    token: "USDC",
    chainId: 8453,
    targetCurrency: "USD",
    provider,
  })
}

/**
 * Generate off-ramp widget URL
 * Opens provider's hosted UI for off-ramping
 */
export function getOffRampWidgetUrl(
  provider: OffRampProvider,
  options: {
    walletAddress: string
    amount?: string
    token?: string
    targetCurrency?: string
  },
): string {
  const { walletAddress, amount = "100", token = "USDC", targetCurrency = "USD" } = options

  switch (provider) {
    case "coinbase":
      return `https://pay.coinbase.com/sell?addresses={"${walletAddress}":["base"]}&assets=["${token}"]&defaultAsset=${token}&presetFiatAmount=${amount}&fiatCurrency=${targetCurrency}`

    case "transak":
      return `https://global.transak.com/?walletAddress=${walletAddress}&cryptoCurrencyCode=${token}&fiatCurrency=${targetCurrency}&defaultCryptoAmount=${amount}&productsAvailed=SELL`

    case "moonpay":
      return `https://sell.moonpay.com/?walletAddress=${walletAddress}&baseCurrencyCode=${token}&quoteCurrencyCode=${targetCurrency.toLowerCase()}&baseCurrencyAmount=${amount}`

    case "bridge":
      return `https://app.bridge.xyz/offramp?address=${walletAddress}&amount=${amount}&asset=${token}`

    default:
      return ""
  }
}

/**
 * Check which off-ramp providers are currently configured
 */
export function getAvailableProviders(): { provider: OffRampProvider; enabled: boolean }[] {
  return [
    { provider: "coinbase", enabled: PROVIDER_CONFIG.coinbase.enabled },
    { provider: "bridge", enabled: PROVIDER_CONFIG.bridge.enabled },
    { provider: "transak", enabled: PROVIDER_CONFIG.transak.enabled },
    { provider: "moonpay", enabled: true }, // Widget-only, always available
  ]
}
