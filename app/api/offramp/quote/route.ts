import { type NextRequest, NextResponse } from "next/server"

const PROVIDERS = ["coinbase", "bridge", "transak", "moonpay"] as const

type OffRampProvider = (typeof PROVIDERS)[number]

type QuoteRequest = {
  provider: OffRampProvider
  amount: string
  token: string
  targetCurrency: string
}

function getProviderEnv(provider: OffRampProvider, suffix: string) {
  return process.env[`OFFRAMP_${provider.toUpperCase()}_${suffix}`]
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as QuoteRequest

  if (!body?.provider || !PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  if (!body.amount || !body.token || !body.targetCurrency) {
    return NextResponse.json({ error: "amount, token, targetCurrency are required" }, { status: 400 })
  }

  const quoteUrl = getProviderEnv(body.provider, "QUOTE_URL")
  if (!quoteUrl) {
    return NextResponse.json({ error: "Provider quote URL not configured" }, { status: 501 })
  }

  const apiKey = getProviderEnv(body.provider, "API_KEY")
  const apiHeader = getProviderEnv(body.provider, "API_HEADER") || "Authorization"

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) {
    headers[apiHeader] = apiHeader.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey
  }

  const providerResponse = await fetch(quoteUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: body.amount,
      token: body.token,
      targetCurrency: body.targetCurrency,
    }),
  })

  const data = await providerResponse.json()

  if (!providerResponse.ok) {
    return NextResponse.json({ error: data?.error || "Provider quote failed" }, { status: 502 })
  }

  const outputAmount =
    data.outputAmount ||
    data.fiatAmount ||
    data.quote?.outputAmount ||
    data.data?.outputAmount ||
    null

  const fee = data.fee || data.fees?.total || data.quote?.fee || "0"
  const exchangeRate = data.exchangeRate || data.rate || data.quote?.exchangeRate || "1"
  const quoteId = data.quoteId || data.id || data.quote?.id || `quote_${Date.now()}`
  const expiresAt = data.expiresAt || data.quote?.expiresAt || Date.now() + 300000

  if (!outputAmount) {
    return NextResponse.json({ error: "Provider quote missing output amount" }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    quote: {
      provider: body.provider,
      inputAmount: body.amount,
      inputToken: body.token,
      outputAmount: outputAmount.toString(),
      outputCurrency: body.targetCurrency,
      fee: fee.toString(),
      exchangeRate: exchangeRate.toString(),
      expiresAt,
      quoteId,
    },
  })
}
