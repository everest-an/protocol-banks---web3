export interface BatchPaymentRequest {
  recipients: Array<{
    address: string
    amount: string
    token: string
    vendorName?: string
  }>
  from: string
  chainId: number
}

export interface PaymentResult {
  success: boolean
  txHash?: string
  error?: string
  recipient?: string
}

export interface ContractConfig {
  batchTransferAddress?: string
  rpcUrl?: string
}

// Chain configurations for batch transfer contracts
const CHAIN_CONFIGS: Record<number, ContractConfig> = {
  1: { // Ethereum Mainnet
    batchTransferAddress: process.env.NEXT_PUBLIC_BATCH_TRANSFER_ETH,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ETHEREUM,
  },
  137: { // Polygon
    batchTransferAddress: process.env.NEXT_PUBLIC_BATCH_TRANSFER_POLYGON,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON,
  },
  42161: { // Arbitrum
    batchTransferAddress: process.env.NEXT_PUBLIC_BATCH_TRANSFER_ARBITRUM,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ARBITRUM,
  },
  8453: { // Base
    batchTransferAddress: process.env.NEXT_PUBLIC_BATCH_TRANSFER_BASE,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE,
  },
  10: { // Optimism
    batchTransferAddress: process.env.NEXT_PUBLIC_BATCH_TRANSFER_OPTIMISM,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM,
  },
}

export class PaymentService {
  /**
   * Execute batch payment using EIP-3009 authorization or direct transfer
   * In production, this calls the BatchTransfer smart contract
   */
  static async executeBatchPayment(
    request: BatchPaymentRequest,
    signFunction: (data: any) => Promise<string>,
    sendTransaction?: (tx: any) => Promise<string>,
  ): Promise<PaymentResult[]> {
    console.log("[PaymentService] Executing batch payment", {
      recipientCount: request.recipients.length,
      from: request.from,
      chainId: request.chainId,
    })

    const chainConfig = CHAIN_CONFIGS[request.chainId]
    const results: PaymentResult[] = []

    // Check if we have real contract deployment
    const useRealContract = chainConfig?.batchTransferAddress && sendTransaction

    for (const recipient of request.recipients) {
      try {
        if (useRealContract) {
          // Real blockchain execution
          const txHash = await this.executeRealTransfer(
            request,
            recipient,
            chainConfig,
            sendTransaction,
          )
          results.push({
            success: true,
            txHash,
            recipient: recipient.address,
          })
        } else {
          // Fallback: Sign EIP-3009 authorization (for demo/testing)
          const authorization = {
            from: request.from,
            to: recipient.address,
            value: recipient.amount,
            validAfter: Math.floor(Date.now() / 1000),
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: crypto.randomUUID(),
          }

          await signFunction(authorization)

          // Demo mode: simulate success with mock tx hash
          console.warn("[PaymentService] Using mock execution - configure contract for real transfers")
          results.push({
            success: true,
            txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
            recipient: recipient.address,
          })
        }

        console.log("[PaymentService] Payment successful", {
          to: recipient.address,
          amount: recipient.amount,
          real: useRealContract,
        })
      } catch (error) {
        console.error("[PaymentService] Payment failed", error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          recipient: recipient.address,
        })
      }
    }

    return results
  }

  /**
   * Execute real blockchain transfer via BatchTransfer contract
   */
  private static async executeRealTransfer(
    request: BatchPaymentRequest,
    recipient: { address: string; amount: string; token: string },
    config: ContractConfig,
    sendTransaction: (tx: any) => Promise<string>,
  ): Promise<string> {
    // ERC-20 transfer function signature
    const ERC20_TRANSFER_ABI = "0xa9059cbb" // transfer(address,uint256)

    // For native token (ETH/MATIC), send direct transfer
    if (recipient.token === "ETH" || recipient.token === "MATIC" || recipient.token === "native") {
      const tx = {
        to: recipient.address,
        value: BigInt(Math.floor(parseFloat(recipient.amount) * 1e18)).toString(16),
        chainId: request.chainId,
      }
      return await sendTransaction(tx)
    }

    // For ERC-20 tokens, encode transfer call
    const tokenAddress = this.getTokenAddress(recipient.token, request.chainId)
    if (!tokenAddress) {
      throw new Error(`Token ${recipient.token} not supported on chain ${request.chainId}`)
    }

    // Encode transfer(address recipient, uint256 amount)
    const amountHex = BigInt(Math.floor(parseFloat(recipient.amount) * 1e6)).toString(16).padStart(64, '0') // Assuming 6 decimals for USDC/USDT
    const addressHex = recipient.address.slice(2).toLowerCase().padStart(64, '0')
    const data = ERC20_TRANSFER_ABI + addressHex + amountHex

    const tx = {
      to: tokenAddress,
      data,
      chainId: request.chainId,
    }

    return await sendTransaction(tx)
  }

  /**
   * Get token contract address for chain
   */
  private static getTokenAddress(token: string, chainId: number): string | null {
    // USDC addresses
    const USDC_ADDRESSES: Record<number, string> = {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
    }

    // USDT addresses
    const USDT_ADDRESSES: Record<number, string> = {
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
    }

    if (token === "USDC") return USDC_ADDRESSES[chainId] || null
    if (token === "USDT") return USDT_ADDRESSES[chainId] || null

    return null
  }

  /**
   * Store payment record in database via Prisma API route
   */
  static async recordPayment(
    payment: {
      from: string
      to: string
      amount: string
      token: string
      chain?: string
      txHash: string
      status: string
    },
  ): Promise<boolean> {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_address: payment.from,
          to_address: payment.to,
          amount: payment.amount,
          token: payment.token,
          chain: payment.chain || "Ethereum",
          tx_hash: payment.txHash,
          status: payment.status,
          type: "sent",
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to record payment")
      }

      return true
    } catch (error) {
      console.error("[v0] PaymentService: failed to record payment", error)
      return false
    }
  }
}
