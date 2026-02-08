/**
 * Yield Aggregator Service
 *
 * Aave V3 集成服务 - 商户闲置资金自动生息
 *
 * 功能:
 * - 商户充值 USDT 自动存入 Aave V3
 * - 实时查询收益余额和 APY
 * - 商户提现连本带息
 * - 支持多网络 (Ethereum, Base, Arbitrum)
 *
 * 自动触发策略:
 * - 订单确认后，自动将待结算资金存入生息
 * - 商户发起结算时，自动从 Aave 提取资金
 */

import { ethers } from 'ethers'
import { logger } from '@/lib/logger/structured-logger'
import { prisma } from '@/lib/prisma'

// 导入合约 ABI
import MerchantYieldManagerABI from './abis/MerchantYieldManager.json'
import aaveAddresses from './aave-addresses.json'

/**
 * 网络类型
 */
export type YieldNetwork = 'ethereum' | 'base' | 'arbitrum'

/**
 * 部署信息
 */
interface DeploymentInfo {
  network: string
  chainId: number
  contractAddress: string
  aavePool: string
  usdt: string
  aUsdt: string
  feeCollector: string
}

/**
 * 商户余额信息
 */
export interface MerchantYieldBalance {
  merchant: string
  network: YieldNetwork
  principal: string          // 本金 (USDT)
  interest: string           // 利息 (USDT)
  totalBalance: string       // 总余额 (USDT)
  apy: number                // 年化收益率 (%)
  lastOperationTime: Date    // 最后操作时间
}

/**
 * 存款记录
 */
export interface DepositRecord {
  id: string
  merchant: string
  network: YieldNetwork
  amount: string
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  createdAt: Date
}

/**
 * 提现记录
 */
export interface WithdrawalRecord {
  id: string
  merchant: string
  network: YieldNetwork
  principal: string
  interest: string
  platformFee: string
  netAmount: string
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  createdAt: Date
}

/**
 * Yield Aggregator Service
 */
export class YieldAggregatorService {
  private contracts: Map<YieldNetwork, ethers.Contract> = new Map()
  private providers: Map<YieldNetwork, ethers.Provider> = new Map()

  constructor() {
    // 初始化各网络的 provider 和 contract 实例
    this.initializeNetworks()
  }

  /**
   * 初始化网络连接
   */
  private initializeNetworks() {
    const networks: YieldNetwork[] = ['ethereum', 'base', 'arbitrum']

    networks.forEach((network) => {
      try {
        // 获取 RPC URL 和部署地址
        const rpcUrl = this.getRpcUrl(network)
        const deployment = this.getDeployment(network)

        if (!deployment) {
          logger.warn(`No deployment found for ${network}`, {
            component: 'yield-aggregator',
            network
          })
          return
        }

        // 创建 provider
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        this.providers.set(network, provider)

        // 创建 contract 实例 (只读)
        const contract = new ethers.Contract(
          deployment.contractAddress,
          MerchantYieldManagerABI,
          provider
        )
        this.contracts.set(network, contract)

        logger.info(`Initialized yield aggregator for ${network}`, {
          component: 'yield-aggregator',
          network,
          metadata: { contractAddress: deployment.contractAddress }
        })
      } catch (error) {
        logger.error(`Failed to initialize ${network}`, error instanceof Error ? error : new Error(String(error)), {
          component: 'yield-aggregator',
          network
        })
      }
    })
  }

  /**
   * 获取 RPC URL
   */
  private getRpcUrl(network: YieldNetwork): string {
    const rpcUrls: Record<YieldNetwork, string> = {
      ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
    }

    return rpcUrls[network]
  }

  /**
   * 获取部署信息
   */
  private getDeployment(network: YieldNetwork): DeploymentInfo | null {
    try {
      const fs = require('fs')
      const path = require('path')

      const deploymentFile = path.join(
        __dirname,
        '../../../contracts/yield/deployments',
        `${network}.json`
      )

      if (!fs.existsSync(deploymentFile)) {
        return null
      }

      return JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'))
    } catch (error) {
      logger.error(`Failed to load deployment for ${network}`, error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        network
      })
      return null
    }
  }

  /**
   * 商户存款 (需要钱包签名)
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @param amount - 存款金额 (USDT, 6 decimals)
   * @param signer - ethers Signer (钱包)
   * @returns 交易哈希
   */
  async deposit(
    network: YieldNetwork,
    merchant: string,
    amount: string,
    signer: ethers.Signer
  ): Promise<string> {
    const contract = this.contracts.get(network)
    if (!contract) {
      throw new Error(`Contract not initialized for ${network}`)
    }

    logger.info('Initiating yield deposit', {
      component: 'yield-aggregator',
      network,
      action: 'deposit',
      metadata: { merchant, amount }
    })

    try {
      // 连接 signer
      const contractWithSigner = contract.connect(signer)

      // 1. 先授权 USDT
      const deployment = this.getDeployment(network)
      if (!deployment) {
        throw new Error(`Deployment not found for ${network}`)
      }

      const usdtContract = new ethers.Contract(
        deployment.usdt,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer
      )

      const amountWei = ethers.parseUnits(amount, 6) // USDT has 6 decimals

      logger.info('Approving USDT', {
        component: 'yield-aggregator',
        network,
        action: 'approve',
        metadata: { spender: deployment.contractAddress, amount }
      })

      const approveTx = await (usdtContract as any).approve(deployment.contractAddress, amountWei)
      await approveTx.wait()

      // 2. 执行存款
      const depositTx = await (contractWithSigner as any).deposit(amountWei)
      const receipt = await depositTx.wait()

      const txHash = receipt.hash

      logger.info('Yield deposit successful', {
        component: 'yield-aggregator',
        network,
        action: 'deposit',
        txHash,
        metadata: { merchant, amount }
      })

      // 3. 记录到数据库
      await prisma.yieldDeposit.create({
        data: {
          id: txHash,
          merchant_id: merchant,
          amount: parseFloat(amount),
          token: 'USDT',
          principal: parseFloat(amount),
          interest: 0,
          apy: 0,
          status: 'active',
          tx_hash: txHash,
          deposited_at: new Date()
        }
      })

      return txHash
    } catch (error) {
      logger.error('Yield deposit failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        network,
        action: 'deposit',
        metadata: { merchant, amount }
      })
      throw error
    }
  }

  /**
   * 商户提现
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @param amount - 提现金额 (0 = 全部提现)
   * @param signer - ethers Signer (钱包)
   * @returns 交易哈希
   */
  async withdraw(
    network: YieldNetwork,
    merchant: string,
    amount: string,
    signer: ethers.Signer
  ): Promise<string> {
    const contract = this.contracts.get(network)
    if (!contract) {
      throw new Error(`Contract not initialized for ${network}`)
    }

    logger.info('Initiating yield withdrawal', {
      component: 'yield-aggregator',
      network,
      action: 'withdraw',
      metadata: { merchant, amount }
    })

    try {
      const contractWithSigner = contract.connect(signer)
      const amountWei = amount === '0' ? 0 : ethers.parseUnits(amount, 6)

      const withdrawTx = await (contractWithSigner as any).withdraw(amountWei)
      const receipt = await withdrawTx.wait()

      const txHash = receipt.hash

      logger.info('Yield withdrawal successful', {
        component: 'yield-aggregator',
        network,
        action: 'withdraw',
        txHash,
        metadata: { merchant, amount }
      })

      // 更新数据库记录
      await prisma.yieldDeposit.updateMany({
        where: {
          merchant_id: merchant,
          status: 'active'
        },
        data: {
          status: 'withdrawn',
          withdrawn_at: new Date()
        }
      })

      return txHash
    } catch (error) {
      logger.error('Yield withdrawal failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        network,
        action: 'withdraw',
        metadata: { merchant, amount }
      })
      throw error
    }
  }

  /**
   * 查询商户余额
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @returns 余额信息
   */
  async getMerchantBalance(
    network: YieldNetwork,
    merchant: string
  ): Promise<MerchantYieldBalance> {
    const contract = this.contracts.get(network)
    if (!contract) {
      throw new Error(`Contract not initialized for ${network}`)
    }

    try {
      const [principal, balance, interest, apy, lastOpTime] = await Promise.all([
        contract.merchantPrincipal(merchant),
        contract.getMerchantBalance(merchant),
        contract.getMerchantInterest(merchant),
        contract.getMerchantAPY(merchant),
        contract.lastOperationTime(merchant)
      ])

      return {
        merchant,
        network,
        principal: ethers.formatUnits(principal, 6),
        interest: ethers.formatUnits(interest, 6),
        totalBalance: ethers.formatUnits(balance, 6),
        apy: Number(apy) / 100, // 转换为百分比
        lastOperationTime: new Date(Number(lastOpTime) * 1000)
      }
    } catch (error) {
      logger.error('Failed to fetch merchant balance', error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        network,
        action: 'get_balance',
        metadata: { merchant }
      })
      throw error
    }
  }

  /**
   * 获取合约统计信息
   *
   * @param network - 网络
   * @returns 统计信息
   */
  async getContractStats(network: YieldNetwork) {
    const contract = this.contracts.get(network)
    if (!contract) {
      throw new Error(`Contract not initialized for ${network}`)
    }

    try {
      const [totalBalance, totalInterest, totalDeposits, totalWithdrawals, platformFeeRate] =
        await Promise.all([
          contract.getTotalBalance(),
          contract.getTotalInterest(),
          contract.totalDeposits(),
          contract.totalWithdrawals(),
          contract.platformFeeRate()
        ])

      return {
        network,
        totalBalance: ethers.formatUnits(totalBalance, 6),
        totalInterest: ethers.formatUnits(totalInterest, 6),
        totalDeposits: ethers.formatUnits(totalDeposits, 6),
        totalWithdrawals: ethers.formatUnits(totalWithdrawals, 6),
        platformFeeRate: Number(platformFeeRate) / 100, // 转换为百分比
        netDeposits: ethers.formatUnits(totalDeposits - totalWithdrawals, 6)
      }
    } catch (error) {
      logger.error('Failed to fetch contract stats', error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        network,
        action: 'get_stats'
      })
      throw error
    }
  }

  /**
   * 自动存款钩子 (订单确认后调用)
   *
   * @param orderId - 订单 ID
   * @param merchantId - 商户 ID
   * @param amount - 金额
   * @param network - 网络
   */
  async autoDepositHook(
    orderId: string,
    merchantId: string,
    amount: string,
    network: YieldNetwork
  ): Promise<void> {
    // 检查是否启用自动生息
    const autoYieldEnabled = process.env.ENABLE_AUTO_YIELD === 'true'
    if (!autoYieldEnabled) {
      logger.debug('Auto-yield disabled, skipping', {
        component: 'yield-aggregator',
        action: 'auto_deposit',
        orderId
      })
      return
    }

    // 检查金额是否达到最小阈值
    const minAmount = parseFloat(process.env.AUTO_YIELD_MIN_AMOUNT || '100')
    if (parseFloat(amount) < minAmount) {
      logger.debug('Amount below threshold, skipping auto-deposit', {
        component: 'yield-aggregator',
        action: 'auto_deposit',
        orderId,
        metadata: { amount, minAmount }
      })
      return
    }

    logger.info('EVM auto-deposit triggered', {
      component: 'yield-aggregator',
      action: 'auto_deposit',
      orderId,
      network,
      metadata: { merchantId, amount }
    })

    try {
      // 记录自动存款意图到数据库
      await prisma.yieldDeposit.create({
        data: {
          merchant_id: merchantId,
          amount: parseFloat(amount),
          token: 'USDT',
          principal: parseFloat(amount),
          interest: 0,
          apy: 0,
          status: 'active',
          tx_hash: `auto:${orderId}`,
          deposited_at: new Date()
        }
      })

      logger.info('EVM auto-deposit intent recorded', {
        component: 'yield-aggregator',
        action: 'auto_deposit_recorded',
        orderId,
        network,
        metadata: { merchantId, amount }
      })

      // NOTE: Actual on-chain call requires merchant-signed ERC-3009 transferWithAuthorization.
      // The payout-engine gRPC service handles execution when the merchant has an active
      // session key. This service records intent; on-chain execution is deferred.
    } catch (error) {
      logger.error('EVM auto-deposit hook failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'yield-aggregator',
        action: 'auto_deposit',
        orderId,
        network,
        metadata: { merchantId, amount }
      })
      // Don't throw - auto-deposit failure should not block payment confirmation
    }
  }
}

// 导出单例实例
export const yieldAggregatorService = new YieldAggregatorService()
