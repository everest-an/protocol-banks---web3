import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PROVIDERS = ["coinbase", "bridge", "transak", "moonpay"] as const

type OffRampProvider = (typeof PROVIDERS)[number]

type InitiateRequest = {
  walletAddress: string
  amount: string
  token: "USDC" | "USDT"
  chainId: number
  targetCurrency: string
  provider: OffRampProvider
  bankAccount?: {
    type: "ach" | "sepa" | "wire"
    accountNumber?: string
    routingNumber?: string
    iban?: string
    swift?: string
  }
}

function getProviderEnv(provider: OffRampProvider, suffix: string) {
  return process.env[`OFFRAMP_${provider.toUpperCase()}_${suffix}`]
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as InitiateRequest

  if (!body?.provider || !PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  if (!body.walletAddress || !body.amount || !body.token || !body.chainId || !body.targetCurrency) {
    return NextResponse.json(
      { error: "walletAddress, amount, token, chainId, targetCurrency are required" },
      { status: 400 },
    )
  }

  const initiateUrl = getProviderEnv(body.provider, "INITIATE_URL")
  if (!initiateUrl) {
    return NextResponse.json({ error: "Provider initiate URL not configured" }, { status: 501 })
  }

  const apiKey = getProviderEnv(body.provider, "API_KEY")
  const apiHeader = getProviderEnv(body.provider, "API_HEADER") || "Authorization"

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) {
    headers[apiHeader] = apiHeader.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey
  }

  const providerResponse = await fetch(initiateUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      walletAddress: body.walletAddress,
      amount: body.amount,
      token: body.token,
      chainId: body.chainId,
      targetCurrency: body.targetCurrency,
      bankAccount: body.bankAccount,
    }),
  })

  const data = await providerResponse.json()

  if (!providerResponse.ok) {
    return NextResponse.json({ error: data?.error || "Provider initiate failed" }, { status: 502 })
  }

  const transactionId = data.id || data.transactionId || `offramp_${Date.now()}`
  const status = data.status || "pending"
  const outputAmount = data.outputAmount || data.fiatAmount || body.amount
  const redirectUrl = data.redirectUrl || data.url || null

  const supabase = await createClient()
  await supabase.from("offramp_transactions").insert({
    id: transactionId,
    wallet_address: body.walletAddress,
    provider: body.provider,
    input_amount: body.amount,
    input_token: body.token,
    output_amount: outputAmount,
    output_currency: body.targetCurrency,
    chain_id: body.chainId,
    status,
    tx_hash: data.txHash || null,
  })

  return NextResponse.json({
    success: true,
    transaction: {
      id: transactionId,
      status,
      provider: body.provider,
      inputAmount: body.amount,
      inputToken: body.token,
      outputAmount: outputAmount.toString(),
      outputCurrency: body.targetCurrency,
      txHash: data.txHash || null,
      createdAt: new Date().toISOString(),
    },
    redirectUrl,
    providerResponse: data,
  })
}
