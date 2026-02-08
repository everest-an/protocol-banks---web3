/**
 * Protocol Banks Fee System
 * Handles fee calculation, collection, and management
 */

import { prisma } from "@/lib/prisma"

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
  try {
    const data = await prisma.feeConfig.findUnique({
      where: { config_key: "base_fee_rate" },
    })

    if (!data) {
      return {
        baseRate: 0.001, // 0.1%
        minFeeUsd: 0.5,
        maxFeeUsd: 500,
      }
    }

    const config = data.value as Record<string, number>
    return {
      baseRate: config.rate || 0.001,
      minFeeUsd: config.min_fee_usd || 0.5,
      maxFeeUsd: config.max_fee_usd || 500,
    }
  } catch {
    return {
      baseRate: 0.001,
      minFeeUsd: 0.5,
      maxFeeUsd: 500,
    }
  }
}

/**
 * Get tier discounts from database
 */
export async function getTierDiscounts(): Promise<TierDiscounts> {
  try {
    const data = await prisma.feeConfig.findUnique({
      where: { config_key: "tier_discounts" },
    })

    if (!data) {
      return { standard: 0, business: 0.15, enterprise: 0.3 }
    }

    const discounts = data.value as Record<string, number>
    return {
      standard: discounts.standard || 0,
      business: discounts.business || 0.15,
      enterprise: discounts.enterprise || 0.3,
    }
  } catch {
    return { standard: 0, business: 0.15, enterprise: 0.3 }
  }
}

/**
 * Get volume discounts from database
 */
export async function getVolumeDiscounts(): Promise<VolumeDiscount[]> {
  try {
    const data = await prisma.feeConfig.findUnique({
      where: { config_key: "volume_discounts" },
    })

    if (!data) {
      return [
        { minVolume: 100000, discount: 0.1 },
        { minVolume: 500000, discount: 0.2 },
        { minVolume: 1000000, discount: 0.3 },
      ]
    }

    return (data.value as unknown as VolumeDiscount[]) || []
  } catch {
    return [
      { minVolume: 100000, discount: 0.1 },
      { minVolume: 500000, discount: 0.2 },
      { minVolume: 1000000, discount: 0.3 },
    ]
  }
}

/**
 * Get treasury address for a specific chain
 */
export async function getTreasuryAddress(chainType: "evm" | "solana" | "bitcoin" = "evm"): Promise<string> {
  try {
    const data = await prisma.feeConfig.findUnique({
      where: { config_key: "treasury_address" },
    })

    if (!data) {
      return DEFAULT_TREASURY_ADDRESS
    }

    const addresses = data.value as Record<string, string>
    return addresses[chainType] || DEFAULT_TREASURY_ADDRESS
  } catch {
    return DEFAULT_TREASURY_ADDRESS
  }
}

/**
 * Get monthly transaction volume for a wallet
 */
export async function getMonthlyVolume(walletAddress: string): Promise<number> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return 0
  }

  try {
    const monthYear = new Date().toISOString().slice(0, 7) // YYYY-MM

    const data = await prisma.monthlyFeeSummary.findUnique({
      where: {
        from_address_month: {
          from_address: walletAddress.toLowerCase(),
          month: monthYear,
        },
      },
      select: { total_volume: true },
    })

    return data?.total_volume || 0
  } catch {
    return 0
  }
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
  try {
    const treasuryAddress = await getTreasuryAddress("evm")
    const tier = params.tier || "standard"

    // Calculate fee
    const feeCalc = await calculateFee(params.amount, params.fromAddress, tier)

    // Record the protocol fee
    const fee = await prisma.protocolFee.create({
      data: {
        payment_id: params.paymentId || null,
        batch_id: params.batchId || null,
        amount: params.amount,
        fee_rate: feeCalc.feeRate,
        base_fee: feeCalc.baseFee,
        discount: feeCalc.discountAmount,
        net_fee: feeCalc.finalFee,
        from_address: params.fromAddress.toLowerCase(),
        treasury_address: treasuryAddress,
        token: params.tokenSymbol,
        chain_id: params.chainId,
        status: "pending",
        tier,
      },
    })

    // Update monthly summary
    const monthYear = new Date().toISOString().slice(0, 7)
    await prisma.monthlyFeeSummary.upsert({
      where: {
        from_address_month: {
          from_address: params.fromAddress.toLowerCase(),
          month: monthYear,
        },
      },
      update: {
        total_volume: { increment: params.amount },
        transaction_count: { increment: 1 },
        total_fees: { increment: feeCalc.baseFee },
        total_discounts: { increment: feeCalc.discountAmount },
        net_fees: { increment: feeCalc.finalFee },
        tier,
      },
      create: {
        from_address: params.fromAddress.toLowerCase(),
        month: monthYear,
        total_volume: params.amount,
        transaction_count: 1,
        total_fees: feeCalc.baseFee,
        total_discounts: feeCalc.discountAmount,
        net_fees: feeCalc.finalFee,
        tier,
      },
    })

    return fee.id
  } catch (error) {
    console.error("Error recording fee:", error)
    return null
  }
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
  try {
    const safeWalletAddress = walletAddress && typeof walletAddress === "string" ? walletAddress.toLowerCase() : undefined
    const effectiveStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const effectiveEndDate = endDate || new Date()

    const where = {
      ...(safeWalletAddress && { from_address: safeWalletAddress }),
      created_at: {
        gte: effectiveStartDate,
        lte: effectiveEndDate,
      },
    }

    const [totals, pendingAgg, collectedAgg] = await Promise.all([
      prisma.protocolFee.aggregate({
        where,
        _sum: {
          net_fee: true,
          amount: true,
        },
        _avg: {
          fee_rate: true,
        },
        _count: true,
      }),
      prisma.protocolFee.aggregate({
        where: { ...where, status: "pending" },
        _sum: { net_fee: true },
      }),
      prisma.protocolFee.aggregate({
        where: { ...where, status: "collected" },
        _sum: { net_fee: true },
      }),
    ])

    if (totals._count === 0) {
      return null
    }

    return {
      totalFeesCollected: totals._sum.net_fee || 0,
      totalTransactionVolume: totals._sum.amount || 0,
      transactionCount: totals._count,
      averageFeeRate: totals._avg.fee_rate || 0,
      pendingFees: pendingAgg._sum.net_fee || 0,
      collectedFees: collectedAgg._sum.net_fee || 0,
    }
  } catch (error) {
    console.error("Error getting fee stats:", error)
    return null
  }
}

/**
 * Get monthly fee summary for a wallet
 */
export async function getMonthlyFeeSummary(walletAddress: string): Promise<MonthlyFeeSummary | null> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return null
  }

  try {
    const monthYear = new Date().toISOString().slice(0, 7)

    const data = await prisma.monthlyFeeSummary.findUnique({
      where: {
        from_address_month: {
          from_address: walletAddress.toLowerCase(),
          month: monthYear,
        },
      },
    })

    if (!data) {
      return null
    }

    return {
      walletAddress: data.from_address,
      monthYear: data.month,
      totalTransactionVolume: Number(data.total_volume),
      transactionCount: data.transaction_count,
      totalFeesCharged: Number(data.total_fees),
      totalDiscountsGiven: Number(data.total_discounts),
      netFeesCollected: Number(data.net_fees),
      currentTier: data.tier || "standard",
    }
  } catch {
    return null
  }
}

/**
 * Get recent protocol fees for a wallet
 */
export async function getRecentFees(walletAddress: string, limit = 10): Promise<ProtocolFee[]> {
  if (!walletAddress || typeof walletAddress !== "string") {
    return []
  }

  try {
    const data = await prisma.protocolFee.findMany({
      where: { from_address: walletAddress.toLowerCase() },
      orderBy: { created_at: "desc" },
      take: limit,
    })

    return data.map((fee) => ({
      id: fee.id,
      paymentId: fee.payment_id ?? undefined,
      batchId: fee.batch_id ?? undefined,
      transactionAmount: Number(fee.amount),
      feeRate: Number(fee.fee_rate),
      baseFee: Number(fee.base_fee),
      discountAmount: Number(fee.discount),
      finalFee: Number(fee.net_fee),
      fromAddress: fee.from_address,
      treasuryAddress: fee.treasury_address,
      tokenSymbol: fee.token,
      chainId: fee.chain_id,
      status: fee.status as ProtocolFee["status"],
      collectionTxHash: fee.tx_hash ?? undefined,
      tier: fee.tier,
      createdAt: fee.created_at.toISOString(),
    }))
  } catch {
    return []
  }
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
