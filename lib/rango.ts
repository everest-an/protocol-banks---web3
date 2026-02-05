// Rango Exchange Integration for Cross-Chain Swaps
// Provides multi-route aggregation with best price discovery

export interface RangoAsset {
  blockchain: string
  symbol: string
  address: string | null
  logo?: string
  decimals?: number
  usdPrice?: number
  name?: string
}

export interface RangoRoute {
  requestId: string
  outputAmount: string
  outputAmountUsd: number
  swaps: RangoSwap[]
  tags: RouteTag[]
  estimatedTimeInSeconds: number
  totalFeeUsd: number
  priceImpact: number
}

export interface RangoSwap {
  swapperId: string
  swapperLogo: string
  swapperType: "BRIDGE" | "DEX" | "AGGREGATOR"
  from: RangoAsset
  to: RangoAsset
  fromAmount: string
  toAmount: string
  fee: RangoFee[]
  estimatedTimeInSeconds: number
}

export interface RangoFee {
  name: string
  amount: string
  asset: RangoAsset
  expenseType: "FROM_SOURCE_WALLET" | "DECREASE_FROM_OUTPUT"
  usdPrice?: number
}

export interface RouteTag {
  label: string
  value: "RECOMMENDED" | "FASTEST" | "LOWEST_FEE" | "HIGH_IMPACT" | "CENTRALIZED"
}

export interface ChainInfo {
  id: string
  name: string
  logo: string
  chainId?: number
  type: "EVM" | "COSMOS" | "SOLANA" | "BITCOIN" | "TRON"
  nativeCurrency: {
    symbol: string
    decimals: number
  }
}

export interface TokenInfo {
  symbol: string
  name: string
  address: string | null
  decimals: number
  logo: string
  blockchain: string
  usdPrice?: number
  isPopular?: boolean
}

// Supported chains with metadata
export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: "ETH",
    name: "Ethereum",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/ETH/icon.svg",
    chainId: 1,
    type: "EVM",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
  },
  {
    id: "BSC",
    name: "BNB Chain",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/BSC/icon.svg",
    chainId: 56,
    type: "EVM",
    nativeCurrency: { symbol: "BNB", decimals: 18 },
  },
  {
    id: "POLYGON",
    name: "Polygon",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/POLYGON/icon.svg",
    chainId: 137,
    type: "EVM",
    nativeCurrency: { symbol: "MATIC", decimals: 18 },
  },
  {
    id: "ARBITRUM",
    name: "Arbitrum",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/ARBITRUM/icon.svg",
    chainId: 42161,
    type: "EVM",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
  },
  {
    id: "OPTIMISM",
    name: "Optimism",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/OPTIMISM/icon.svg",
    chainId: 10,
    type: "EVM",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
  },
  {
    id: "BASE",
    name: "Base",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/BASE/icon.svg",
    chainId: 8453,
    type: "EVM",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
  },
  {
    id: "AVAX_CCHAIN",
    name: "Avalanche",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/AVAX_CCHAIN/icon.svg",
    chainId: 43114,
    type: "EVM",
    nativeCurrency: { symbol: "AVAX", decimals: 18 },
  },
  {
    id: "HASHKEY",
    name: "HashKey Chain",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/HASHKEY/icon.svg",
    chainId: 177,
    type: "EVM",
    nativeCurrency: { symbol: "HSK", decimals: 18 },
  },
  {
    id: "ZETA",
    name: "ZetaChain",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/ZETA/icon.svg",
    chainId: 7000,
    type: "EVM",
    nativeCurrency: { symbol: "ZETA", decimals: 18 },
  },
  {
    id: "BTC",
    name: "Bitcoin",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/BTC/icon.svg",
    type: "BITCOIN",
    nativeCurrency: { symbol: "BTC", decimals: 8 },
  },
  {
    id: "SOLANA",
    name: "Solana",
    logo: "https://raw.githubusercontent.com/rango-exchange/assets/main/blockchains/SOLANA/icon.svg",
    type: "SOLANA",
    nativeCurrency: { symbol: "SOL", decimals: 9 },
  },
]

// Popular tokens per chain
export const POPULAR_TOKENS: Record<string, TokenInfo[]> = {
  ETH: [
    {
      symbol: "ETH",
      name: "Ethereum",
      address: null,
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/ETH.png",
      blockchain: "ETH",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: 6,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "ETH",
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimals: 6,
      logo: "https://rango.vip/i/GJxbOP",
      blockchain: "ETH",
    },
    {
      symbol: "DAI",
      name: "Dai",
      address: "0x6b175474e89094c44da98b954eedeac495271d0f",
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/DAI.png",
      blockchain: "ETH",
    },
    {
      symbol: "WBTC",
      name: "Wrapped BTC",
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      decimals: 8,
      logo: "https://rango.vip/tokens/ALL/WBTC.png",
      blockchain: "ETH",
    },
  ],
  BSC: [
    {
      symbol: "BNB",
      name: "BNB",
      address: null,
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/BNB.png",
      blockchain: "BSC",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      decimals: 18,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "BSC",
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0x55d398326f99059ff775485246999027b3197955",
      decimals: 18,
      logo: "https://rango.vip/i/GJxbOP",
      blockchain: "BSC",
    },
    {
      symbol: "BUSD",
      name: "Binance USD",
      address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/BUSD.png",
      blockchain: "BSC",
    },
  ],
  POLYGON: [
    {
      symbol: "MATIC",
      name: "Polygon",
      address: null,
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/MATIC.png",
      blockchain: "POLYGON",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      decimals: 6,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "POLYGON",
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      decimals: 6,
      logo: "https://rango.vip/i/GJxbOP",
      blockchain: "POLYGON",
    },
  ],
  ARBITRUM: [
    {
      symbol: "ETH",
      name: "Ethereum",
      address: null,
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/ETH.png",
      blockchain: "ARBITRUM",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      decimals: 6,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "ARBITRUM",
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      decimals: 6,
      logo: "https://rango.vip/i/GJxbOP",
      blockchain: "ARBITRUM",
    },
    {
      symbol: "ARB",
      name: "Arbitrum",
      address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/ARB.png",
      blockchain: "ARBITRUM",
    },
  ],
  BASE: [
    {
      symbol: "ETH",
      name: "Ethereum",
      address: null,
      decimals: 18,
      logo: "https://rango.vip/tokens/ALL/ETH.png",
      blockchain: "BASE",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      decimals: 6,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "BASE",
    },
  ],
  BTC: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      address: null,
      decimals: 8,
      logo: "https://rango.vip/tokens/ALL/BTC.png",
      blockchain: "BTC",
    },
  ],
  SOLANA: [
    {
      symbol: "SOL",
      name: "Solana",
      address: null,
      decimals: 9,
      logo: "https://rango.vip/tokens/ALL/SOL.png",
      blockchain: "SOLANA",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      decimals: 6,
      logo: "https://rango.vip/i/e4x0s8",
      blockchain: "SOLANA",
    },
  ],
}

// Rango API service - uses server-side API route
class RangoService {
  // Get all possible routes for a swap via server API
  async getAllRoutes(
    from: RangoAsset,
    to: RangoAsset,
    amount: string,
    slippage = 1.0,
  ): Promise<{ routes: RangoRoute[]; routeId: string }> {
    try {
      const response = await fetch("/api/rango", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getAllRoutes",
          from: { blockchain: from.blockchain, symbol: from.symbol, address: from.address },
          to: { blockchain: to.blockchain, symbol: to.symbol, address: to.address },
          amount,
          slippage: slippage.toString(),
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const routes: RangoRoute[] = (data.results || []).map((result: any) => ({
        requestId: result.requestId,
        outputAmount: result.outputAmount,
        outputAmountUsd: this.calculateOutputUsd(result),
        swaps:
          result.swaps?.map((swap: any) => ({
            swapperId: swap.swapperId,
            swapperLogo: swap.swapperLogo,
            swapperType: swap.swapperType,
            from: swap.from,
            to: swap.to,
            fromAmount: swap.fromAmount,
            toAmount: swap.toAmount,
            fee: swap.fee,
            estimatedTimeInSeconds: swap.estimatedTimeInSeconds,
          })) || [],
        tags: result.tags || [],
        estimatedTimeInSeconds:
          result.swaps?.reduce((sum: number, s: any) => sum + (s.estimatedTimeInSeconds || 0), 0) || 0,
        totalFeeUsd: this.calculateTotalFeeUsd(result.swaps),
        priceImpact: this.calculatePriceImpact(result),
      }))

      // Sort by output amount (best first)
      routes.sort((a, b) => Number.parseFloat(b.outputAmount) - Number.parseFloat(a.outputAmount))

      // Add tags
      if (routes.length > 0) {
        routes[0].tags.push({ label: "Best Price", value: "RECOMMENDED" })
      }

      const fastestIdx = routes.reduce(
        (minIdx, r, idx, arr) => (r.estimatedTimeInSeconds < arr[minIdx].estimatedTimeInSeconds ? idx : minIdx),
        0,
      )
      if (fastestIdx !== 0 && routes[fastestIdx]) {
        routes[fastestIdx].tags.push({ label: "Fastest", value: "FASTEST" })
      }

      const lowestFeeIdx = routes.reduce(
        (minIdx, r, idx, arr) => (r.totalFeeUsd < arr[minIdx].totalFeeUsd ? idx : minIdx),
        0,
      )
      if (lowestFeeIdx !== 0 && routes[lowestFeeIdx]) {
        routes[lowestFeeIdx].tags.push({ label: "Lowest Fee", value: "LOWEST_FEE" })
      }

      return { routes, routeId: data.routeId }
    } catch (error) {
      console.error("Failed to get routes:", error)
      throw new Error(
        error instanceof Error
          ? `Swap route fetch failed: ${error.message}`
          : "Failed to fetch swap routes. Please check your network and try again."
      )
    }
  }

  // Get single best route (for Web2 users)
  async getBestRoute(from: RangoAsset, to: RangoAsset, amount: string, slippage = 1.0): Promise<RangoRoute | null> {
    const { routes } = await this.getAllRoutes(from, to, amount, slippage)
    return routes[0] || null
  }

  // Confirm and create transaction via server API
  async confirmRoute(requestId: string, routeId: string): Promise<{ success: boolean; tx?: any; error?: string }> {
    try {
      const response = await fetch("/api/rango", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmRoute", requestId, routeId }),
      })

      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error }
      }

      return { success: true, tx: data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Confirmation failed" }
    }
  }

  // Create swap transaction via server API
  async createTransaction(
    requestId: string,
    routeId: string,
    userWallets: Record<string, string>,
    destinationAddress?: string,
  ): Promise<{ success: boolean; tx?: any; error?: string }> {
    try {
      const response = await fetch("/api/rango", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createTransaction",
          requestId,
          step: 1,
          userSettings: { slippage: "1.0" },
          validations: { balance: true, fee: true, approve: true },
        }),
      })

      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error }
      }

      return { success: true, tx: data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Transaction creation failed" }
    }
  }

  // Check transaction status via server API
  async checkStatus(requestId: string, txId: string): Promise<{ status: string; progress: number }> {
    try {
      const response = await fetch("/api/rango", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkStatus", requestId, txId }),
      })
      const data = await response.json()

      return {
        status: data.status || "PENDING",
        progress: data.status === "SUCCESS" ? 100 : data.status === "FAILED" ? 0 : 50,
      }
    } catch {
      return { status: "PENDING", progress: 50 }
    }
  }

  // Detect chain from address
  detectChainFromAddress(address: string): string | null {
    if (!address) return null

    // Bitcoin addresses
    if (address.match(/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/)) return "BTC"
    if (address.match(/^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/)) return "BTC"

    // Solana addresses
    if (address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) && !address.startsWith("0x")) return "SOLANA"

    // EVM addresses - need additional context
    if (address.match(/^0x[a-fA-F0-9]{40}$/)) return "ETH" // Default to ETH for EVM

    return null
  }

  // Get best token to receive based on destination
  getBestStablecoin(chain: string): TokenInfo | null {
    const tokens = POPULAR_TOKENS[chain]
    if (!tokens) return null

    // Prefer USDC, then USDT
    return tokens.find((t) => t.symbol === "USDC") || tokens.find((t) => t.symbol === "USDT") || tokens[0]
  }

  private calculateOutputUsd(result: any): number {
    if (!result.swaps || result.swaps.length === 0) return 0
    const lastSwap = result.swaps[result.swaps.length - 1]
    const toAmount = Number.parseFloat(lastSwap.toAmount || result.outputAmount || "0")
    const usdPrice = lastSwap.to?.usdPrice || 1
    return toAmount * usdPrice
  }

  private calculateTotalFeeUsd(swaps: any[]): number {
    if (!swaps) return 0
    return swaps.reduce((total, swap) => {
      const fees = swap.fee || []
      return (
        total +
        fees.reduce((sum: number, f: any) => {
          const price = f.price || f.asset?.usdPrice || 0
          return sum + Number.parseFloat(f.amount || "0") * price
        }, 0)
      )
    }, 0)
  }

  private calculatePriceImpact(result: any): number {
    // Estimate price impact based on output vs expected
    if (!result.swaps || result.swaps.length === 0) return 0
    const firstSwap = result.swaps[0]
    const lastSwap = result.swaps[result.swaps.length - 1]

    const inputUsd = Number.parseFloat(firstSwap.fromAmount || "0") * (firstSwap.from?.usdPrice || 0)
    const outputUsd = Number.parseFloat(lastSwap.toAmount || result.outputAmount || "0") * (lastSwap.to?.usdPrice || 1)

    if (inputUsd === 0) return 0
    return Math.abs(((inputUsd - outputUsd) / inputUsd) * 100)
  }

}

export const rangoService = new RangoService()
