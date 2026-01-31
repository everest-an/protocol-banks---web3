/**
 * Fee Distributor Service
 * Handles fee distribution and logging
 */

import { createLogger } from '@/lib/logger'

const logger = createLogger('fee-distributor')

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
  distribution: FeeDistribution,
  supabase?: import('@/types').OptionalSupabaseClient
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!supabase) {
    // Log to console in development
    logger.debug('Fee distribution (local mode)', { distribution })
    return { success: true, id: `local-${Date.now()}` }
  }
  
  try {
    const { data, error } = await supabase
      .from('fee_distributions')
      .insert({
        total_fee: distribution.totalFee,
        protocol_fee: distribution.protocolFee,
        relayer_fee: distribution.relayerFee,
        network_fee: distribution.networkFee,
        transaction_hash: distribution.transactionHash,
        created_at: new Date(distribution.timestamp).toISOString(),
      })
      .select('id')
      .single()
    
    if (error) {
      logger.error('Failed to log distribution', { error: error.message })
      return { success: false, error: error.message }
    }
    
    return { success: true, id: data.id }
  } catch (err) {
    logger.error('Error logging distribution', { error: String(err) })
    return { success: false, error: String(err) }
  }
}

/**
 * Get fee statistics for a period
 */
export async function getFeeStatistics(
  startDate: Date,
  endDate: Date,
  supabase: import('@/types').SupabaseClientType
): Promise<{
  totalFees: number
  protocolFees: number
  relayerFees: number
  networkFees: number
  transactionCount: number
}> {
  try {
    const { data, error } = await supabase
      .from('fee_distributions')
      .select('total_fee, protocol_fee, relayer_fee, network_fee')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
    
    if (error) {
      throw error
    }
    
    return {
      totalFees: data.reduce((sum: number, d: { total_fee: number }) => sum + d.total_fee, 0),
      protocolFees: data.reduce((sum: number, d: { protocol_fee: number }) => sum + d.protocol_fee, 0),
      relayerFees: data.reduce((sum: number, d: { relayer_fee: number }) => sum + d.relayer_fee, 0),
      networkFees: data.reduce((sum: number, d: { network_fee: number }) => sum + d.network_fee, 0),
      transactionCount: data.length,
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
