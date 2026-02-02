/**
 * Subscription Executor Service
 * 订阅支付执行服务 - 处理自动扣款
 *
 * 支持两种模式：
 * 1. EIP-3009 预授权模式 - 用户预签名授权，系统代执行
 * 2. 合约授权模式 - 用户预先 approve，系统调用合约扣款
 */

import { ethers } from "ethers"
import { getSupabase } from "@/lib/supabase"
import { notificationService } from "./notification-service"
import type { Subscription } from "./subscription-service"

// ============================================
// Types
// ============================================

export interface ExecutionResult {
  success: boolean
  txHash?: string
  error?: string
  retryable?: boolean
}

export interface SubscriptionAuthorization {
  id: string
  subscription_id: string
  authorization_type: "eip3009" | "allowance"
  // EIP-3009 fields
  signature?: string
  nonce?: string
  valid_after?: number
  valid_before?: number
  // Common fields
  token_address: string
  spender_address?: string
  amount: string
  chain_id: number
  is_active: boolean
  created_at: string
}

// ============================================
// Constants
// ============================================

// RPC endpoints for different chains
const RPC_ENDPOINTS: Record<number, string> = {
  1: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  137: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
  42161: process.env.ARBITRUM_RPC_URL || "https://arbitrum.llamarpc.com",
  8453: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
  10: process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
}

// Token addresses per chain
const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EessdDAD3A319F",
  },
  137: {
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  8453: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
}

// ERC20 ABI (minimal for balance and transfer)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]

// EIP-3009 ABI
const EIP3009_ABI = [
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]

// ============================================
// Subscription Executor Service
// ============================================

export class SubscriptionExecutorService {
  /**
   * 执行订阅支付
   */
  async executeSubscription(subscription: Subscription): Promise<ExecutionResult> {
    console.log(`[SubscriptionExecutor] Processing subscription ${subscription.id}`)

    try {
      // 1. 获取授权信息
      const authorization = await this.getAuthorization(subscription.id)

      // 2. 验证余额
      const balanceCheck = await this.checkBalance(
        subscription.wallet_address,
        subscription.token,
        subscription.amount,
        subscription.chain_id
      )

      if (!balanceCheck.sufficient) {
        await this.handleInsufficientBalance(subscription, balanceCheck.balance)
        return {
          success: false,
          error: `Insufficient balance: ${balanceCheck.balance} < ${subscription.amount}`,
          retryable: true, // 余额不足可以重试
        }
      }

      // 3. 执行支付
      let result: ExecutionResult

      if (authorization?.authorization_type === "eip3009" && authorization.signature) {
        result = await this.executeEIP3009Payment(subscription, authorization)
      } else if (authorization?.authorization_type === "allowance") {
        result = await this.executeAllowancePayment(subscription, authorization)
      } else {
        // 无授权，发送通知让用户确认
        await this.requestUserConfirmation(subscription)
        return {
          success: false,
          error: "No valid authorization found. User confirmation requested.",
          retryable: false,
        }
      }

      // 4. 处理结果
      if (result.success) {
        await this.handleSuccess(subscription, result.txHash!)
      } else {
        await this.handleFailure(subscription, result.error!)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[SubscriptionExecutor] Error executing subscription ${subscription.id}:`, error)

      await this.handleFailure(subscription, errorMessage)

      return {
        success: false,
        error: errorMessage,
        retryable: this.isRetryableError(errorMessage),
      }
    }
  }

  /**
   * 获取订阅的授权信息
   */
  private async getAuthorization(subscriptionId: string): Promise<SubscriptionAuthorization | null> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("subscription_authorizations")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .eq("is_active", true)
      .single()

    if (error || !data) {
      console.log(`[SubscriptionExecutor] No authorization found for subscription ${subscriptionId}`)
      return null
    }

    // 检查 EIP-3009 授权是否过期
    if (data.authorization_type === "eip3009" && data.valid_before) {
      const now = Math.floor(Date.now() / 1000)
      if (now >= data.valid_before) {
        console.log(`[SubscriptionExecutor] EIP-3009 authorization expired for subscription ${subscriptionId}`)
        // 标记授权为无效
        await supabase
          .from("subscription_authorizations")
          .update({ is_active: false })
          .eq("id", data.id)
        return null
      }
    }

    return data as SubscriptionAuthorization
  }

  /**
   * 检查钱包余额
   */
  async checkBalance(
    walletAddress: string,
    token: string,
    requiredAmount: string,
    chainId: number
  ): Promise<{ sufficient: boolean; balance: string }> {
    try {
      const rpcUrl = RPC_ENDPOINTS[chainId]
      if (!rpcUrl) {
        throw new Error(`Unsupported chain: ${chainId}`)
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const tokenAddress = TOKEN_ADDRESSES[chainId]?.[token]

      if (!tokenAddress) {
        throw new Error(`Token ${token} not supported on chain ${chainId}`)
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
      ])

      const balanceFormatted = ethers.formatUnits(balance, decimals)
      const required = parseFloat(requiredAmount)
      const actual = parseFloat(balanceFormatted)

      return {
        sufficient: actual >= required,
        balance: balanceFormatted,
      }
    } catch (error) {
      console.error(`[SubscriptionExecutor] Balance check failed:`, error)
      // 余额检查失败时，假设余额充足，让实际交易去验证
      return { sufficient: true, balance: "unknown" }
    }
  }

  /**
   * 使用 EIP-3009 执行支付
   */
  private async executeEIP3009Payment(
    subscription: Subscription,
    authorization: SubscriptionAuthorization
  ): Promise<ExecutionResult> {
    console.log(`[SubscriptionExecutor] Executing EIP-3009 payment for subscription ${subscription.id}`)

    try {
      const rpcUrl = RPC_ENDPOINTS[subscription.chain_id]
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // 获取 relayer 钱包（用于提交交易）
      const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY
      if (!relayerPrivateKey) {
        return {
          success: false,
          error: "Relayer not configured",
          retryable: false,
        }
      }

      const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider)
      const tokenContract = new ethers.Contract(
        authorization.token_address,
        [...ERC20_ABI, ...EIP3009_ABI],
        relayerWallet
      )

      // 解析签名
      const signature = authorization.signature!
      const { v, r, s } = ethers.Signature.from(signature)

      // 解析金额
      const decimals = await tokenContract.decimals()
      const amount = ethers.parseUnits(subscription.amount, decimals)

      // 执行 receiveWithAuthorization (收款方调用)
      // 或 transferWithAuthorization (任何人调用)
      const tx = await tokenContract.transferWithAuthorization(
        subscription.wallet_address, // from
        authorization.spender_address || process.env.TREASURY_ADDRESS, // to (平台收款地址)
        amount,
        authorization.valid_after || 0,
        authorization.valid_before || Math.floor(Date.now() / 1000) + 86400,
        authorization.nonce,
        v,
        r,
        s
      )

      console.log(`[SubscriptionExecutor] EIP-3009 tx submitted: ${tx.hash}`)

      // 等待确认
      const receipt = await tx.wait(1)

      if (receipt.status === 1) {
        return { success: true, txHash: tx.hash }
      } else {
        return { success: false, error: "Transaction reverted", retryable: false }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[SubscriptionExecutor] EIP-3009 payment failed:`, error)

      return {
        success: false,
        error: errorMessage,
        retryable: this.isRetryableError(errorMessage),
      }
    }
  }

  /**
   * 使用 allowance 执行支付
   */
  private async executeAllowancePayment(
    subscription: Subscription,
    authorization: SubscriptionAuthorization
  ): Promise<ExecutionResult> {
    console.log(`[SubscriptionExecutor] Executing allowance payment for subscription ${subscription.id}`)

    try {
      const rpcUrl = RPC_ENDPOINTS[subscription.chain_id]
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // 获取 executor 钱包
      const executorPrivateKey = process.env.SUBSCRIPTION_EXECUTOR_PRIVATE_KEY
      if (!executorPrivateKey) {
        return {
          success: false,
          error: "Executor not configured",
          retryable: false,
        }
      }

      const executorWallet = new ethers.Wallet(executorPrivateKey, provider)
      const tokenContract = new ethers.Contract(
        authorization.token_address,
        ERC20_ABI,
        executorWallet
      )

      // 检查 allowance
      const allowance = await tokenContract.allowance(
        subscription.wallet_address,
        authorization.spender_address
      )

      const decimals = await tokenContract.decimals()
      const requiredAmount = ethers.parseUnits(subscription.amount, decimals)

      if (allowance < requiredAmount) {
        return {
          success: false,
          error: `Insufficient allowance: ${ethers.formatUnits(allowance, decimals)} < ${subscription.amount}`,
          retryable: false, // 需要用户重新授权
        }
      }

      // 执行 transferFrom
      const tx = await tokenContract.transferFrom(
        subscription.wallet_address,
        authorization.spender_address || process.env.TREASURY_ADDRESS,
        requiredAmount
      )

      console.log(`[SubscriptionExecutor] Allowance tx submitted: ${tx.hash}`)

      const receipt = await tx.wait(1)

      if (receipt.status === 1) {
        return { success: true, txHash: tx.hash }
      } else {
        return { success: false, error: "Transaction reverted", retryable: false }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[SubscriptionExecutor] Allowance payment failed:`, error)

      return {
        success: false,
        error: errorMessage,
        retryable: this.isRetryableError(errorMessage),
      }
    }
  }

  /**
   * 处理余额不足
   */
  private async handleInsufficientBalance(subscription: Subscription, currentBalance: string): Promise<void> {
    console.log(`[SubscriptionExecutor] Insufficient balance for subscription ${subscription.id}`)

    // 发送通知
    try {
      await notificationService.send({
        type: "subscription_payment_failed",
        user_address: subscription.owner_address,
        title: "订阅支付失败 - 余额不足",
        body: `您的订阅 "${subscription.service_name}" 因余额不足无法支付。当前余额: ${currentBalance} ${subscription.token}，需要: ${subscription.amount} ${subscription.token}`,
        data: {
          subscription_id: subscription.id,
          reason: "insufficient_balance",
          required: subscription.amount,
          available: currentBalance,
        },
      })
    } catch (error) {
      console.error(`[SubscriptionExecutor] Failed to send notification:`, error)
    }
  }

  /**
   * 请求用户确认（无授权时）
   */
  private async requestUserConfirmation(subscription: Subscription): Promise<void> {
    console.log(`[SubscriptionExecutor] Requesting user confirmation for subscription ${subscription.id}`)

    try {
      await notificationService.send({
        type: "subscription_confirmation_required",
        user_address: subscription.owner_address,
        title: "订阅支付需要确认",
        body: `您的订阅 "${subscription.service_name}" 需要您确认支付 ${subscription.amount} ${subscription.token}`,
        data: {
          subscription_id: subscription.id,
          action_required: "confirm_payment",
        },
      })
    } catch (error) {
      console.error(`[SubscriptionExecutor] Failed to send confirmation request:`, error)
    }
  }

  /**
   * 处理支付成功
   */
  private async handleSuccess(subscription: Subscription, txHash: string): Promise<void> {
    console.log(`[SubscriptionExecutor] Payment successful for subscription ${subscription.id}: ${txHash}`)

    // 通知用户
    try {
      await notificationService.send({
        type: "subscription_payment_success",
        user_address: subscription.owner_address,
        title: "订阅支付成功",
        body: `您的订阅 "${subscription.service_name}" 已成功支付 ${subscription.amount} ${subscription.token}`,
        data: {
          subscription_id: subscription.id,
          tx_hash: txHash,
          amount: subscription.amount,
          token: subscription.token,
        },
      })
    } catch (error) {
      console.error(`[SubscriptionExecutor] Failed to send success notification:`, error)
    }
  }

  /**
   * 处理支付失败
   */
  private async handleFailure(subscription: Subscription, errorMessage: string): Promise<void> {
    console.log(`[SubscriptionExecutor] Payment failed for subscription ${subscription.id}: ${errorMessage}`)

    const supabase = getSupabase()

    // 记录失败并安排重试
    const retryAt = new Date()
    retryAt.setHours(retryAt.getHours() + 24) // 24小时后重试

    await supabase.from("subscription_payment_retries").insert({
      subscription_id: subscription.id,
      error_message: errorMessage,
      retry_at: retryAt.toISOString(),
      retry_count: 0,
    })

    // 通知用户
    try {
      await notificationService.send({
        type: "subscription_payment_failed",
        user_address: subscription.owner_address,
        title: "订阅支付失败",
        body: `您的订阅 "${subscription.service_name}" 支付失败: ${errorMessage}。系统将在24小时后重试。`,
        data: {
          subscription_id: subscription.id,
          error: errorMessage,
          retry_at: retryAt.toISOString(),
        },
      })
    } catch (error) {
      console.error(`[SubscriptionExecutor] Failed to send failure notification:`, error)
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: string): boolean {
    const nonRetryableErrors = [
      "insufficient allowance",
      "authorization expired",
      "invalid signature",
      "nonce already used",
      "user rejected",
    ]

    return !nonRetryableErrors.some((e) => error.toLowerCase().includes(e))
  }

  /**
   * 处理重试队列
   */
  async processRetryQueue(limit = 50): Promise<{ processed: number; successful: number }> {
    const supabase = getSupabase()

    // 获取待重试的订阅
    const { data: retries, error } = await supabase
      .from("subscription_payment_retries")
      .select("*, subscription:subscriptions(*)")
      .lte("retry_at", new Date().toISOString())
      .lt("retry_count", 3) // 最多重试3次
      .limit(limit)

    if (error || !retries || retries.length === 0) {
      return { processed: 0, successful: 0 }
    }

    let successful = 0

    for (const retry of retries) {
      const subscription = retry.subscription as Subscription

      if (!subscription || subscription.status !== "payment_failed") {
        // 删除无效重试记录
        await supabase.from("subscription_payment_retries").delete().eq("id", retry.id)
        continue
      }

      const result = await this.executeSubscription(subscription)

      if (result.success) {
        successful++
        // 删除重试记录
        await supabase.from("subscription_payment_retries").delete().eq("id", retry.id)
      } else {
        // 更新重试计数
        await supabase
          .from("subscription_payment_retries")
          .update({
            retry_count: retry.retry_count + 1,
            retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 下次重试
            last_error: result.error,
          })
          .eq("id", retry.id)
      }
    }

    return { processed: retries.length, successful }
  }
}

// Export singleton
export const subscriptionExecutorService = new SubscriptionExecutorService()
