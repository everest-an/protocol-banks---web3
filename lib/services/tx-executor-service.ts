/**
 * Transaction Executor Service
 *
 * Server-side ERC-20 transaction builder, signer, and broadcaster using viem.
 * Enables AI agents to autonomously execute on-chain stablecoin transfers.
 *
 * Two execution modes:
 * 1. Direct transfer: Agent signs ERC-20 transfer() and pays gas
 * 2. Gasless (ERC-3009): Agent signs transferWithAuthorization, relayer submits
 *
 * @module lib/services/tx-executor-service
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
  type TransactionReceipt,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  mainnet,
  polygon,
  optimism,
  base,
  arbitrum,
  bsc,
} from 'viem/chains'
import { TOKEN_ADDRESSES, RPC_URLS, CHAIN_IDS } from '@/lib/web3'
import {
  ERC3009_TOKENS,
  getTokenDecimals,
  isERC3009Supported,
  createTransferAuthorization,
  buildTransferAuthorizationTypedData,
} from '@/lib/erc3009'
import { relayerService, isRelayerConfigured, type RelayResponse } from './relayer-service'

// ============================================================================
// Types
// ============================================================================

export interface TxResult {
  success: boolean
  txHash: string
  chainId: number
  blockNumber?: bigint
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  error?: string
}

export interface TxReceipt {
  txHash: string
  blockNumber: bigint
  gasUsed: bigint
  effectiveGasPrice: bigint
  status: 'success' | 'reverted'
  confirmations: number
}

export interface TransferParams {
  privateKey: Hex
  to: Address
  amount: string
  token: string
  chainId: number
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface GaslessTransferParams {
  privateKey: Hex
  to: Address
  amount: string
  token: string
  chainId: number
}

// ============================================================================
// Constants
// ============================================================================

/** Hardcoded per-transaction ceiling — cannot be overridden by config */
const HARD_MAX_AMOUNT_USD = 5000

/** Allowed tokens for autonomous execution */
const ALLOWED_TOKENS = ['USDC', 'USDT', 'DAI']

/** ERC-20 transfer ABI (viem format) */
const ERC20_TRANSFER_ABI = [
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
  {
    inputs: [
      { name: 'account', type: 'address' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/** Chain ID → viem chain object mapping */
const CHAIN_MAP: Record<number, Chain> = {
  [CHAIN_IDS.MAINNET]: mainnet,
  [CHAIN_IDS.POLYGON]: polygon,
  [CHAIN_IDS.OPTIMISM]: optimism,
  [CHAIN_IDS.BASE]: base,
  [CHAIN_IDS.ARBITRUM]: arbitrum,
  [CHAIN_IDS.BSC]: bsc,
}

// ============================================================================
// Service
// ============================================================================

export class TxExecutorService {
  private clientCache: Map<number, PublicClient> = new Map()

  /**
   * Get or create a public client for a chain
   */
  private getPublicClient(chainId: number): PublicClient {
    const cached = this.clientCache.get(chainId)
    if (cached) return cached

    const chain = CHAIN_MAP[chainId]
    const rpcUrl = RPC_URLS[chainId]
    if (!chain || !rpcUrl) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    this.clientCache.set(chainId, client)
    return client
  }

  /**
   * Create a wallet client for signing and sending transactions
   */
  private createWallet(privateKey: Hex, chainId: number): WalletClient {
    const chain = CHAIN_MAP[chainId]
    const rpcUrl = RPC_URLS[chainId]
    if (!chain || !rpcUrl) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    const account = privateKeyToAccount(privateKey)
    return createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })
  }

  /**
   * Resolve token contract address for a chain
   */
  private getTokenAddress(chainId: number, token: string): Address {
    const chainTokens = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES]
    if (!chainTokens) {
      throw new Error(`No tokens configured for chain ${chainId}`)
    }

    const address = (chainTokens as Record<string, string>)[token]
    if (!address || address === 'NATIVE') {
      throw new Error(`Token ${token} not available on chain ${chainId}`)
    }

    return address as Address
  }

  // ========================================================================
  // Pre-flight Validation
  // ========================================================================

  /**
   * Validate transfer parameters before execution
   */
  private validateTransferParams(params: TransferParams | GaslessTransferParams): void {
    // 1. Token whitelist
    const token = params.token.toUpperCase()
    if (!ALLOWED_TOKENS.includes(token)) {
      throw new Error(`Token ${token} not allowed. Allowed: ${ALLOWED_TOKENS.join(', ')}`)
    }

    // 2. Amount range
    const amount = parseFloat(params.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number')
    }
    if (amount > HARD_MAX_AMOUNT_USD) {
      throw new Error(`Amount $${amount} exceeds hard limit of $${HARD_MAX_AMOUNT_USD}`)
    }

    // 3. Chain whitelist
    if (!CHAIN_MAP[params.chainId]) {
      throw new Error(`Chain ${params.chainId} not supported`)
    }

    // 4. Address format
    if (!params.to.startsWith('0x') || params.to.length !== 42) {
      throw new Error(`Invalid recipient address: ${params.to}`)
    }
  }

  /**
   * Check that the sender has sufficient token balance
   */
  private async checkTokenBalance(
    publicClient: PublicClient,
    tokenAddress: Address,
    senderAddress: Address,
    requiredAmount: bigint,
    token: string,
    chainId: number,
  ): Promise<void> {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'balanceOf',
      args: [senderAddress],
    })

    if (balance < requiredAmount) {
      const decimals = getTokenDecimals(chainId, token)
      const balanceFormatted = formatUnits(balance, decimals)
      const requiredFormatted = formatUnits(requiredAmount, decimals)
      throw new Error(
        `Insufficient ${token} balance: have ${balanceFormatted}, need ${requiredFormatted}`
      )
    }
  }

  /**
   * Check that the sender has sufficient ETH/native for gas
   */
  private async checkGasBalance(
    publicClient: PublicClient,
    senderAddress: Address,
    estimatedGasCost: bigint,
  ): Promise<void> {
    const balance = await publicClient.getBalance({ address: senderAddress })

    if (balance < estimatedGasCost) {
      const balanceEth = formatUnits(balance, 18)
      const gasCostEth = formatUnits(estimatedGasCost, 18)
      throw new Error(
        `Insufficient gas: have ${balanceEth} ETH, need ~${gasCostEth} ETH for gas`
      )
    }
  }

  // ========================================================================
  // Direct ERC-20 Transfer (Agent pays gas)
  // ========================================================================

  /**
   * Execute a direct ERC-20 transfer.
   * Agent's private key is used to sign the transaction and pay gas.
   */
  async executeTransfer(params: TransferParams): Promise<TxResult> {
    const { privateKey, to, amount, token: rawToken, chainId } = params
    const token = rawToken.toUpperCase()

    try {
      // Validate
      this.validateTransferParams(params)

      const publicClient = this.getPublicClient(chainId)
      const walletClient = this.createWallet(privateKey, chainId)
      const account = privateKeyToAccount(privateKey)
      const tokenAddress = this.getTokenAddress(chainId, token)
      const decimals = getTokenDecimals(chainId, token)
      const amountWei = parseUnits(amount, decimals)

      // Pre-flight checks
      await this.checkTokenBalance(publicClient, tokenAddress, account.address, amountWei, token, chainId)

      // Estimate gas
      const gasEstimate = await publicClient.estimateGas({
        account: account.address,
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [to, amountWei],
        }),
      })

      // Get gas price
      const feeData = await publicClient.estimateFeesPerGas()
      const maxFeePerGas = params.maxFeePerGas ?? feeData.maxFeePerGas ?? undefined
      const maxPriorityFeePerGas = params.maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas ?? undefined

      // Check gas balance (1.5x buffer)
      const estimatedGasCost = gasEstimate * (maxFeePerGas ?? BigInt(30e9)) * 3n / 2n
      await this.checkGasBalance(publicClient, account.address, estimatedGasCost)

      // Send transaction
      const chain = CHAIN_MAP[chainId]
      const txHash = await walletClient.writeContract({
        account,
        chain,
        address: tokenAddress,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [to, amountWei],
        gas: gasEstimate * 12n / 10n, // 20% buffer
        maxFeePerGas,
        maxPriorityFeePerGas,
      })

      console.log(`[TxExecutor] Transaction sent: ${txHash} on chain ${chainId}`)

      // Wait for confirmation (1 block)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000, // 60 second timeout
      })

      if (receipt.status === 'reverted') {
        return {
          success: false,
          txHash,
          chainId,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.effectiveGasPrice,
          error: 'Transaction reverted on-chain',
        }
      }

      console.log(`[TxExecutor] Transaction confirmed: ${txHash} block ${receipt.blockNumber}`)

      return {
        success: true,
        txHash,
        chainId,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error'
      console.error(`[TxExecutor] Transfer failed:`, message)
      return {
        success: false,
        txHash: '',
        chainId,
        error: message,
      }
    }
  }

  // ========================================================================
  // ERC-3009 Gasless Transfer (via Relayer)
  // ========================================================================

  /**
   * Execute a gasless ERC-3009 transfer.
   * Agent signs a transferWithAuthorization off-chain; relayer submits.
   */
  async executeGaslessTransfer(params: GaslessTransferParams): Promise<TxResult> {
    const { privateKey, to, amount, token: rawToken, chainId } = params
    const token = rawToken.toUpperCase()

    try {
      // Validate
      this.validateTransferParams(params)

      if (!isERC3009Supported(chainId, token)) {
        throw new Error(`ERC-3009 not supported for ${token} on chain ${chainId}`)
      }

      if (!isRelayerConfigured()) {
        throw new Error('No relayer configured. Use executeTransfer() for direct transfers.')
      }

      const account = privateKeyToAccount(privateKey)
      const decimals = getTokenDecimals(chainId, token)
      const amountWei = parseUnits(amount, decimals)

      // Check token balance
      const publicClient = this.getPublicClient(chainId)
      const tokenAddress = this.getTokenAddress(chainId, token)
      await this.checkTokenBalance(publicClient, tokenAddress, account.address, amountWei, token, chainId)

      // Create transfer authorization
      const authorization = createTransferAuthorization({
        from: account.address,
        to,
        amount,
        chainId,
        tokenSymbol: token,
        validityMinutes: 60,
      })

      // Build EIP-712 typed data and sign
      const typedData = buildTransferAuthorizationTypedData(chainId, token, authorization)

      const signature = await account.signTypedData({
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType,
        message: typedData.message as any,
      })

      // Submit via relayer
      const relayResult: RelayResponse = await relayerService.executeERC3009Transfer({
        chainId,
        token,
        from: account.address,
        to,
        value: amountWei.toString(),
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce as Hex,
        signature: signature as Hex,
      })

      if (relayResult.status === 'failed') {
        return {
          success: false,
          txHash: relayResult.transactionHash || '',
          chainId,
          error: relayResult.error || 'Relay failed',
        }
      }

      console.log(`[TxExecutor] Gasless transfer relayed: task=${relayResult.taskId}`)

      return {
        success: true,
        txHash: relayResult.transactionHash || relayResult.taskId,
        chainId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown gasless transfer error'
      console.error(`[TxExecutor] Gasless transfer failed:`, message)
      return {
        success: false,
        txHash: '',
        chainId,
        error: message,
      }
    }
  }

  // ========================================================================
  // Smart Execute — picks the best strategy automatically
  // ========================================================================

  /**
   * Automatically choose the best execution strategy:
   * 1. Gasless via relayer (if ERC-3009 supported + relayer configured)
   * 2. Direct transfer (fallback)
   */
  async smartExecute(params: TransferParams): Promise<TxResult> {
    const token = params.token.toUpperCase()

    // Try gasless first
    if (isERC3009Supported(params.chainId, token) && isRelayerConfigured()) {
      try {
        const result = await this.executeGaslessTransfer(params)
        if (result.success) return result
        console.warn(`[TxExecutor] Gasless failed, falling back to direct: ${result.error}`)
      } catch {
        console.warn('[TxExecutor] Gasless failed, falling back to direct transfer')
      }
    }

    // Fallback to direct transfer
    return this.executeTransfer(params)
  }

  // ========================================================================
  // Transaction Confirmation
  // ========================================================================

  /**
   * Wait for a transaction to reach a certain number of confirmations
   */
  async waitForConfirmation(
    chainId: number,
    txHash: Hex,
    confirmations: number = 1,
  ): Promise<TxReceipt> {
    const publicClient = this.getPublicClient(chainId)

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
      timeout: 120_000, // 2 minute timeout
    })

    const currentBlock = await publicClient.getBlockNumber()

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      confirmations: Number(currentBlock - receipt.blockNumber),
    }
  }

  /**
   * Get on-chain token balance for an address
   */
  async getTokenBalance(
    chainId: number,
    token: string,
    address: Address,
  ): Promise<string> {
    const publicClient = this.getPublicClient(chainId)
    const tokenAddress = this.getTokenAddress(chainId, token.toUpperCase())
    const decimals = getTokenDecimals(chainId, token.toUpperCase())

    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'balanceOf',
      args: [address],
    })

    return formatUnits(balance, decimals)
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const txExecutorService = new TxExecutorService()
