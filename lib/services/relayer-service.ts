/**
 * Relayer Service
 * 
 * Handles gasless transaction execution through various relayer providers.
 * Supports ERC-3009 (USDC transfers), ERC-2612 (Permit), and meta-transactions.
 * 
 * Supported Relayer Providers:
 * - Gelato Relay (https://relay.gelato.network)
 * - Biconomy (https://biconomy.io)
 * - OpenZeppelin Defender (https://defender.openzeppelin.com)
 * - Self-hosted relayer
 */

import { Address, Hex, encodeFunctionData, parseAbi } from 'viem'
import { ERC3009_TOKENS, getTokenAddress, buildTransferAuthorizationTypedData } from '../erc3009'

// ============================================================================
// Types
// ============================================================================

export type RelayerProvider = 'gelato' | 'biconomy' | 'defender' | 'custom'

export interface RelayerConfig {
  provider: RelayerProvider
  apiKey: string
  apiUrl?: string
  sponsorAddress?: Address // For sponsored transactions
}

export interface RelayRequest {
  chainId: number
  target: Address
  data: Hex
  value?: bigint
  gasLimit?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface RelayResponse {
  taskId: string
  transactionHash?: Hex
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  error?: string
}

export interface ERC3009RelayRequest {
  chainId: number
  token: string // e.g., 'USDC'
  from: Address
  to: Address
  value: string
  validAfter: number
  validBefore: number
  nonce: Hex
  signature: Hex
}

// ============================================================================
// ERC-3009 ABI
// ============================================================================

const ERC3009_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
  'function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
])

// ============================================================================
// Relayer Service Class
// ============================================================================

export class RelayerService {
  private config: RelayerConfig
  
  constructor(config?: Partial<RelayerConfig>) {
    this.config = {
      provider: (process.env.RELAYER_PROVIDER as RelayerProvider) || 'custom',
      apiKey: process.env.RELAYER_API_KEY || '',
      apiUrl: process.env.RELAYER_URL,
      sponsorAddress: process.env.RELAYER_SPONSOR_ADDRESS as Address,
      ...config,
    }
  }

  /**
   * Execute ERC-3009 transfer via relayer
   */
  async executeERC3009Transfer(request: ERC3009RelayRequest): Promise<RelayResponse> {
    const tokenInfo = ERC3009_TOKENS[request.chainId]?.[request.token]
    if (!tokenInfo) {
      throw new Error(`Token ${request.token} not supported for ERC-3009 on chain ${request.chainId}`)
    }

    // Parse signature into v, r, s
    const { v, r, s } = this.parseSignature(request.signature)

    // Encode the transferWithAuthorization call
    const calldata = encodeFunctionData({
      abi: ERC3009_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        request.from,
        request.to,
        BigInt(request.value),
        BigInt(request.validAfter),
        BigInt(request.validBefore),
        request.nonce as Hex,
        v,
        r,
        s,
      ],
    })

    // Send to relayer
    return this.relay({
      chainId: request.chainId,
      target: tokenInfo.address as Address,
      data: calldata,
    })
  }

  /**
   * Generic relay request
   */
  async relay(request: RelayRequest): Promise<RelayResponse> {
    switch (this.config.provider) {
      case 'gelato':
        return this.relayViaGelato(request)
      case 'biconomy':
        return this.relayViaBiconomy(request)
      case 'defender':
        return this.relayViaDefender(request)
      case 'custom':
      default:
        return this.relayViaCustom(request)
    }
  }

  /**
   * Check relay task status
   */
  async getTaskStatus(taskId: string): Promise<RelayResponse> {
    switch (this.config.provider) {
      case 'gelato':
        return this.getGelatoTaskStatus(taskId)
      case 'biconomy':
        return this.getBiconomyTaskStatus(taskId)
      case 'defender':
        return this.getDefenderTaskStatus(taskId)
      case 'custom':
      default:
        return this.getCustomTaskStatus(taskId)
    }
  }

  // ============================================================================
  // Gelato Relay
  // ============================================================================

  private async relayViaGelato(request: RelayRequest): Promise<RelayResponse> {
    const apiUrl = this.config.apiUrl || 'https://relay.gelato.digital'
    
    const response = await fetch(`${apiUrl}/relays/v2/sponsored-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chainId: request.chainId,
        target: request.target,
        data: request.data,
        sponsorApiKey: this.config.apiKey,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gelato relay failed: ${error}`)
    }

    const result = await response.json()
    return {
      taskId: result.taskId,
      status: 'pending',
    }
  }

  private async getGelatoTaskStatus(taskId: string): Promise<RelayResponse> {
    const apiUrl = this.config.apiUrl || 'https://relay.gelato.digital'
    
    const response = await fetch(`${apiUrl}/tasks/status/${taskId}`)
    
    if (!response.ok) {
      throw new Error('Failed to get Gelato task status')
    }

    const result = await response.json()
    const task = result.task

    let status: RelayResponse['status'] = 'pending'
    if (task.taskState === 'ExecSuccess') {
      status = 'confirmed'
    } else if (task.taskState === 'ExecReverted' || task.taskState === 'Cancelled') {
      status = 'failed'
    } else if (task.transactionHash) {
      status = 'submitted'
    }

    return {
      taskId,
      transactionHash: task.transactionHash,
      status,
      error: task.lastCheckMessage,
    }
  }

  // ============================================================================
  // Biconomy
  // ============================================================================

  private async relayViaBiconomy(request: RelayRequest): Promise<RelayResponse> {
    const apiUrl = this.config.apiUrl || 'https://api.biconomy.io'
    
    const response = await fetch(`${apiUrl}/api/v1/meta-tx/native`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        to: request.target,
        apiId: this.config.apiKey,
        params: [request.data],
        from: this.config.sponsorAddress,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Biconomy relay failed: ${error}`)
    }

    const result = await response.json()
    return {
      taskId: result.txHash || result.transactionId,
      transactionHash: result.txHash,
      status: result.txHash ? 'submitted' : 'pending',
    }
  }

  private async getBiconomyTaskStatus(taskId: string): Promise<RelayResponse> {
    // Biconomy returns tx hash directly, so we can check on-chain
    return {
      taskId,
      transactionHash: taskId as Hex,
      status: 'submitted',
    }
  }

  // ============================================================================
  // OpenZeppelin Defender
  // ============================================================================

  private async relayViaDefender(request: RelayRequest): Promise<RelayResponse> {
    const apiUrl = this.config.apiUrl || 'https://api.defender.openzeppelin.com'
    
    const response = await fetch(`${apiUrl}/txs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        to: request.target,
        value: request.value?.toString() || '0',
        data: request.data,
        gasLimit: request.gasLimit?.toString(),
        speed: 'fast',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Defender relay failed: ${error}`)
    }

    const result = await response.json()
    return {
      taskId: result.transactionId,
      transactionHash: result.hash,
      status: result.hash ? 'submitted' : 'pending',
    }
  }

  private async getDefenderTaskStatus(taskId: string): Promise<RelayResponse> {
    const apiUrl = this.config.apiUrl || 'https://api.defender.openzeppelin.com'
    
    const response = await fetch(`${apiUrl}/txs/${taskId}`, {
      headers: {
        'X-Api-Key': this.config.apiKey,
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get Defender task status')
    }

    const result = await response.json()

    let status: RelayResponse['status'] = 'pending'
    if (result.status === 'mined') {
      status = 'confirmed'
    } else if (result.status === 'failed') {
      status = 'failed'
    } else if (result.hash) {
      status = 'submitted'
    }

    return {
      taskId,
      transactionHash: result.hash,
      status,
    }
  }

  // ============================================================================
  // Custom/Self-hosted Relayer
  // ============================================================================

  private async relayViaCustom(request: RelayRequest): Promise<RelayResponse> {
    if (!this.config.apiUrl) {
      // Development mode - simulate relay
      console.warn('[Relayer] No custom relayer URL configured, simulating...')
      return this.simulateRelay(request)
    }

    const response = await fetch(`${this.config.apiUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        chainId: request.chainId,
        to: request.target,
        data: request.data,
        value: request.value?.toString(),
        gasLimit: request.gasLimit?.toString(),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Custom relayer failed: ${error}`)
    }

    const result = await response.json()
    return {
      taskId: result.taskId || result.transactionHash,
      transactionHash: result.transactionHash,
      status: result.transactionHash ? 'submitted' : 'pending',
    }
  }

  private async getCustomTaskStatus(taskId: string): Promise<RelayResponse> {
    if (!this.config.apiUrl) {
      // Development mode - return mock confirmed
      return {
        taskId,
        transactionHash: `0x${taskId.replace(/-/g, '')}` as Hex,
        status: 'confirmed',
      }
    }

    const response = await fetch(`${this.config.apiUrl}/status/${taskId}`, {
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get task status')
    }

    const result = await response.json()
    return {
      taskId,
      transactionHash: result.transactionHash,
      status: result.status,
      error: result.error,
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
    // Remove '0x' prefix if present
    const sig = signature.startsWith('0x') ? signature.slice(2) : signature
    
    // Standard signature is 65 bytes: r (32) + s (32) + v (1)
    const r = `0x${sig.slice(0, 64)}` as Hex
    const s = `0x${sig.slice(64, 128)}` as Hex
    let v = parseInt(sig.slice(128, 130), 16)
    
    // Normalize v value (support both 0/1 and 27/28 formats)
    if (v < 27) {
      v += 27
    }

    return { v, r, s }
  }

  private simulateRelay(request: RelayRequest): RelayResponse {
    const mockTaskId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const mockTxHash = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as Hex
    
    console.log(`[Relayer] Simulated relay:`, {
      taskId: mockTaskId,
      chainId: request.chainId,
      target: request.target,
    })

    return {
      taskId: mockTaskId,
      transactionHash: mockTxHash,
      status: 'confirmed',
    }
  }

  /**
   * Estimate relay cost
   */
  async estimateRelayCost(chainId: number, gasLimit: bigint = 100000n): Promise<{
    gasEstimate: bigint
    gasPriceGwei: number
    costUsd: number
  }> {
    // Gas prices per chain (approximate)
    const gasPrices: Record<number, number> = {
      1: 30, // Ethereum
      137: 50, // Polygon
      42161: 0.1, // Arbitrum
      8453: 0.01, // Base
      10: 0.01, // Optimism
    }

    // ETH prices (approximate)
    const ethPrices: Record<number, number> = {
      1: 3000, // ETH
      137: 1, // MATIC
      42161: 3000, // ETH
      8453: 3000, // ETH
      10: 3000, // ETH
    }

    const gasPriceGwei = gasPrices[chainId] || 30
    const ethPrice = ethPrices[chainId] || 3000
    
    const gasCostWei = gasLimit * BigInt(gasPriceGwei) * BigInt(1e9)
    const gasCostEth = Number(gasCostWei) / 1e18
    const costUsd = gasCostEth * ethPrice

    return {
      gasEstimate: gasLimit,
      gasPriceGwei,
      costUsd,
    }
  }
}

// ============================================================================
// Default instance
// ============================================================================

export const relayerService = new RelayerService()

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Execute ERC-3009 gasless USDC transfer
 */
export async function executeGaslessUSDCTransfer(
  chainId: number,
  from: Address,
  to: Address,
  amount: string,
  validAfter: number,
  validBefore: number,
  nonce: Hex,
  signature: Hex
): Promise<RelayResponse> {
  return relayerService.executeERC3009Transfer({
    chainId,
    token: 'USDC',
    from,
    to,
    value: amount,
    validAfter,
    validBefore,
    nonce,
    signature,
  })
}

/**
 * Check if relayer is configured and available
 */
export function isRelayerConfigured(): boolean {
  return !!(process.env.RELAYER_URL || process.env.RELAYER_API_KEY)
}

/**
 * Get supported chains for relayer
 */
export function getSupportedRelayChains(): number[] {
  return [1, 137, 42161, 8453, 10]
}
