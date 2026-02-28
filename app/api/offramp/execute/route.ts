/**
 * Off-Ramp Execution API
 *
 * Execute an off-ramp transaction using a previously obtained quote.
 * Supports Bridge.xyz, Coinbase, and Transak providers.
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { withAuth } from "@/lib/middleware/api-auth"

interface OfframpExecuteRequest {
  quoteId: string
  provider: "bridge" | "coinbase" | "transak" | "mock"
  walletAddress: string
  sourceAmount: string
  sourceToken: string
  sourceChain: number
  targetCurrency: string
  targetAmount: string
  paymentMethod: "bank_transfer" | "card" | "paypal"
  // Bank details (for bank_transfer)
  bankDetails?: {
    accountNumber?: string
    routingNumber?: string
    iban?: string
    swift?: string
    accountHolderName?: string
    bankName?: string
    country?: string
  }
  // Transaction hash (user transfers crypto to provider address)
  txHash?: string
}

// Provider configurations
const PROVIDERS = {
  coinbase: {
    apiUrl: process.env.COINBASE_ONRAMP_API_URL,
    apiKey: process.env.COINBASE_ONRAMP_API_KEY,
    enabled: !!process.env.COINBASE_ONRAMP_API_KEY,
  },
  bridge: {
    apiUrl: process.env.BRIDGE_API_URL || "https://api.bridge.xyz",
    apiKey: process.env.BRIDGE_API_KEY,
    enabled: !!process.env.BRIDGE_API_KEY,
  },
  transak: {
    apiUrl: process.env.TRANSAK_API_URL || "https://api.transak.com",
    apiKey: process.env.TRANSAK_API_KEY,
    enabled: !!process.env.TRANSAK_API_KEY,
  },
}

export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body: OfframpExecuteRequest = await request.json()
    const {
      quoteId,
      provider,
      walletAddress,
      sourceAmount,
      sourceToken,
      sourceChain,
      targetCurrency,
      targetAmount,
      paymentMethod,
      bankDetails,
      txHash,
    } = body

    // Validate required fields
    if (!quoteId || !walletAddress || !sourceAmount || !sourceToken || !targetCurrency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }

    // Generate transaction ID
    const transactionId = `OFR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

    let providerResponse: any = null
    let providerOrderId: string | null = null

    // Execute based on provider
    if (provider === "bridge" && PROVIDERS.bridge.enabled) {
      providerResponse = await executeBridgeOfframp(body)
      providerOrderId = providerResponse?.id
    } else if (provider === "coinbase" && PROVIDERS.coinbase.enabled) {
      providerResponse = await executeCoinbaseOfframp(body)
      providerOrderId = providerResponse?.order_id
    } else if (provider === "transak" && PROVIDERS.transak.enabled) {
      providerResponse = await executeTransakOfframp(body)
      providerOrderId = providerResponse?.order_id
    } else {
      // Mock execution for development
      providerResponse = {
        id: `mock_${crypto.randomUUID().slice(0, 8)}`,
        status: "pending",
      }
      providerOrderId = providerResponse.id
    }

    // Record transaction in database
    try {
      await prisma.offrampTransaction.create({
        data: {
          reference_id: transactionId,
          wallet_address: walletAddress.toLowerCase(),
          provider: provider,
          provider_tx_id: providerOrderId,
          crypto_amount: parseFloat(sourceAmount),
          token: sourceToken,
          chain_id: sourceChain,
          fiat_amount: parseFloat(targetAmount),
          fiat_currency: targetCurrency,
          payout_method: paymentMethod,
          status: "pending",
          tx_hash: txHash,
          quote_id: quoteId,
          bank_details: bankDetails ? JSON.stringify(bankDetails) : null,
        },
      })
    } catch (dbError) {
      console.warn("[Offramp] DB recording failed:", dbError)
    }

    return NextResponse.json({
      success: true,
      transactionId,
      providerOrderId,
      status: "pending",
      provider,
      sourceAmount,
      sourceToken,
      targetAmount,
      targetCurrency,
      message: "Transaction initiated. Check status for updates.",
    })
  } catch (error: any) {
    console.error("[Offramp] Execution error:", error)
    return NextResponse.json(
      { error: error.message || "Off-ramp execution failed" },
      { status: 500 },
    )
  }
}, { component: 'offramp-execute' })

async function executeBridgeOfframp(request: OfframpExecuteRequest) {
  const response = await fetch(`${PROVIDERS.bridge.apiUrl}/v0/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": PROVIDERS.bridge.apiKey!,
    },
    body: JSON.stringify({
      amount: request.sourceAmount,
      on_behalf_of: request.walletAddress,
      source: {
        payment_rail: "ethereum",
        currency: request.sourceToken,
        from_address: request.walletAddress,
      },
      destination: {
        payment_rail: request.paymentMethod === "bank_transfer" ? "ach" : "card",
        currency: request.targetCurrency,
        ...(request.bankDetails && {
          external_account_id: request.bankDetails.accountNumber,
        }),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Bridge execution failed: ${await response.text()}`)
  }

  return response.json()
}

async function executeCoinbaseOfframp(request: OfframpExecuteRequest) {
  const response = await fetch(`${PROVIDERS.coinbase.apiUrl}/offramp/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PROVIDERS.coinbase.apiKey}`,
    },
    body: JSON.stringify({
      quote_id: request.quoteId,
      wallet_address: request.walletAddress,
      payment_method: request.paymentMethod,
    }),
  })

  if (!response.ok) {
    throw new Error(`Coinbase execution failed: ${await response.text()}`)
  }

  return response.json()
}

async function executeTransakOfframp(request: OfframpExecuteRequest) {
  const response = await fetch(`${PROVIDERS.transak.apiUrl}/api/v2/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PROVIDERS.transak.apiKey}`,
    },
    body: JSON.stringify({
      fiatCurrency: request.targetCurrency,
      cryptoCurrency: request.sourceToken,
      cryptoAmount: request.sourceAmount,
      walletAddress: request.walletAddress,
      isBuyOrSell: "SELL",
      paymentMethod: request.paymentMethod,
    }),
  })

  if (!response.ok) {
    throw new Error(`Transak execution failed: ${await response.text()}`)
  }

  return response.json()
}

/**
 * GET /api/offramp/execute?transactionId=xxx
 * Check off-ramp transaction status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get("transactionId")

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 })
    }

    const data = await prisma.offrampTransaction.findUnique({
      where: { reference_id: transactionId },
    })

    if (!data) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json({
      transactionId: data.reference_id,
      status: data.status,
      provider: data.provider,
      sourceAmount: data.crypto_amount,
      sourceToken: data.token,
      targetAmount: data.fiat_amount,
      targetCurrency: data.fiat_currency,
      txHash: data.tx_hash,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
