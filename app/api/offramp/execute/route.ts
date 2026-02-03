/**
 * Off-Ramp Execution API
 *
 * Execute an off-ramp transaction using a previously obtained quote.
 * Supports Bridge.xyz, Coinbase, and Transak providers.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import crypto from "crypto"

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

export async function POST(request: NextRequest) {
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

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )

    // Generate transaction ID
    const transactionId = `OFR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

    let providerResponse: any = null
    let providerOrderId: string | null = null
    let depositAddress: string | null = null

    // Execute based on provider
    if (provider === "bridge" && PROVIDERS.bridge.enabled) {
      providerResponse = await executeBridgeOfframp(body)
      providerOrderId = providerResponse?.id
      depositAddress = providerResponse?.source_deposit_instructions?.deposit_address
    } else if (provider === "coinbase" && PROVIDERS.coinbase.enabled) {
      providerResponse = await executeCoinbaseOfframp(body)
      providerOrderId = providerResponse?.order_id
      depositAddress = providerResponse?.deposit_address
    } else if (provider === "transak" && PROVIDERS.transak.enabled) {
      providerResponse = await executeTransakOfframp(body)
      providerOrderId = providerResponse?.order_id
    } else {
      // Mock execution for development
      providerResponse = {
        id: `mock_${crypto.randomUUID().slice(0, 8)}`,
        status: "pending",
        deposit_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD75",
      }
      providerOrderId = providerResponse.id
      depositAddress = providerResponse.deposit_address
    }

    // Record transaction in database
    try {
      await supabase.from("offramp_transactions").insert({
        transaction_id: transactionId,
        wallet_address: walletAddress.toLowerCase(),
        provider: provider,
        provider_order_id: providerOrderId,
        source_amount: parseFloat(sourceAmount),
        source_token: sourceToken,
        source_chain: sourceChain,
        target_amount: parseFloat(targetAmount),
        target_currency: targetCurrency,
        payment_method: paymentMethod,
        status: "pending",
        deposit_address: depositAddress,
        tx_hash: txHash,
        quote_id: quoteId,
        bank_reference: bankDetails ? JSON.stringify(bankDetails) : null,
      })
    } catch (dbError) {
      console.warn("[Offramp] DB recording failed:", dbError)
    }

    return NextResponse.json({
      success: true,
      transactionId,
      providerOrderId,
      depositAddress,
      status: "pending",
      provider,
      sourceAmount,
      sourceToken,
      targetAmount,
      targetCurrency,
      message: depositAddress
        ? `Please send ${sourceAmount} ${sourceToken} to ${depositAddress}`
        : "Transaction initiated. Check status for updates.",
    })
  } catch (error: any) {
    console.error("[Offramp] Execution error:", error)
    return NextResponse.json(
      { error: error.message || "Off-ramp execution failed" },
      { status: 500 },
    )
  }
}

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

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )

    const { data, error } = await supabase
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json({
      transactionId: data.transaction_id,
      status: data.status,
      provider: data.provider,
      sourceAmount: data.source_amount,
      sourceToken: data.source_token,
      targetAmount: data.target_amount,
      targetCurrency: data.target_currency,
      depositAddress: data.deposit_address,
      txHash: data.tx_hash,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
