/**
 * x402 Fee Calculator Service
 * Calculates relayer fees for x402 protocol
 */

export interface RelayerFeeBreakdown {
  gasEstimate: bigint
  gasPriceGwei: number
  gasCostUsd: number
  relayerMarkup: number
  totalFeeUsd: number
  totalFeeWei: bigint
}

// Base gas costs for TransferWithAuthorization
const BASE_GAS_TRANSFER = 65000n
const GAS_PER_RECIPIENT = 21000n

// Relayer markup percentage (2.5%)
const RELAYER_MARKUP = 0.025

// Gas prices by chain (in Gwei) - these should be fetched dynamically in production
const DEFAULT_GAS_PRICES: Record<number, number> = {
  1: 30,      // Ethereum mainnet
  137: 100,   // Polygon
  42161: 0.1, // Arbitrum
  10: 0.001,  // Optimism
  8453: 0.001, // Base
  43114: 25,  // Avalanche
}

// ETH prices by chain (native token to USD)
const NATIVE_TOKEN_PRICES: Record<number, number> = {
  1: 2500,    // ETH
  137: 2500,  // ETH (bridged)
  42161: 2500, // ETH
  10: 2500,   // ETH
  8453: 2500, // ETH
  43114: 35,  // AVAX
}

/**
 * Calculate gas estimate for transaction
 */
export function estimateGas(recipientCount: number = 1): bigint {
  return BASE_GAS_TRANSFER + (GAS_PER_RECIPIENT * BigInt(Math.max(0, recipientCount - 1)))
}

/**
 * Calculate relayer fee
 */
export function calculateRelayerFee(
  chainId: number,
  recipientCount: number = 1,
  customGasPriceGwei?: number
): RelayerFeeBreakdown {
  const gasEstimate = estimateGas(recipientCount)
  const gasPriceGwei = customGasPriceGwei ?? DEFAULT_GAS_PRICES[chainId] ?? 10
  const nativeTokenPrice = NATIVE_TOKEN_PRICES[chainId] ?? 2500
  
  // Calculate gas cost in wei
  const gasPriceWei = BigInt(Math.floor(gasPriceGwei * 1e9))
  const gasCostWei = gasEstimate * gasPriceWei
  
  // Convert to USD
  const gasCostEth = Number(gasCostWei) / 1e18
  const gasCostUsd = gasCostEth * nativeTokenPrice
  
  // Add relayer markup
  const relayerMarkup = gasCostUsd * RELAYER_MARKUP
  const totalFeeUsd = gasCostUsd + relayerMarkup
  
  // Calculate total fee in wei (for on-chain payment)
  const totalFeeWei = gasCostWei + BigInt(Math.floor(Number(gasCostWei) * RELAYER_MARKUP))
  
  return {
    gasEstimate,
    gasPriceGwei,
    gasCostUsd,
    relayerMarkup,
    totalFeeUsd,
    totalFeeWei,
  }
}

/**
 * Calculate batch relayer fee with discount
 */
export function calculateBatchRelayerFee(
  chainId: number,
  recipientCount: number,
  customGasPriceGwei?: number
): RelayerFeeBreakdown & {
  perRecipientFeeUsd: number
  batchDiscount: number
} {
  const baseFee = calculateRelayerFee(chainId, recipientCount, customGasPriceGwei)
  
  // Apply batch discount (up to 30% for large batches)
  const discountMultiplier = Math.min(0.3, recipientCount * 0.01)
  const batchDiscount = baseFee.totalFeeUsd * discountMultiplier
  const discountedTotalFee = baseFee.totalFeeUsd - batchDiscount
  
  return {
    ...baseFee,
    totalFeeUsd: discountedTotalFee,
    perRecipientFeeUsd: discountedTotalFee / recipientCount,
    batchDiscount,
  }
}

/**
 * Get estimated confirmation time
 */
export function getEstimatedConfirmationTime(chainId: number): number {
  const confirmationTimes: Record<number, number> = {
    1: 60,      // Ethereum ~1 minute
    137: 10,    // Polygon ~10 seconds
    42161: 5,   // Arbitrum ~5 seconds
    10: 5,      // Optimism ~5 seconds
    8453: 5,    // Base ~5 seconds
    43114: 10,  // Avalanche ~10 seconds
  }
  return confirmationTimes[chainId] ?? 30
}

/**
 * Format fee for display
 */
export function formatRelayerFee(feeUsd: number): string {
  if (feeUsd < 0.001) return '< $0.001'
  if (feeUsd < 0.01) return `$${feeUsd.toFixed(4)}`
  return `$${feeUsd.toFixed(2)}`
}
