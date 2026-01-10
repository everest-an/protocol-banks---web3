/**
 * Protocol Banks Fee System
 * Handles fee calculation, collection, and management
 */

import { createClient } from "@/lib/supabase"

// Fee configuration types
export interface FeeConfig {
  baseRate: number
  minFeeUsd: number
  maxFeeUsd: number
}

export interface TierDiscounts {
  standard: number
  business: number
  enterprise: number
}

export interface VolumeDiscount {
  minVolume: number
  discount: number
}

export interface FeeCalculation {
  baseFee: number
  discountAmount: number
  finalFee: number
  feeRate: number
  volumeDiscount: number
  tierDiscount: number
}

export interface ProtocolFee {
  id: string
  paymentId?: string
  batchId?: string
  transactionAmount: number
  feeRate: number
  baseFee: number
  discountAmount: number
  finalFee: number
  fromAddress: string
  treasuryAddress: string
  tokenSymbol: string
  chainId: number
  status: "pending" | "collected" | "failed" | "waived"
  collectionTxHash?: string
  tier: string
  createdAt: string
}

export interface MonthlyFeeSummary {
  walletAddress: string
  monthYear: string
  totalTransactionVolume: number
  transactionCount: number
  totalFeesCharged: number
  totalDiscountsGiven: number
  netFeesCollected: number
  currentTier: string
}

export type UserTier = "standard" | "business" | "enterprise"

// Default treasury address (should be configured in database)
const DEFAULT_TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000"

/**
 * Get fee configuration from database
 */
export async function getFeeConfig(): Promise<FeeConfig> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("fee_config")
    .select("config_value")
    .eq("config_key", "base_fee_rate")
    .single()

  if (error || !data) {
    // Return defaults if not configured
    return {
      baseRate: 0.001, // 0.1%
      minFeeUsd: 0.5,
      maxFeeUsd: 500,
    }
  }

  const config = data.config_value as Record<string, number>
  return {
    baseRate: config.rate || 0.001,
    minFeeUsd: config.min_fee_usd || 0.5,
    maxFeeUsd: config.max_fee_usd || 500,
  }
}

/**
 * Get tier discounts from database
 */
export async function getTierDiscounts(): Promise<TierDiscounts> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("fee_config")
    .select("config_value")
    .eq("config_key", "tier_discounts")
    .single()

  if (error || !data) {
    return { standard: 0, business: 0.15, enterprise: 0.3 }
  }

  const discounts = data.config_value as Record<string, number>
  return {
    standard: discounts.standard || 0,
    business: discounts.business || 0.15,
    enterprise: discounts.enterprise || 0.3,
  }
}

/**
 * Get volume discounts from database
 */
export async function getVolumeDiscounts(): Promise<VolumeDiscount[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("fee_config")
    .select("config_value")
    .eq("config_key", "volume_discounts")
    .single()

  if (error || !data) {
    return [
      { minVolume: 100000, discount: 0.1 },
      { minVolume: 500000, discount: 0.2 },
      { minVolume: 1000000, discount: 0.3 },
    ]
  }

  return (data.config_value as VolumeDiscount[]) || []
}

/**
 * Get treasury address for a specific chain
 */
export async function getTreasuryAddress(chainType: "evm" | "solana" | "bitcoin" = "evm"): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("fee_config")
    .select("config_value")
    .eq("config_key", "treasury_address")
    .single()

  if (error || !data) {
    return DEFAULT_TREASURY_ADDRESS
  }

  const addresses = data.config_value as Record<string, string>
  return addresses[chainType] || DEFAULT_TREASURY_ADDRESS
}

/**
 * Get monthly transaction volume for a wallet
 */
export async function getMonthlyVolume(walletAddress: string): Promise<number> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return 0
  }

  const supabase = createClient()
  const monthYear = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data, error } = await supabase
    .from("monthly_fee_summary")
    .select("total_transaction_volume")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("month_year", monthYear)
    .single()

  if (error || !data) {
    return 0
  }

  return data.total_transaction_volume || 0
}

/**
 * Calculate protocol fee for a transaction (client-side estimation)
 */
export async function calculateFee(
  amount: number,
  walletAddress: string,
  tier: UserTier = "standard",
): Promise<FeeCalculation> {
  if (!walletAddress || typeof walletAddress !== "string") {
    const config = await getFeeConfig()
    let baseFee = amount * config.baseRate
    baseFee = Math.max(baseFee, config.minFeeUsd)
    baseFee = Math.min(baseFee, config.maxFeeUsd)
    return {
      baseFee: Math.round(baseFee * 1000000) / 1000000,
      discountAmount: 0,
      finalFee: Math.round(baseFee * 1000000) / 1000000,
      feeRate: config.baseRate,
      volumeDiscount: 0,
      tierDiscount: 0,
    }
  }

  const [config, tierDiscounts, volumeDiscounts, monthlyVolume] = await Promise.all([
    getFeeConfig(),
    getTierDiscounts(),
    getVolumeDiscounts(),
    getMonthlyVolume(walletAddress),
  ])

  // Calculate base fee
  let baseFee = amount * config.baseRate
  baseFee = Math.max(baseFee, config.minFeeUsd)
  baseFee = Math.min(baseFee, config.maxFeeUsd)

  // Get tier discount
  const tierDiscount = tierDiscounts[tier] || 0

  // Get volume discount based on monthly volume
  let volumeDiscount = 0
  for (const vd of volumeDiscounts.sort((a, b) => b.minVolume - a.minVolume)) {
    if (monthlyVolume >= vd.minVolume) {
      volumeDiscount = vd.discount
      break
    }
  }

  // Calculate total discount
  const totalDiscountRate = tierDiscount + volumeDiscount
  const discountAmount = baseFee * totalDiscountRate

  // Calculate final fee (minimum 50% of min fee)
  let finalFee = baseFee - discountAmount
  finalFee = Math.max(finalFee, config.minFeeUsd * 0.5)

  return {
    baseFee: Math.round(baseFee * 1000000) / 1000000,
    discountAmount: Math.round(discountAmount * 1000000) / 1000000,
    finalFee: Math.round(finalFee * 1000000) / 1000000,
    feeRate: config.baseRate,
    volumeDiscount,
    tierDiscount,
  }
}

/**
 * Record a protocol fee in the database
 */
export async function recordFee(params: {
  paymentId?: string
  batchId?: string
  amount: number
  fromAddress: string
  tokenSymbol: string
  chainId: number
  tier?: UserTier
  collectionMethod?: "immediate" | "deferred" | "batch"
}): Promise<string | null> {
  const supabase = createClient()
  const treasuryAddress = await getTreasuryAddress("evm")

  const { data, error } = await supabase.rpc("record_protocol_fee", {
    p_payment_id: params.paymentId || null,
    p_batch_id: params.batchId || null,
    p_amount: params.amount,
    p_from_address: params.fromAddress,
    p_treasury_address: treasuryAddress,
    p_token_symbol: params.tokenSymbol,
    p_chain_id: params.chainId,
    p_tier: params.tier || "standard",
    p_collection_method: params.collectionMethod || "deferred",
  })

  if (error) {
    console.error("Error recording fee:", error)
    return null
  }

  return data
}

/**
 * Get fee statistics for a wallet or globally
 */
export async function getFeeStats(
  walletAddress?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{
  totalFeesCollected: number
  totalTransactionVolume: number
  transactionCount: number
  averageFeeRate: number
  pendingFees: number
  collectedFees: number
} | null> {
  const supabase = createClient()

  const safeWalletAddress = walletAddress && typeof walletAddress === "string" ? walletAddress.toLowerCase() : null

  const { data, error } = await supabase.rpc("get_protocol_fee_stats", {
    p_wallet: safeWalletAddress,
    p_start_date: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    p_end_date: endDate?.toISOString() || new Date().toISOString(),
  })

  if (error || !data || data.length === 0) {
    return null
  }

  const stats = data[0]
  return {
    totalFeesCollected: Number(stats.total_fees_collected) || 0,
    totalTransactionVolume: Number(stats.total_transaction_volume) || 0,
    transactionCount: Number(stats.transaction_count) || 0,
    averageFeeRate: Number(stats.average_fee_rate) || 0,
    pendingFees: Number(stats.pending_fees) || 0,
    collectedFees: Number(stats.collected_fees) || 0,
  }
}

/**
 * Get monthly fee summary for a wallet
 */
export async function getMonthlyFeeSummary(walletAddress: string): Promise<MonthlyFeeSummary | null> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return null
  }

  const supabase = createClient()
  const monthYear = new Date().toISOString().slice(0, 7)

  const { data, error } = await supabase
    .from("monthly_fee_summary")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("month_year", monthYear)
    .single()

  if (error || !data) {
    return null
  }

  return {
    walletAddress: data.wallet_address,
    monthYear: data.month_year,
    totalTransactionVolume: Number(data.total_transaction_volume),
    transactionCount: data.transaction_count,
    totalFeesCharged: Number(data.total_fees_charged),
    totalDiscountsGiven: Number(data.total_discounts_given),
    netFeesCollected: Number(data.net_fees_collected),
    currentTier: data.current_tier,
  }
}

/**
 * Get recent protocol fees for a wallet
 */
export async function getRecentFees(walletAddress: string, limit = 10): Promise<ProtocolFee[]> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return []
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("protocol_fees")
    .select("*")
    .eq("from_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data.map((fee) => ({
    id: fee.id,
    paymentId: fee.payment_id,
    batchId: fee.batch_id,
    transactionAmount: Number(fee.transaction_amount),
    feeRate: Number(fee.fee_rate),
    baseFee: Number(fee.base_fee),
    discountAmount: Number(fee.discount_amount),
    finalFee: Number(fee.final_fee),
    fromAddress: fee.from_address,
    treasuryAddress: fee.treasury_address,
    tokenSymbol: fee.token_symbol,
    chainId: fee.chain_id,
    status: fee.status,
    collectionTxHash: fee.collection_tx_hash,
    tier: fee.tier,
    createdAt: fee.created_at,
  }))
}

/**
 * Format fee for display
 */
export function formatFee(amount: number, decimals = 2): string {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`
  }
  return `$${amount.toFixed(decimals)}`
}

/**
 * Get user tier based on monthly volume
 */
export function getTierFromVolume(monthlyVolume: number): UserTier {
  if (monthlyVolume >= 1000000) {
    return "enterprise"
  } else if (monthlyVolume >= 100000) {
    return "business"
  }
  return "standard"
}

/**
 * Calculate fee preview for UI display
 */
export function calculateFeePreview(
  amount: number,
  feeRate = 0.001,
  minFee = 0.5,
  maxFee = 500,
  discountRate = 0,
): { baseFee: number; finalFee: number; discountAmount: number } {
  let baseFee = amount * feeRate
  baseFee = Math.max(baseFee, minFee)
  baseFee = Math.min(baseFee, maxFee)

  const discountAmount = baseFee * discountRate
  const finalFee = Math.max(baseFee - discountAmount, minFee * 0.5)

  return {
    baseFee: Math.round(baseFee * 100) / 100,
    finalFee: Math.round(finalFee * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
  }
}
