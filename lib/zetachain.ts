/**
 * ZetaChain Omnichain Integration for Protocol Banks
 *
 * 提供全链资产管理、跨链 Swap、BTC 原生支持等功能
 * 参考: https://www.zetachain.com/docs
 */

// ZetaChain 网络配置
export const ZETACHAIN_CONFIG = {
  mainnet: {
    chainId: 7000,
    rpcUrl: "https://zetachain-evm.blockpi.network/v1/rpc/public",
    explorerUrl: "https://explorer.zetachain.com",
    gatewayAddress: "0x48B9C1A7B89f22D51BC7F8E8E3e4A1A5E2F6b7C8", // ZetaChain Gateway
  },
  testnet: {
    chainId: 7001,
    rpcUrl: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
    explorerUrl: "https://athens.explorer.zetachain.com",
    gatewayAddress: "0x6c533f7fe93fae114d0954697069df33c9b74fd7",
  },
}

// ZRC-20 代币地址 (ZetaChain 上的跨链代币标准)
export const ZRC20_TOKENS = {
  mainnet: {
    "ETH.ETH": "0xd97B1de3619ed2c6BEb3860147E30Ca8A7dC9891",
    "BTC.BTC": "0x13A0c5930C028511Dc02665E7285134B6d11A5f4",
    "BNB.BSC": "0x48f80608B672DC30DC7e3dbBd0343c5F02C738Eb",
    "USDC.ETH": "0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a",
    "USDT.ETH": "0x7c8dDa80bbBE1254a7aACf3219EBe1481c6E01d7",
    "USDC.BSC": "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
    "SOL.SOL": "0x1deAa9E49B9a5F6Df6d4bCac6f9735a2D0D8d69A",
  },
  testnet: {
    "ETH.ETH": "0x13A0c5930C028511Dc02665E7285134B6d11A5f4",
    "BTC.BTC": "0x65a45c57636f9BcCeD4fe193A602008578BcA90b",
    "BNB.BSC": "0xd97B1de3619ed2c6BEb3860147E30Ca8A7dC9891",
    "USDC.ETH": "0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a",
  },
}

// 支持的链
export const SUPPORTED_CHAINS = {
  1: { name: "Ethereum", symbol: "ETH", type: "evm" },
  56: { name: "BNB Chain", symbol: "BNB", type: "evm" },
  137: { name: "Polygon", symbol: "MATIC", type: "evm" },
  42161: { name: "Arbitrum", symbol: "ETH", type: "evm" },
  10: { name: "Optimism", symbol: "ETH", type: "evm" },
  8453: { name: "Base", symbol: "ETH", type: "evm" },
  177: { name: "HashKey Chain", symbol: "HSK", type: "evm" },
  7000: { name: "ZetaChain", symbol: "ZETA", type: "zeta" },
  // 非 EVM 链
  bitcoin: { name: "Bitcoin", symbol: "BTC", type: "utxo" },
  solana: { name: "Solana", symbol: "SOL", type: "solana" },
}

// 跨链交换接口
export interface CrossChainSwapParams {
  fromChain: number | string
  toChain: number | string
  fromToken: string
  toToken: string
  amount: string
  recipient: string
  slippage?: number // 默认 0.5%
}

// 跨链交换结果
export interface CrossChainSwapResult {
  success: boolean
  txHash?: string
  cctxHash?: string // ZetaChain 跨链交易哈希
  estimatedTime?: number // 预计完成时间（秒）
  error?: string
}

// 全链金库余额
export interface OmnichainBalance {
  chain: string
  chainId: number | string
  symbol: string
  balance: string
  balanceUSD: string
  zrc20Address?: string
}

/**
 * ZetaChain 全链服务
 */
export class ZetaChainService {
  private network: "mainnet" | "testnet"
  private config: typeof ZETACHAIN_CONFIG.mainnet

  constructor(network: "mainnet" | "testnet" = "mainnet") {
    this.network = network
    this.config = ZETACHAIN_CONFIG[network]
  }

  /**
   * 获取全链资产余额
   * 一个地址，管理所有链上的资产
   */
  async getOmnichainBalances(address: string): Promise<OmnichainBalance[]> {
    const balances: OmnichainBalance[] = []
    const tokens = ZRC20_TOKENS[this.network]

    // 获取 ZetaChain 上的 ZRC-20 余额
    for (const [tokenKey, zrc20Address] of Object.entries(tokens)) {
      try {
        const [symbol, chain] = tokenKey.split(".")

        // 调用 ZRC-20 balanceOf
        const balance = await this.getZRC20Balance(address, zrc20Address)
        const price = await this.getTokenPrice(symbol)

        balances.push({
          chain,
          chainId: this.getChainIdBySymbol(chain),
          symbol,
          balance,
          balanceUSD: (Number.parseFloat(balance) * price).toFixed(2),
          zrc20Address,
        })
      } catch (error) {
        console.error(`Failed to get balance for ${tokenKey}:`, error)
      }
    }

    return balances
  }

  /**
   * 获取 ZRC-20 代币余额
   */
  private async getZRC20Balance(address: string, zrc20Address: string): Promise<string> {
    try {
      const response = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: zrc20Address,
              data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf(address)
            },
            "latest",
          ],
          id: 1,
        }),
      })

      const result = await response.json()
      if (result.result && result.result !== "0x") {
        const balance = BigInt(result.result)
        return (Number(balance) / 1e18).toFixed(6)
      }
      return "0"
    } catch {
      return "0"
    }
  }

  /**
   * 跨链交换 - 支持任意链到任意链
   * 例如: ETH (Ethereum) -> BTC (Bitcoin)
   */
  async crossChainSwap(params: CrossChainSwapParams): Promise<CrossChainSwapResult> {
    const { fromChain, toChain, fromToken, toToken, amount, recipient, slippage = 0.5 } = params

    try {
      // 1. 获取报价
      const quote = await this.getSwapQuote(fromToken, toToken, amount)

      // 2. 检查滑点
      const minOutput = Number.parseFloat(quote.outputAmount) * (1 - slippage / 100)

      // 3. 构建跨链交易
      const swapData = this.encodeSwapData({
        targetChain: toChain,
        targetToken: toToken,
        recipient,
        minOutput: minOutput.toString(),
      })

      // DEFERRED: ZetaChain Gateway integration — requires contract deployment
      // Currently returns transaction parameters for the frontend to sign,
      // but actual on-chain execution requires Gateway ABI encoding
      return {
        success: false,
        error: "Cross-chain swap is not yet available. ZetaChain Gateway integration in progress.",
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Swap failed",
      }
    }
  }

  /**
   * 获取跨链 Swap 报价
   */
  async getSwapQuote(
    fromToken: string,
    toToken: string,
    amount: string,
  ): Promise<{
    inputAmount: string
    outputAmount: string
    rate: string
    priceImpact: string
    fee: string
    route: string[]
  }> {
    // DEFERRED: ZunoDex/Eddy Finance API integration for real swap quotes
    throw new Error(
      "Cross-chain swap quotes are not yet available. DEX API integration in progress."
    )
  }

  /**
   * 存入资产到 ZetaChain (从 EVM 链)
   * 将资产从源链存入 ZetaChain，获得 ZRC-20 代表
   */
  async depositFromEVM(params: {
    token: string // ERC-20 地址或 'native'
    amount: string
    receiver: string // ZetaChain 上的接收地址
  }): Promise<{ txData: string; to: string; value: string }> {
    const { token, amount, receiver } = params

    // 构建存款交易数据
    // 调用 Gateway 合约的 deposit 函数
    const gatewayABI = ["function deposit(address receiver, uint256 amount, address asset, bytes calldata message)"]

    // 编码调用数据
    const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

    if (token === "native") {
      // 原生代币存款
      return {
        to: this.config.gatewayAddress,
        value: amountWei.toString(),
        txData: this.encodeDepositNative(receiver),
      }
    } else {
      // ERC-20 存款
      return {
        to: this.config.gatewayAddress,
        value: "0",
        txData: this.encodeDepositERC20(receiver, token, amountWei.toString()),
      }
    }
  }

  /**
   * 从 ZetaChain 提取资产到目标链
   */
  async withdrawToChain(params: {
    zrc20: string // ZRC-20 地址
    amount: string
    receiver: string // 目标链上的接收地址
    targetChain: number | string
  }): Promise<{ txData: string; to: string }> {
    const { zrc20, amount, receiver, targetChain } = params

    // 调用 ZRC-20 的 withdraw 函数
    const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

    return {
      to: zrc20,
      txData: this.encodeWithdraw(receiver, amountWei.toString()),
    }
  }

  /**
   * 追踪跨链交易状态
   */
  async trackCrossChainTx(cctxHash: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed"
    inboundTxHash?: string
    outboundTxHash?: string
    currentStep: string
    progress: number // 0-100
  }> {
    try {
      const response = await fetch(
        `https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/crosschain/cctx/${cctxHash}`,
      )
      const data = await response.json()

      if (data.CrossChainTx) {
        const cctx = data.CrossChainTx
        const status = this.mapCCTXStatus(cctx.cctx_status?.status)

        return {
          status,
          inboundTxHash: cctx.inbound_tx_params?.inbound_tx_observed_hash,
          outboundTxHash: cctx.outbound_tx_params?.[0]?.outbound_tx_hash,
          currentStep: cctx.cctx_status?.status_message || "Processing",
          progress: this.calculateProgress(status),
        }
      }

      return {
        status: "pending",
        currentStep: "Waiting for confirmation",
        progress: 10,
      }
    } catch {
      return {
        status: "pending",
        currentStep: "Fetching status...",
        progress: 0,
      }
    }
  }

  /**
   * 比特币原生存款地址生成
   * 用户可以直接向此地址发送 BTC，自动桥接到 ZetaChain
   */
  async getBTCDepositAddress(evmAddress: string): Promise<string> {
    // 通过 ZetaChain 的 TSS 机制生成 BTC 存款地址
    // 实际实现需要调用 ZetaChain API
    // 这里返回格式化后的地址

    // TSS 地址通常是固定的，但需要附加 memo
    const tssAddress =
      this.network === "mainnet"
        ? "bc1qm24wp577nk8aacckv8np465z3dvmu7ry45gstk" // ZetaChain TSS BTC 地址
        : "tb1qy9pqmk2pd9sv63g27jt8r657uj0jt5a5v5a7lz" // Testnet TSS

    return tssAddress
  }

  /**
   * 获取 BTC 存款 memo
   * 发送 BTC 时需要在 OP_RETURN 中包含此 memo
   */
  getBTCDepositMemo(evmAddress: string): string {
    // Memo 格式: hex(evmAddress)
    return evmAddress.toLowerCase()
  }

  // 辅助方法
  private getChainIdBySymbol(symbol: string): number | string {
    const mapping: Record<string, number | string> = {
      ETH: 1,
      BSC: 56,
      BTC: "bitcoin",
      SOL: "solana",
      MATIC: 137,
    }
    return mapping[symbol] || 0
  }

  private async getTokenPrice(symbol: string): Promise<number> {
    // 简化版价格获取
    const prices: Record<string, number> = {
      ETH: 3500,
      BTC: 100000,
      BNB: 600,
      USDC: 1,
      USDT: 1,
      SOL: 200,
      ZETA: 1.5,
    }
    return prices[symbol] || 0
  }

  private encodeSwapData(params: {
    targetChain: number | string
    targetToken: string
    recipient: string
    minOutput: string
  }): string {
    // DEFERRED: ABI encoding for Gateway swap call
    throw new Error("Swap data encoding not yet implemented")
  }

  private encodeDepositNative(receiver: string): string {
    // deposit(address receiver)
    return `0x47e7ef24000000000000000000000000${receiver.slice(2).padStart(64, "0")}`
  }

  private encodeDepositERC20(receiver: string, token: string, amount: string): string {
    // DEFERRED: ABI encoding for deposit(address,uint256,address,bytes)
    throw new Error("ERC20 deposit encoding not yet implemented")
  }

  private encodeWithdraw(receiver: string, amount: string): string {
    // DEFERRED: ABI encoding for withdraw(bytes,uint256)
    throw new Error("Withdraw encoding not yet implemented")
  }

  private estimateCrossChainTime(fromChain: number | string, toChain: number | string): number {
    // 预估跨链时间（秒）
    if (toChain === "bitcoin" || fromChain === "bitcoin") {
      return 1800 // BTC 需要约 30 分钟
    }
    return 180 // EVM 链约 3 分钟
  }

  private mapCCTXStatus(status: string): "pending" | "processing" | "completed" | "failed" {
    const mapping: Record<string, "pending" | "processing" | "completed" | "failed"> = {
      PendingInbound: "pending",
      PendingOutbound: "processing",
      OutboundMined: "completed",
      Reverted: "failed",
      Aborted: "failed",
    }
    return mapping[status] || "pending"
  }

  private calculateProgress(status: string): number {
    const mapping: Record<string, number> = {
      pending: 25,
      processing: 60,
      completed: 100,
      failed: 0,
    }
    return mapping[status] || 0
  }
}

// 导出默认实例
export const zetachain = new ZetaChainService("mainnet")
export const zetachainTestnet = new ZetaChainService("testnet")
