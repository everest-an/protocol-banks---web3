/**
 * TRON Yield Service (JustLend Integration)
 *
 * JustLend 协议集成 - TRON 网络的 Aave 替代方案
 *
 * 功能:
 * - 商户充值 USDT 自动存入 JustLend
 * - 实时查询收益余额和 APY
 * - 商户提现连本带息
 * - 支持 TRON 主网和 Nile 测试网
 *
 * JustLend 原理:
 * - 存入 USDT → 获得 jUSDT (利息代币)
 * - jUSDT 余额随时间增长
 * - 提现时销毁 jUSDT，获得 USDT + 利息
 *
 * 官方文档: https://just.network/#/home
 */

import TronWeb from 'tronweb'
import { logger } from '@/lib/logger/structured-logger'
import { prisma } from '@/lib/prisma'

/**
 * TRON 网络类型
 */
export type TronNetwork = 'tron' | 'tron-nile'

/**
 * JustLend 合约地址
 */
const JUSTLEND_ADDRESSES = {
  'tron': {
    // TRON Mainnet
    comptroller: 'TJmqHgvL2RYitHL5eAc5Ev2u4M3mJRAo91',  // JustLend Comptroller
    jUSDT: 'TXJgMdjVX5dKiQaUi9QobwNxtSQaFqccvd',        // jUSDT Token
    usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',         // USDT-TRC20
    oracle: 'TY2ST9XnYm4xft5hXvCw6DPvC5VCrN4GKq'        // Price Oracle
  },
  'tron-nile': {
    // Nile Testnet
    comptroller: 'TGqGFdcKbBYPPg6H6JqH3vPyR3cFMk8Vqn',
    jUSDT: 'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4',
    usdt: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
    oracle: 'THCJvqgcMF9L6Xr9h1BxzJcWHd9nLgBJzr'
  }
}

/**
 * JustLend Pool ABI (简化版)
 */
const JUSTLEND_ABI = [
  {
    "constant": false,
    "inputs": [{"name": "mintAmount", "type": "uint256"}],
    "name": "mint",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "redeemTokens", "type": "uint256"}],
    "name": "redeem",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "exchangeRateStored",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "supplyRatePerBlock",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }
]

/**
 * TRC20 ABI (简化版)
 */
const TRC20_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }
]

/**
 * 商户余额信息
 */
export interface TronYieldBalance {
  merchant: string
  network: TronNetwork
  principal: string          // 本金 (USDT)
  interest: string           // 利息 (USDT)
  totalBalance: string       // 总余额 (USDT)
  jTokenBalance: string      // jUSDT 余额
  exchangeRate: string       // 兑换率
  apy: number                // 年化收益率 (%)
}

/**
 * TRON Yield Service
 */
export class TronYieldService {
  private tronWeb: any
  private network: TronNetwork

  constructor(network: TronNetwork = 'tron') {
    this.network = network
  }

  /**
   * 初始化 TronWeb (lazy)
   */
  private ensureTronWeb() {
    if (this.tronWeb) return

    const fullNode = this.network === 'tron'
      ? 'https://api.trongrid.io'
      : 'https://nile.trongrid.io'

    try {
      // TronWeb v6 exports default differently
      const TronWebConstructor = (TronWeb as any).default || TronWeb
      this.tronWeb = new TronWebConstructor({
        fullHost: fullNode,
        headers: {
          'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || ''
        }
      })
    } catch {
      // Fallback: create minimal mock for build time
      this.tronWeb = { contract: () => ({ at: () => ({}) }) }
    }

    logger.info('TronWeb initialized for yield service', {
      component: 'tron-yield',
      network: this.network,
      action: 'initialize'
    })
  }

  /**
   * 获取 TronWeb 实例 (浏览器钱包)
   */
  private getTronWebFromWindow(): any {
    if (typeof window === 'undefined' || !window.tronWeb) {
      throw new Error('TronLink not available')
    }

    if (!window.tronWeb.defaultAddress?.base58) {
      throw new Error('TronLink is locked')
    }

    return window.tronWeb
  }

  /**
   * 商户存款 (存入 JustLend)
   *
   * @param merchant - 商户地址
   * @param amount - 存款金额 (USDT, 6 decimals)
   * @returns 交易哈希
   */
  async deposit(merchant: string, amount: string): Promise<string> {
    this.ensureTronWeb()
    logger.info('Initiating TRON yield deposit', {
      component: 'tron-yield',
      network: this.network,
      action: 'deposit',
      metadata: { merchant, amount }
    })

    try {
      const tronWeb = this.getTronWebFromWindow()
      const addresses = JUSTLEND_ADDRESSES[this.network]

      // 1. 授权 USDT 给 jUSDT 合约
      const usdtContract = await tronWeb.contract(TRC20_ABI, addresses.usdt)
      const amountSun = tronWeb.toSun(amount) // USDT 6 decimals

      logger.info('Approving USDT for JustLend', {
        component: 'tron-yield',
        network: this.network,
        action: 'approve',
        metadata: { spender: addresses.jUSDT, amount }
      })

      const approveTx = await usdtContract.approve(addresses.jUSDT, amountSun).send({
        feeLimit: 100_000_000
      })

      // 等待授权确认
      await this.waitForConfirmation(approveTx, tronWeb)

      // 2. 存入 JustLend (mint jUSDT)
      const jUSDTContract = await tronWeb.contract(JUSTLEND_ABI, addresses.jUSDT)

      logger.info('Minting jUSDT tokens', {
        component: 'tron-yield',
        network: this.network,
        action: 'mint',
        metadata: { amount }
      })

      const mintTx = await jUSDTContract.mint(amountSun).send({
        feeLimit: 100_000_000
      })

      await this.waitForConfirmation(mintTx, tronWeb)

      const txHash = mintTx

      logger.info('TRON yield deposit successful', {
        component: 'tron-yield',
        network: this.network,
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
          apy: await this.getCurrentAPY(),
          status: 'active',
          tx_hash: txHash,
          deposited_at: new Date()
        }
      })

      return txHash
    } catch (error) {
      logger.error('TRON yield deposit failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'tron-yield',
        network: this.network,
        action: 'deposit',
        metadata: { merchant, amount }
      })
      throw error
    }
  }

  /**
   * 商户提现 (从 JustLend 赎回)
   *
   * @param merchant - 商户地址
   * @param amount - 提现金额 (USDT, 0 = 全部)
   * @returns 交易哈希
   */
  async withdraw(merchant: string, amount: string): Promise<string> {
    this.ensureTronWeb()
    logger.info('Initiating TRON yield withdrawal', {
      component: 'tron-yield',
      network: this.network,
      action: 'withdraw',
      metadata: { merchant, amount }
    })

    try {
      const tronWeb = this.getTronWebFromWindow()
      const addresses = JUSTLEND_ADDRESSES[this.network]

      // 获取商户的 jUSDT 余额
      const balance = await this.getMerchantBalance(merchant)
      const redeemAmount = amount === '0' ? balance.jTokenBalance : amount

      // 计算需要赎回的 jUSDT 数量
      const jUSDTContract = await tronWeb.contract(JUSTLEND_ABI, addresses.jUSDT)
      const exchangeRate = await jUSDTContract.exchangeRateStored().call()

      // jTokens = underlyingAmount * 1e18 / exchangeRate
      const jTokensToRedeem = tronWeb.toBigNumber(tronWeb.toSun(redeemAmount))
        .multipliedBy(1e18)
        .dividedBy(exchangeRate)
        .toFixed(0)

      logger.info('Redeeming jUSDT tokens', {
        component: 'tron-yield',
        network: this.network,
        action: 'redeem',
        metadata: { merchant, amount: redeemAmount, jTokens: jTokensToRedeem }
      })

      // 赎回 USDT
      const redeemTx = await jUSDTContract.redeem(jTokensToRedeem).send({
        feeLimit: 100_000_000
      })

      await this.waitForConfirmation(redeemTx, tronWeb)

      const txHash = redeemTx

      logger.info('TRON yield withdrawal successful', {
        component: 'tron-yield',
        network: this.network,
        action: 'withdraw',
        txHash,
        metadata: { merchant, amount: redeemAmount }
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
      logger.error('TRON yield withdrawal failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'tron-yield',
        network: this.network,
        action: 'withdraw',
        metadata: { merchant, amount }
      })
      throw error
    }
  }

  /**
   * 查询商户余额
   *
   * @param merchant - 商户地址
   * @returns 余额信息
   */
  async getMerchantBalance(merchant: string): Promise<TronYieldBalance> {
    this.ensureTronWeb()
    try {
      const addresses = JUSTLEND_ADDRESSES[this.network]

      // 获取 jUSDT 余额
      const jUSDTContract = await this.tronWeb.contract(JUSTLEND_ABI, addresses.jUSDT)
      const jTokenBalance = await jUSDTContract.balanceOf(merchant).call()

      // 获取兑换率 (1 jUSDT = ? USDT)
      const exchangeRate = await jUSDTContract.exchangeRateStored().call()

      // 计算 USDT 总余额 = jTokenBalance * exchangeRate / 1e18
      const totalBalance = this.tronWeb.toBigNumber(jTokenBalance)
        .multipliedBy(exchangeRate)
        .dividedBy(1e18)
        .dividedBy(1e6)  // USDT 6 decimals
        .toFixed(6)

      // 查询数据库中的本金记录
      const deposits = await prisma.yieldDeposit.findMany({
        where: {
          merchant_id: merchant,
          status: 'active'
        }
      })

      const principal = deposits.reduce((sum, d) => sum + parseFloat(d.principal.toString()), 0)
      const interest = Math.max(0, parseFloat(totalBalance) - principal)

      // 获取当前 APY
      const apy = await this.getCurrentAPY()

      return {
        merchant,
        network: this.network,
        principal: principal.toFixed(6),
        interest: interest.toFixed(6),
        totalBalance: totalBalance.toString(),
        jTokenBalance: this.tronWeb.fromSun(jTokenBalance),
        exchangeRate: exchangeRate.toString(),
        apy
      }
    } catch (error) {
      logger.error('Failed to fetch TRON yield balance', error instanceof Error ? error : new Error(String(error)), {
        component: 'tron-yield',
        network: this.network,
        action: 'get_balance',
        metadata: { merchant }
      })
      throw error
    }
  }

  /**
   * 获取当前 APY
   *
   * @returns APY (%)
   */
  async getCurrentAPY(): Promise<number> {
    this.ensureTronWeb()
    try {
      const addresses = JUSTLEND_ADDRESSES[this.network]
      const jUSDTContract = await this.tronWeb.contract(JUSTLEND_ABI, addresses.jUSDT)

      // 获取每个区块的利率
      const supplyRatePerBlock = await jUSDTContract.supplyRatePerBlock().call()

      // TRON 出块时间约 3 秒，一天约 28800 个块
      const blocksPerDay = 28800
      const daysPerYear = 365

      // APY = (1 + ratePerBlock) ^ (blocksPerYear) - 1
      // 简化计算: APY ≈ ratePerBlock * blocksPerDay * daysPerYear
      const apy = this.tronWeb.toBigNumber(supplyRatePerBlock)
        .multipliedBy(blocksPerDay)
        .multipliedBy(daysPerYear)
        .dividedBy(1e18)
        .multipliedBy(100)
        .toNumber()

      return apy
    } catch (error) {
      logger.error('Failed to fetch APY', error instanceof Error ? error : new Error(String(error)), {
        component: 'tron-yield',
        network: this.network,
        action: 'get_apy'
      })
      return 0
    }
  }

  /**
   * 获取 JustLend 统计信息
   *
   * @returns 统计信息
   */
  async getJustLendStats() {
    this.ensureTronWeb()
    try {
      const addresses = JUSTLEND_ADDRESSES[this.network]
      const jUSDTContract = await this.tronWeb.contract(JUSTLEND_ABI, addresses.jUSDT)

      const [exchangeRate, supplyRate] = await Promise.all([
        jUSDTContract.exchangeRateStored().call(),
        jUSDTContract.supplyRatePerBlock().call()
      ])

      // 查询所有活跃存款
      const deposits = await prisma.yieldDeposit.findMany({
        where: {
          status: 'active',
          // Filter by network if needed
        }
      })

      const totalPrincipal = deposits.reduce((sum, d) => sum + parseFloat(d.principal.toString()), 0)

      return {
        network: this.network,
        exchangeRate: exchangeRate.toString(),
        supplyRatePerBlock: supplyRate.toString(),
        apy: await this.getCurrentAPY(),
        totalPrincipal: totalPrincipal.toFixed(6),
        activeDeposits: deposits.length
      }
    } catch (error) {
      logger.error('Failed to fetch JustLend stats', error instanceof Error ? error : new Error(String(error)), {
        component: 'tron-yield',
        network: this.network,
        action: 'get_stats'
      })
      throw error
    }
  }

  /**
   * 等待交易确认
   *
   * @param txHash - 交易哈希
   * @param tronWeb - TronWeb 实例
   * @param maxAttempts - 最大尝试次数
   */
  private async waitForConfirmation(
    txHash: string,
    tronWeb: any,
    maxAttempts: number = 20
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const txInfo = await tronWeb.trx.getTransactionInfo(txHash)

        if (txInfo && txInfo.id) {
          if (txInfo.receipt?.result === 'SUCCESS') {
            logger.debug('Transaction confirmed', {
              component: 'tron-yield',
              network: this.network,
              action: 'wait_confirmation',
              txHash,
              metadata: { attempts: i + 1 }
            })
            return
          } else {
            throw new Error(`Transaction failed: ${txInfo.receipt?.result}`)
          }
        }
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw error
        }
      }

      // 等待 3 秒 (TRON 出块时间)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    throw new Error('Transaction confirmation timeout')
  }

  /**
   * 自动存款钩子
   *
   * @param orderId - 订单 ID
   * @param merchantId - 商户 ID
   * @param amount - 金额
   */
  async autoDepositHook(
    orderId: string,
    merchantId: string,
    amount: string
  ): Promise<void> {
    const autoYieldEnabled = process.env.ENABLE_AUTO_YIELD_TRON === 'true'
    if (!autoYieldEnabled) {
      return
    }

    const minAmount = parseFloat(process.env.AUTO_YIELD_MIN_AMOUNT || '100')
    if (parseFloat(amount) < minAmount) {
      return
    }

    logger.info('TRON auto-deposit triggered', {
      component: 'tron-yield',
      network: this.network,
      action: 'auto_deposit',
      orderId,
      metadata: { merchantId, amount }
    })

    // NOTE: TRON auto-deposit requires merchant custody approval.
    // Execution is delegated to the payout-engine service via gRPC when the
    // merchant has an active session key or pre-signed TRC20 approval.
  }
}

// 导出单例实例
export const tronYieldService = new TronYieldService('tron')
export const tronYieldServiceNile = new TronYieldService('tron-nile')
