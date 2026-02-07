/**
 * Unified Yield Service
 *
 * 统一收益聚合服务 - 自动路由到 Aave (EVM) 或 JustLend (TRON)
 *
 * 功能:
 * - 自动检测网络类型 (EVM vs TRON)
 * - 路由到对应的收益协议
 * - 统一的 API 接口
 * - 跨网络余额聚合
 */

import { yieldAggregatorService, YieldNetwork } from './yield-aggregator.service'
import { tronYieldService, tronYieldServiceNile, TronNetwork } from './tron-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import type { ethers } from 'ethers'

/**
 * 支持的所有网络
 */
export type AllNetworks = YieldNetwork | TronNetwork

/**
 * 统一的余额信息
 */
export interface UnifiedYieldBalance {
  merchant: string
  network: AllNetworks
  networkType: 'EVM' | 'TRON'
  principal: string
  interest: string
  totalBalance: string
  apy: number
  protocol: 'Aave V3' | 'JustLend'
}

/**
 * 跨网络余额汇总
 */
export interface CrossNetworkSummary {
  merchant: string
  totalPrincipal: string
  totalInterest: string
  totalBalance: string
  averageAPY: number
  balances: UnifiedYieldBalance[]
}

/**
 * Unified Yield Service
 */
export class UnifiedYieldService {
  /**
   * 检测网络类型
   */
  private getNetworkType(network: AllNetworks): 'EVM' | 'TRON' {
    return network.startsWith('tron') ? 'TRON' : 'EVM'
  }

  /**
   * 存款 (自动路由)
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @param amount - 金额
   * @param signer - 签名器 (EVM 需要, TRON 使用 window.tronWeb)
   * @returns 交易哈希
   */
  async deposit(
    network: AllNetworks,
    merchant: string,
    amount: string,
    signer?: ethers.Signer
  ): Promise<string> {
    const networkType = this.getNetworkType(network)

    logger.info('Unified yield deposit', {
      component: 'unified-yield',
      network,
      action: 'deposit',
      metadata: { merchant, amount, networkType }
    })

    if (networkType === 'EVM') {
      if (!signer) {
        throw new Error('Signer required for EVM networks')
      }
      return await yieldAggregatorService.deposit(
        network as YieldNetwork,
        merchant,
        amount,
        signer
      )
    } else {
      // TRON
      const service = network === 'tron' ? tronYieldService : tronYieldServiceNile
      return await service.deposit(merchant, amount)
    }
  }

  /**
   * 提现 (自动路由)
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @param amount - 金额 (0 = 全部)
   * @param signer - 签名器 (EVM 需要)
   * @returns 交易哈希
   */
  async withdraw(
    network: AllNetworks,
    merchant: string,
    amount: string,
    signer?: ethers.Signer
  ): Promise<string> {
    const networkType = this.getNetworkType(network)

    logger.info('Unified yield withdrawal', {
      component: 'unified-yield',
      network,
      action: 'withdraw',
      metadata: { merchant, amount, networkType }
    })

    if (networkType === 'EVM') {
      if (!signer) {
        throw new Error('Signer required for EVM networks')
      }
      return await yieldAggregatorService.withdraw(
        network as YieldNetwork,
        merchant,
        amount,
        signer
      )
    } else {
      // TRON
      const service = network === 'tron' ? tronYieldService : tronYieldServiceNile
      return await service.withdraw(merchant, amount)
    }
  }

  /**
   * 查询余额 (自动路由)
   *
   * @param network - 网络
   * @param merchant - 商户地址
   * @returns 余额信息
   */
  async getBalance(
    network: AllNetworks,
    merchant: string
  ): Promise<UnifiedYieldBalance> {
    const networkType = this.getNetworkType(network)

    if (networkType === 'EVM') {
      const balance = await yieldAggregatorService.getMerchantBalance(
        network as YieldNetwork,
        merchant
      )

      return {
        merchant: balance.merchant,
        network: balance.network,
        networkType: 'EVM',
        principal: balance.principal,
        interest: balance.interest,
        totalBalance: balance.totalBalance,
        apy: balance.apy,
        protocol: 'Aave V3'
      }
    } else {
      // TRON
      const service = network === 'tron' ? tronYieldService : tronYieldServiceNile
      const balance = await service.getMerchantBalance(merchant)

      return {
        merchant: balance.merchant,
        network: balance.network,
        networkType: 'TRON',
        principal: balance.principal,
        interest: balance.interest,
        totalBalance: balance.totalBalance,
        apy: balance.apy,
        protocol: 'JustLend'
      }
    }
  }

  /**
   * 查询跨网络余额汇总
   *
   * @param merchant - 商户地址
   * @param networks - 要查询的网络列表 (默认全部)
   * @returns 跨网络汇总
   */
  async getCrossNetworkSummary(
    merchant: string,
    networks: AllNetworks[] = ['ethereum', 'base', 'arbitrum', 'tron']
  ): Promise<CrossNetworkSummary> {
    logger.info('Fetching cross-network yield summary', {
      component: 'unified-yield',
      action: 'get_summary',
      metadata: { merchant, networks }
    })

    try {
      // 并行查询所有网络
      const balances = await Promise.all(
        networks.map(async (network) => {
          try {
            return await this.getBalance(network, merchant)
          } catch (error) {
            logger.warn(`Failed to fetch balance for ${network}`, {
              component: 'unified-yield',
              network,
              metadata: { merchant, error: String(error) }
            })
            return null
          }
        })
      )

      // 过滤掉失败的查询
      const validBalances = balances.filter((b): b is UnifiedYieldBalance => b !== null)

      // 计算汇总
      const totalPrincipal = validBalances.reduce(
        (sum, b) => sum + parseFloat(b.principal),
        0
      )
      const totalInterest = validBalances.reduce(
        (sum, b) => sum + parseFloat(b.interest),
        0
      )
      const totalBalance = validBalances.reduce(
        (sum, b) => sum + parseFloat(b.totalBalance),
        0
      )

      // 加权平均 APY (按本金权重)
      const averageAPY = totalPrincipal > 0
        ? validBalances.reduce(
            (sum, b) => sum + b.apy * parseFloat(b.principal),
            0
          ) / totalPrincipal
        : 0

      return {
        merchant,
        totalPrincipal: totalPrincipal.toFixed(6),
        totalInterest: totalInterest.toFixed(6),
        totalBalance: totalBalance.toFixed(6),
        averageAPY: parseFloat(averageAPY.toFixed(2)),
        balances: validBalances
      }
    } catch (error) {
      logger.error('Failed to fetch cross-network summary', error instanceof Error ? error : new Error(String(error)), {
        component: 'unified-yield',
        action: 'get_summary',
        metadata: { merchant }
      })
      throw error
    }
  }

  /**
   * 获取支持的网络列表
   *
   * @returns 网络列表及协议信息
   */
  getSupportedNetworks() {
    return [
      {
        network: 'ethereum' as const,
        type: 'EVM',
        protocol: 'Aave V3',
        chainId: 1,
        name: 'Ethereum Mainnet'
      },
      {
        network: 'base' as const,
        type: 'EVM',
        protocol: 'Aave V3',
        chainId: 8453,
        name: 'Base'
      },
      {
        network: 'arbitrum' as const,
        type: 'EVM',
        protocol: 'Aave V3',
        chainId: 42161,
        name: 'Arbitrum One'
      },
      {
        network: 'tron' as const,
        type: 'TRON',
        protocol: 'JustLend',
        chainId: null,
        name: 'TRON Mainnet'
      },
      {
        network: 'tron-nile' as const,
        type: 'TRON',
        protocol: 'JustLend',
        chainId: null,
        name: 'TRON Nile Testnet'
      }
    ]
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
    network: AllNetworks
  ): Promise<void> {
    const networkType = this.getNetworkType(network)

    logger.info('Unified auto-deposit hook triggered', {
      component: 'unified-yield',
      network,
      action: 'auto_deposit',
      orderId,
      metadata: { merchantId, amount, networkType }
    })

    if (networkType === 'EVM') {
      await yieldAggregatorService.autoDepositHook(
        orderId,
        merchantId,
        amount,
        network as YieldNetwork
      )
    } else {
      const service = network === 'tron' ? tronYieldService : tronYieldServiceNile
      await service.autoDepositHook(orderId, merchantId, amount)
    }
  }

  /**
   * 获取最优收益网络
   *
   * 根据当前 APY 推荐商户存入哪个网络
   *
   * @returns 推荐网络和 APY
   */
  async getBestYieldNetwork(): Promise<{
    network: AllNetworks
    protocol: string
    apy: number
    reason: string
  }> {
    try {
      // 查询各网络的 APY
      const networks: AllNetworks[] = ['ethereum', 'base', 'arbitrum', 'tron']
      const apys = await Promise.all(
        networks.map(async (network) => {
          try {
            const networkType = this.getNetworkType(network)

            if (networkType === 'EVM') {
              const stats = await yieldAggregatorService.getContractStats(network as YieldNetwork)
              return { network, apy: 0, protocol: 'Aave V3' } // APY not directly available from stats
            } else {
              const service = network === 'tron' ? tronYieldService : tronYieldServiceNile
              const apy = await service.getCurrentAPY()
              return { network, apy, protocol: 'JustLend' }
            }
          } catch (error) {
            return { network, apy: 0, protocol: 'Unknown' }
          }
        })
      )

      // 找到最高 APY
      const best = apys.reduce((max, current) =>
        current.apy > max.apy ? current : max
      )

      return {
        network: best.network,
        protocol: best.protocol,
        apy: best.apy,
        reason: `Highest APY: ${best.apy.toFixed(2)}%`
      }
    } catch (error) {
      logger.error('Failed to find best yield network', error instanceof Error ? error : new Error(String(error)), {
        component: 'unified-yield',
        action: 'get_best_network'
      })
      throw error
    }
  }
}

// 导出单例实例
export const unifiedYieldService = new UnifiedYieldService()
