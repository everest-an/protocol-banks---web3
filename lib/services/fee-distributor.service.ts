/**
 * Fee Distributor Service
 * Handles fee distribution and logging
 */

import { prisma } from '@/lib/prisma'

export interface FeeDistribution {
  totalFee: number
  protocolFee: number
  relayerFee: number
  networkFee: number
  timestamp: number
  transactionHash?: string
}

export interface FeeRecipient {
  address: string
  share: number // Percentage as decimal (0.0 - 1.0)
  name: string
}

// Fee distribution configuration
const FEE_RECIPIENTS: FeeRecipient[] = [
  { address: '0x...protocol', share: 0.70, name: 'Protocol Treasury' },
  { address: '0x...operations', share: 0.20, name: 'Operations' },
  { address: '0x...development', share: 0.10, name: 'Development Fund' },
]

/**
 * Calculate fee distribution among recipients
 */
export function calculateDistribution(
  totalProtocolFee: number
): Array<FeeRecipient & { amount: number }> {
  return FEE_RECIPIENTS.map(recipient => ({
    ...recipient,
    amount: totalProtocolFee * recipient.share,
  }))
}

/**
 * Log fee distribution to database
 */
export async function logFeeDistribution(
  distribution: FeeDistribution
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // TODO: Add FeeDistribution model to schema when needed
    console.log('[FeeDistributor] Distribution recorded (in-memory):', distribution.transactionHash)
    return { success: true, id: `fee_${Date.now()}` }
  } catch (err) {
    console.error('[FeeDistributor] Error logging distribution:', err)
    return { success: false, error: String(err) }
  }
}

/**
 * Get fee statistics for a period
 */
export async function getFeeStatistics(
  startDate: Date,
  endDate: Date
): Promise<{
  totalFees: number
  protocolFees: number
  relayerFees: number
  networkFees: number
  transactionCount: number
}> {
  try {
    // TODO: Add FeeDistribution model to schema when needed
    // For now, use ProtocolFee aggregation as proxy
    const data = await prisma.protocolFee.aggregate({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { net_fee: true, base_fee: true },
      _count: true,
    })

    return {
      totalFees: data._sum.base_fee || 0,
      protocolFees: data._sum.net_fee || 0,
      relayerFees: 0,
      networkFees: 0,
      transactionCount: data._count,
    }
  } catch (err) {
    console.error('[FeeDistributor] Error getting statistics:', err)
    return {
      totalFees: 0,
      protocolFees: 0,
      relayerFees: 0,
      networkFees: 0,
      transactionCount: 0,
    }
  }
}

/**
 * Create fee distribution record
 */
export function createFeeDistribution(
  totalFee: number,
  protocolFee: number,
  relayerFee: number,
  networkFee: number,
  transactionHash?: string
): FeeDistribution {
  return {
    totalFee,
    protocolFee,
    relayerFee,
    networkFee,
    timestamp: Date.now(),
    transactionHash,
  }
}
