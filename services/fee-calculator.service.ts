/**
 * Fee Calculator Service
 * Calculates fees for payments and batch operations
 */

export interface FeeBreakdown {
  baseFee: number
  percentageFee: number
  networkFee: number
  totalFee: number
  netAmount: number
}

export interface FeeConfig {
  baseFeeUsd: number
  percentageRate: number
  minFeeUsd: number
  maxFeeUsd: number
}

// Default fee configuration
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  baseFeeUsd: 0.00,
  percentageRate: 0.001, // 0.1%
  minFeeUsd: 0.01,
  maxFeeUsd: 100.00,
}

// Network gas estimates (in USD)
export const NETWORK_GAS_ESTIMATES: Record<string, number> = {
  ethereum: 5.00,
  polygon: 0.05,
  arbitrum: 0.15,
  optimism: 0.10,
  base: 0.05,
  avalanche: 0.50,
}

/**
 * Calculate fees for a single payment
 */
export function calculateFees(
  amountUsd: number,
  network: string = 'base',
  config: FeeConfig = DEFAULT_FEE_CONFIG
): FeeBreakdown {
  // Base fee
  const baseFee = config.baseFeeUsd
  
  // Percentage fee
  let percentageFee = amountUsd * config.percentageRate
  
  // Apply min/max bounds
  const totalProtocolFee = baseFee + percentageFee
  const boundedProtocolFee = Math.min(Math.max(totalProtocolFee, config.minFeeUsd), config.maxFeeUsd)
  
  // Recalculate percentage fee after bounding
  percentageFee = boundedProtocolFee - baseFee
  
  // Network fee
  const networkFee = NETWORK_GAS_ESTIMATES[network.toLowerCase()] || 0.10
  
  // Total
  const totalFee = boundedProtocolFee + networkFee
  const netAmount = amountUsd - totalFee
  
  return {
    baseFee,
    percentageFee,
    networkFee,
    totalFee,
    netAmount: Math.max(0, netAmount),
  }
}

/**
 * Calculate fees for batch payment
 */
export function calculateBatchFees(
  amounts: number[],
  network: string = 'base',
  config: FeeConfig = DEFAULT_FEE_CONFIG
): {
  itemFees: FeeBreakdown[]
  totalAmount: number
  totalFees: number
  totalNetAmount: number
  averageFeePerItem: number
} {
  const itemFees = amounts.map(amount => calculateFees(amount, network, config))
  
  // Batch discount: reduce network fees for batch
  const batchNetworkFee = (NETWORK_GAS_ESTIMATES[network.toLowerCase()] || 0.10) * Math.min(amounts.length, 10)
  const perItemNetworkFee = batchNetworkFee / amounts.length
  
  // Adjust network fees for batch discount
  const adjustedItemFees = itemFees.map(fee => ({
    ...fee,
    networkFee: perItemNetworkFee,
    totalFee: fee.baseFee + fee.percentageFee + perItemNetworkFee,
    netAmount: fee.netAmount + (fee.networkFee - perItemNetworkFee),
  }))
  
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0)
  const totalFees = adjustedItemFees.reduce((sum, f) => sum + f.totalFee, 0)
  const totalNetAmount = totalAmount - totalFees
  
  return {
    itemFees: adjustedItemFees,
    totalAmount,
    totalFees,
    totalNetAmount: Math.max(0, totalNetAmount),
    averageFeePerItem: totalFees / amounts.length,
  }
}

/**
 * Get fee tier based on volume
 */
export function getFeeTier(monthlyVolumeUsd: number): {
  tier: string
  percentageRate: number
  description: string
} {
  if (monthlyVolumeUsd >= 1000000) {
    return { tier: 'enterprise', percentageRate: 0.0005, description: '0.05% (Enterprise)' }
  }
  if (monthlyVolumeUsd >= 100000) {
    return { tier: 'business', percentageRate: 0.00075, description: '0.075% (Business)' }
  }
  if (monthlyVolumeUsd >= 10000) {
    return { tier: 'growth', percentageRate: 0.001, description: '0.1% (Growth)' }
  }
  return { tier: 'starter', percentageRate: 0.001, description: '0.1% (Starter)' }
}

/**
 * Format fee as string
 */
export function formatFee(feeUsd: number): string {
  if (feeUsd < 0.01) {
    return '< $0.01'
  }
  return `$${feeUsd.toFixed(2)}`
}
