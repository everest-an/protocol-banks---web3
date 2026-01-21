/**
 * Off-Ramp Service Integration
 * Converts crypto (USDC) back to fiat currency
 */

import { createClient } from "./supabase"

// Off-ramp provider types
export type OffRampProvider = "coinbase" | "bridge" | "transak" | "moonpay"

// Off-ramp request
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

// Off-ramp quote
export interface OffRampQuote {
  provider: OffRampProvider
  inputAmount: string
  inputToken: string
  outputAmount: string
  outputCurrency: string
  fee: string
  exchangeRate: string
  expiresAt: number
  quoteId: string
}

// Off-ramp transaction
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

/**
 * Get off-ramp quote from provider
 * Note: In production, this would call the actual provider APIs
 */
export async function getOffRampQuote(
  amount: string,
  token: "USDC" | "USDT",
  targetCurrency = "USD",
  provider: OffRampProvider = "coinbase",
): Promise<OffRampQuote> {
  // Mock quote for development
  // In production, integrate with actual provider APIs:
  // - Coinbase: https://docs.cdp.coinbase.com/onramp/docs/api-offramp
  // - Bridge.xyz: https://docs.bridge.xyz/api/offramp
  // - Transak: https://docs.transak.com/docs/off-ramp

  const fee = Number.parseFloat(amount) * 0.015 // 1.5% fee estimate
  const outputAmount = (Number.parseFloat(amount) - fee).toFixed(2)

  return {
    provider,
    inputAmount: amount,
    inputToken: token,
    outputAmount,
    outputCurrency: targetCurrency,
    fee: fee.toFixed(2),
    exchangeRate: "1.00", // 1:1 for stablecoins
    expiresAt: Date.now() + 300000, // 5 minutes
    quoteId: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
}

/**
 * Initiate off-ramp transaction
 */
export async function initiateOffRamp(request: OffRampRequest): Promise<OffRampTransaction> {
  const supabase = createClient()

  // Create transaction record
  const transaction: OffRampTransaction = {
    id: `offramp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: "pending",
    provider: request.provider,
    inputAmount: request.amount,
    inputToken: request.token,
    outputAmount: (Number.parseFloat(request.amount) * 0.985).toFixed(2), // Minus fees
    outputCurrency: request.targetCurrency,
    createdAt: new Date().toISOString(),
  }

  // Record in database
  if (supabase) {
    await supabase.from("offramp_transactions").insert({
      id: transaction.id,
      wallet_address: request.walletAddress,
      provider: request.provider,
      input_amount: request.amount,
      input_token: request.token,
      output_amount: transaction.outputAmount,
      output_currency: request.targetCurrency,
      chain_id: request.chainId,
      status: "pending",
    })
  }

  // In production, call the provider API here
  // Example for Coinbase:
  // const response = await coinbaseApi.createWithdrawal({...})

  return transaction
}

/**
 * Get off-ramp transaction status
 */
export async function getOffRampStatus(transactionId: string): Promise<OffRampTransaction | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase.from("offramp_transactions").select("*").eq("id", transactionId).single()

  if (error || !data) return null

  return {
    id: data.id,
    status: data.status,
    provider: data.provider,
    inputAmount: data.input_amount,
    inputToken: data.input_token,
    outputAmount: data.output_amount,
    outputCurrency: data.output_currency,
    txHash: data.tx_hash,
    createdAt: data.created_at,
    completedAt: data.completed_at,
    bankReference: data.bank_reference,
  }
}

/**
 * Get user's off-ramp history
 */
export async function getOffRampHistory(walletAddress: string): Promise<OffRampTransaction[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    status: row.status,
    provider: row.provider,
    inputAmount: row.input_amount,
    inputToken: row.input_token,
    outputAmount: row.output_amount,
    outputCurrency: row.output_currency,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    bankReference: row.bank_reference,
  }))
}

/**
 * Auto off-ramp trigger
 * Automatically initiates off-ramp when balance exceeds threshold
 */
export async function checkAutoOffRamp(
  walletAddress: string,
  currentBalance: number,
  thresholdAmount = 1000,
  keepAmount = 100, // Amount to keep in wallet
  provider: OffRampProvider = "coinbase",
): Promise<OffRampTransaction | null> {
  if (currentBalance <= thresholdAmount) {
    return null
  }

  const amountToWithdraw = currentBalance - keepAmount

  // Initiate off-ramp
  return initiateOffRamp({
    walletAddress,
    amount: amountToWithdraw.toString(),
    token: "USDC",
    chainId: 8453, // Base
    targetCurrency: "USD",
    provider,
  })
}

/**
 * Generate off-ramp widget URL
 * Opens provider's hosted UI for off-ramping
 * Note: API keys should be configured on the server side or in provider dashboard
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
      // Coinbase Onramp/Offramp widget - no API key needed for basic usage
      return `https://pay.coinbase.com/sell?addresses={"${walletAddress}":["base"]}&assets=["${token}"]&defaultAsset=${token}&presetFiatAmount=${amount}&fiatCurrency=${targetCurrency}`

    case "transak":
      // Users should set up their Transak integration via the dashboard
      return `https://global.transak.com/?walletAddress=${walletAddress}&cryptoCurrencyCode=${token}&fiatCurrency=${targetCurrency}&defaultCryptoAmount=${amount}&productsAvailed=SELL`

    case "moonpay":
      // Users should set up their MoonPay integration via the dashboard
      return `https://sell.moonpay.com/?walletAddress=${walletAddress}&baseCurrencyCode=${token}&quoteCurrencyCode=${targetCurrency.toLowerCase()}&baseCurrencyAmount=${amount}`

    case "bridge":
      // Bridge.xyz (requires API integration)
      return `https://app.bridge.xyz/offramp?address=${walletAddress}&amount=${amount}&asset=${token}`

    default:
      return ""
  }
}
