/**
 * Gas Manager Service
 *
 * Real-time gas price fetching, fee estimation, and cross-chain cost comparison.
 * Reuses existing RPC configuration and fee calculator infrastructure.
 *
 * @module lib/services/gas-manager-service
 */

import {
  createPublicClient,
  http,
  formatGwei,
  formatUnits,
  encodeFunctionData,
  type Address,
  type PublicClient,
  type Chain,
} from 'viem'
import {
  mainnet,
  polygon,
  optimism,
  base,
  arbitrum,
  bsc,
} from 'viem/chains'
import { RPC_URLS, CHAIN_IDS, TOKEN_ADDRESSES } from '@/lib/web3'
import { getTokenDecimals, ERC3009_TOKENS } from '@/lib/erc3009'

// ============================================================================
// Types
// ============================================================================

export interface GasPriceInfo {
  chainId: number
  chainName: string
  baseFee: bigint
  maxPriorityFee: bigint
  gasPrice: bigint
  slow: GasStrategy
  standard: GasStrategy
  fast: GasStrategy
  updatedAt: number
}

export interface GasStrategy {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  estimatedSeconds: number
}

export interface GasEstimate {
  chainId: number
  gasLimit: bigint
  gasCostWei: bigint
  gasCostUsd: number
  token: string
  amount: string
  strategy: 'slow' | 'standard' | 'fast'
}

export interface ChainFeeComparison {
  chainId: number
  chainName: string
  gasCostUsd: number
  estimatedSeconds: number
  gasless: boolean
  recommended: boolean
}

export interface TronEnergyEstimate {
  energyNeeded: number
  bandwidthNeeded: number
  estimatedTrxCost: number
  estimatedUsdCost: number
}

// ============================================================================
// Constants
// ============================================================================

const CHAIN_MAP: Record<number, Chain> = {
  [CHAIN_IDS.MAINNET]: mainnet,
  [CHAIN_IDS.POLYGON]: polygon,
  [CHAIN_IDS.OPTIMISM]: optimism,
  [CHAIN_IDS.BASE]: base,
  [CHAIN_IDS.ARBITRUM]: arbitrum,
  [CHAIN_IDS.BSC]: bsc,
}

const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.MAINNET]: 'Ethereum',
  [CHAIN_IDS.POLYGON]: 'Polygon',
  [CHAIN_IDS.OPTIMISM]: 'Optimism',
  [CHAIN_IDS.BASE]: 'Base',
  [CHAIN_IDS.ARBITRUM]: 'Arbitrum',
  [CHAIN_IDS.BSC]: 'BNB Chain',
}

/** Approximate native token USD prices (updated periodically) */
const NATIVE_PRICES_USD: Record<number, number> = {
  [CHAIN_IDS.MAINNET]: 3500,
  [CHAIN_IDS.POLYGON]: 0.5,
  [CHAIN_IDS.OPTIMISM]: 3500,
  [CHAIN_IDS.BASE]: 3500,
  [CHAIN_IDS.ARBITRUM]: 3500,
  [CHAIN_IDS.BSC]: 600,
}

/** Estimated block times in seconds */
const BLOCK_TIMES: Record<number, number> = {
  [CHAIN_IDS.MAINNET]: 12,
  [CHAIN_IDS.POLYGON]: 2,
  [CHAIN_IDS.OPTIMISM]: 2,
  [CHAIN_IDS.BASE]: 2,
  [CHAIN_IDS.ARBITRUM]: 0.25,
  [CHAIN_IDS.BSC]: 3,
}

/** Gas for a standard ERC-20 transfer */
const ERC20_TRANSFER_GAS = 65_000n

/** Cache TTL: 15 seconds */
const CACHE_TTL_MS = 15_000

/** ERC-20 transfer ABI for gas estimation */
const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// ============================================================================
// Service
// ============================================================================

export class GasManagerService {
  private clientCache = new Map<number, PublicClient>()
  private gasPriceCache = new Map<number, { data: GasPriceInfo; expires: number }>()

  /**
   * Get or create a public client for a chain
   */
  private getClient(chainId: number): PublicClient {
    const cached = this.clientCache.get(chainId)
    if (cached) return cached

    const chain = CHAIN_MAP[chainId]
    const rpcUrl = RPC_URLS[chainId]
    if (!chain || !rpcUrl) {
      throw new Error(`Unsupported chain: ${chainId}`)
    }

    const client = createPublicClient({ chain, transport: http(rpcUrl) })
    this.clientCache.set(chainId, client)
    return client
  }

  /**
   * Get real-time gas prices for a chain (with 15s cache)
   */
  async getGasPrice(chainId: number): Promise<GasPriceInfo> {
    // Check cache
    const cached = this.gasPriceCache.get(chainId)
    if (cached && Date.now() < cached.expires) {
      return cached.data
    }

    const client = this.getClient(chainId)
    const blockTime = BLOCK_TIMES[chainId] || 12

    let baseFee: bigint
    let maxPriorityFee: bigint
    let gasPrice: bigint

    try {
      // EIP-1559 fee estimation
      const feeData = await client.estimateFeesPerGas()
      gasPrice = await client.getGasPrice()
      baseFee = feeData.maxFeePerGas ? feeData.maxFeePerGas - (feeData.maxPriorityFeePerGas ?? 0n) : gasPrice
      maxPriorityFee = feeData.maxPriorityFeePerGas ?? gasPrice / 10n
    } catch {
      // Legacy fallback
      gasPrice = await client.getGasPrice()
      baseFee = gasPrice
      maxPriorityFee = gasPrice / 10n
    }

    const info: GasPriceInfo = {
      chainId,
      chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      baseFee,
      maxPriorityFee,
      gasPrice,
      slow: {
        maxFeePerGas: baseFee + maxPriorityFee / 2n,
        maxPriorityFeePerGas: maxPriorityFee / 2n,
        estimatedSeconds: blockTime * 6,
      },
      standard: {
        maxFeePerGas: baseFee + maxPriorityFee,
        maxPriorityFeePerGas: maxPriorityFee,
        estimatedSeconds: blockTime * 2,
      },
      fast: {
        maxFeePerGas: baseFee * 2n + maxPriorityFee * 2n,
        maxPriorityFeePerGas: maxPriorityFee * 2n,
        estimatedSeconds: blockTime,
      },
      updatedAt: Date.now(),
    }

    // Cache for 15 seconds
    this.gasPriceCache.set(chainId, { data: info, expires: Date.now() + CACHE_TTL_MS })
    return info
  }

  /**
   * Estimate gas cost for an ERC-20 transfer
   */
  async estimateTransferGas(params: {
    chainId: number
    token: string
    from?: Address
    to: Address
    amount: string
    strategy?: 'slow' | 'standard' | 'fast'
  }): Promise<GasEstimate> {
    const { chainId, token: rawToken, to, amount, strategy = 'standard' } = params
    const token = rawToken.toUpperCase()

    const gasPrice = await this.getGasPrice(chainId)
    const selectedStrategy = gasPrice[strategy]

    // Use standard ERC-20 transfer gas estimate, or try to estimate if from address provided
    let gasLimit = ERC20_TRANSFER_GAS

    if (params.from) {
      try {
        const client = this.getClient(chainId)
        const tokenAddress = this.getTokenAddress(chainId, token)
        const decimals = getTokenDecimals(chainId, token)

        gasLimit = await client.estimateGas({
          account: params.from,
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, BigInt(parseFloat(amount) * 10 ** decimals)],
          }),
        })
      } catch {
        // Fallback to standard estimate
        gasLimit = ERC20_TRANSFER_GAS
      }
    }

    const gasCostWei = gasLimit * selectedStrategy.maxFeePerGas
    const nativePrice = NATIVE_PRICES_USD[chainId] || 3500
    const gasCostUsd = Number(formatUnits(gasCostWei, 18)) * nativePrice

    return {
      chainId,
      gasLimit,
      gasCostWei,
      gasCostUsd: Math.round(gasCostUsd * 10000) / 10000,
      token,
      amount,
      strategy,
    }
  }

  /**
   * Compare fees across all supported chains for a given transfer
   */
  async compareCrossChainFees(params: {
    token: string
    amount: string
    to: Address
  }): Promise<ChainFeeComparison[]> {
    const { token: rawToken, amount, to } = params
    const token = rawToken.toUpperCase()
    const results: ChainFeeComparison[] = []

    // Determine which chains support this token
    const supportedChains = Object.keys(CHAIN_MAP).map(Number)

    await Promise.allSettled(
      supportedChains.map(async (chainId) => {
        const tokenAddress = this.getTokenAddressSafe(chainId, token)
        if (!tokenAddress) return // Token not available on this chain

        try {
          const estimate = await this.estimateTransferGas({
            chainId,
            token,
            to,
            amount,
            strategy: 'standard',
          })

          const gasless = !!(ERC3009_TOKENS[chainId]?.[token])
          const blockTime = BLOCK_TIMES[chainId] || 12

          results.push({
            chainId,
            chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
            gasCostUsd: estimate.gasCostUsd,
            estimatedSeconds: blockTime * 2,
            gasless,
            recommended: false,
          })
        } catch {
          // Skip chains with errors
        }
      })
    )

    // Sort by cost and mark cheapest as recommended
    results.sort((a, b) => a.gasCostUsd - b.gasCostUsd)
    if (results.length > 0) {
      results[0].recommended = true
    }

    return results
  }

  /**
   * Estimate TRON energy and bandwidth for a TRC-20 transfer
   */
  async estimateTronEnergy(params: {
    token: string
    from: string
    to: string
    amount: string
  }): Promise<TronEnergyEstimate> {
    // TRON energy estimation (approximate values for TRC-20 transfers)
    const isNewAccount = true // Conservative: assume new account
    const energyNeeded = isNewAccount ? 64_895 : 29_631
    const bandwidthNeeded = 345

    // Current TRON energy price: ~420 SUN per energy unit
    const energyPriceSun = 420
    const trxPerSun = 0.000001

    const energyCostTrx = energyNeeded * energyPriceSun * trxPerSun
    const bandwidthCostTrx = bandwidthNeeded * 1000 * trxPerSun // 1000 SUN per bandwidth

    const totalTrxCost = energyCostTrx + bandwidthCostTrx
    const trxPriceUsd = 0.12 // Approximate TRX price

    return {
      energyNeeded,
      bandwidthNeeded,
      estimatedTrxCost: Math.round(totalTrxCost * 100) / 100,
      estimatedUsdCost: Math.round(totalTrxCost * trxPriceUsd * 100) / 100,
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getTokenAddress(chainId: number, token: string): Address {
    const chainTokens = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES]
    if (!chainTokens) throw new Error(`No tokens on chain ${chainId}`)
    const address = (chainTokens as Record<string, string>)[token]
    if (!address || address === 'NATIVE') throw new Error(`${token} not on chain ${chainId}`)
    return address as Address
  }

  private getTokenAddressSafe(chainId: number, token: string): Address | null {
    try {
      return this.getTokenAddress(chainId, token)
    } catch {
      return null
    }
  }

  /**
   * Format gas price info to human-readable object (for MCP tool responses)
   */
  formatGasPriceForDisplay(info: GasPriceInfo): Record<string, unknown> {
    return {
      chain: info.chainName,
      chainId: info.chainId,
      baseFee: `${formatGwei(info.baseFee)} gwei`,
      priorityFee: `${formatGwei(info.maxPriorityFee)} gwei`,
      strategies: {
        slow: {
          maxFee: `${formatGwei(info.slow.maxFeePerGas)} gwei`,
          estimatedTime: `~${info.slow.estimatedSeconds}s`,
        },
        standard: {
          maxFee: `${formatGwei(info.standard.maxFeePerGas)} gwei`,
          estimatedTime: `~${info.standard.estimatedSeconds}s`,
        },
        fast: {
          maxFee: `${formatGwei(info.fast.maxFeePerGas)} gwei`,
          estimatedTime: `~${info.fast.estimatedSeconds}s`,
        },
      },
      updatedAt: new Date(info.updatedAt).toISOString(),
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const gasManagerService = new GasManagerService()
