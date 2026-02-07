import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedAddress } from "@/lib/api-auth"

interface OfframpQuoteRequest {
  amount: string
  sourceToken: string
  sourceChain: number
  targetCurrency: string // USD, EUR, etc.
  paymentMethod: "bank_transfer" | "card" | "paypal"
}

interface OfframpQuote {
  id: string
  sourceAmount: string
  sourceToken: string
  targetAmount: string
  targetCurrency: string
  exchangeRate: number
  fees: {
    networkFee: string
    serviceFee: string
    totalFee: string
  }
  expiresAt: string
  provider: string
}

// Provider configurations
const PROVIDERS = {
  coinbase: {
    name: "Coinbase",
    apiUrl: process.env.COINBASE_ONRAMP_API_URL,
    apiKey: process.env.COINBASE_ONRAMP_API_KEY,
    enabled: !!process.env.COINBASE_ONRAMP_API_KEY,
  },
  bridge: {
    name: "Bridge.xyz",
    apiUrl: process.env.BRIDGE_API_URL || "https://api.bridge.xyz",
    apiKey: process.env.BRIDGE_API_KEY,
    enabled: !!process.env.BRIDGE_API_KEY,
  },
  transak: {
    name: "Transak",
    apiUrl: process.env.TRANSAK_API_URL || "https://api.transak.com",
    apiKey: process.env.TRANSAK_API_KEY,
    enabled: !!process.env.TRANSAK_API_KEY,
  },
}

/**
 * Get off-ramp quote from providers
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request - prevent unauthenticated API quota abuse
    const callerAddress = await getAuthenticatedAddress(request)
    if (!callerAddress) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      )
    }

    const body: OfframpQuoteRequest = await request.json()
    const { amount, sourceToken, sourceChain, targetCurrency, paymentMethod } = body

    if (!amount || !sourceToken || !targetCurrency) {
      return NextResponse.json(
        { error: "Missing required fields: amount, sourceToken, targetCurrency" },
        { status: 400 }
      )
    }

    // Try to get real quote from providers
    let quote: OfframpQuote | null = null

    // Try Bridge.xyz first
    if (PROVIDERS.bridge.enabled) {
      quote = await getBridgeQuote(body)
    }

    // Fallback to Coinbase
    if (!quote && PROVIDERS.coinbase.enabled) {
      quote = await getCoinbaseQuote(body)
    }

    // Fallback to Transak
    if (!quote && PROVIDERS.transak.enabled) {
      quote = await getTransakQuote(body)
    }

    // If no provider available, return mock quote with warning
    if (!quote) {
      console.warn("[OfframpAPI] No provider configured, returning mock quote")
      quote = getMockQuote(body)
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error("[OfframpAPI] Error:", error)
    return NextResponse.json(
      { error: "Failed to get quote" },
      { status: 500 }
    )
  }
}

/**
 * Get quote from Bridge.xyz
 */
async function getBridgeQuote(request: OfframpQuoteRequest): Promise<OfframpQuote | null> {
  try {
    const response = await fetch(`${PROVIDERS.bridge.apiUrl}/v0/quotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PROVIDERS.bridge.apiKey!,
      },
      body: JSON.stringify({
        source_currency: request.sourceToken,
        destination_currency: request.targetCurrency,
        amount: request.amount,
        on_ramp_or_off_ramp: "off_ramp",
      }),
    })

    if (!response.ok) {
      console.error("[Bridge] Quote failed:", await response.text())
      return null
    }

    const data = await response.json()
    return {
      id: data.id || crypto.randomUUID(),
      sourceAmount: request.amount,
      sourceToken: request.sourceToken,
      targetAmount: data.destination_amount || "0",
      targetCurrency: request.targetCurrency,
      exchangeRate: data.exchange_rate || 0,
      fees: {
        networkFee: data.network_fee || "0",
        serviceFee: data.service_fee || "0",
        totalFee: data.total_fee || "0",
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      provider: "bridge",
    }
  } catch (error) {
    console.error("[Bridge] Error:", error)
    return null
  }
}

/**
 * Get quote from Coinbase
 */
async function getCoinbaseQuote(request: OfframpQuoteRequest): Promise<OfframpQuote | null> {
  try {
    // Coinbase Onramp/Offramp API
    const response = await fetch(`${PROVIDERS.coinbase.apiUrl}/offramp/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PROVIDERS.coinbase.apiKey}`,
      },
      body: JSON.stringify({
        purchase_currency: request.targetCurrency,
        payment_currency: request.sourceToken,
        payment_amount: request.amount,
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      id: data.quote_id || crypto.randomUUID(),
      sourceAmount: request.amount,
      sourceToken: request.sourceToken,
      targetAmount: data.purchase_amount || "0",
      targetCurrency: request.targetCurrency,
      exchangeRate: data.exchange_rate || 0,
      fees: {
        networkFee: data.network_fee || "0",
        serviceFee: data.coinbase_fee || "0",
        totalFee: data.total_fee || "0",
      },
      expiresAt: data.expires_at || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      provider: "coinbase",
    }
  } catch (error) {
    console.error("[Coinbase] Error:", error)
    return null
  }
}

/**
 * Get quote from Transak
 */
async function getTransakQuote(request: OfframpQuoteRequest): Promise<OfframpQuote | null> {
  try {
    const response = await fetch(
      `${PROVIDERS.transak.apiUrl}/api/v2/currencies/price?` +
      new URLSearchParams({
        fiatCurrency: request.targetCurrency,
        cryptoCurrency: request.sourceToken,
        isBuyOrSell: "SELL",
        cryptoAmount: request.amount,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      id: crypto.randomUUID(),
      sourceAmount: request.amount,
      sourceToken: request.sourceToken,
      targetAmount: data.response?.fiatAmount?.toString() || "0",
      targetCurrency: request.targetCurrency,
      exchangeRate: data.response?.conversionPrice || 0,
      fees: {
        networkFee: data.response?.networkFee?.toString() || "0",
        serviceFee: data.response?.totalFee?.toString() || "0",
        totalFee: data.response?.totalFee?.toString() || "0",
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      provider: "transak",
    }
  } catch (error) {
    console.error("[Transak] Error:", error)
    return null
  }
}

/**
 * Mock quote for development when no provider is configured
 */
function getMockQuote(request: OfframpQuoteRequest): OfframpQuote {
  const amount = parseFloat(request.amount) || 0
  // Mock exchange rates
  const rates: Record<string, number> = {
    "USDC-USD": 0.998,
    "USDT-USD": 0.997,
    "ETH-USD": 3250,
    "MATIC-USD": 0.85,
  }

  const rateKey = `${request.sourceToken}-${request.targetCurrency}`
  const rate = rates[rateKey] || 1
  const targetAmount = amount * rate * 0.98 // 2% mock fee

  return {
    id: `mock_${crypto.randomUUID()}`,
    sourceAmount: request.amount,
    sourceToken: request.sourceToken,
    targetAmount: targetAmount.toFixed(2),
    targetCurrency: request.targetCurrency,
    exchangeRate: rate,
    fees: {
      networkFee: "0.50",
      serviceFee: (amount * 0.015).toFixed(2), // 1.5% service fee
      totalFee: (amount * 0.02).toFixed(2),
    },
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    provider: "mock",
  }
}
