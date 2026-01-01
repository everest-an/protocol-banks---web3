import { ethers } from "ethers"

// Supported chains with public RPC endpoints
export const SUPPORTED_CHAINS = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    nativeCurrency: { symbol: "ETH", decimals: 18, coingeckoId: "ethereum" },
    icon: "⟠",
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    rpc: "https://polygon.llamarpc.com",
    nativeCurrency: { symbol: "MATIC", decimals: 18, coingeckoId: "matic-network" },
    icon: "⬡",
    tokens: {
      USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    },
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum",
    rpc: "https://arbitrum.llamarpc.com",
    nativeCurrency: { symbol: "ETH", decimals: 18, coingeckoId: "ethereum" },
    icon: "◆",
    tokens: {
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
  },
  base: {
    chainId: 8453,
    name: "Base",
    rpc: "https://base.llamarpc.com",
    nativeCurrency: { symbol: "ETH", decimals: 18, coingeckoId: "ethereum" },
    icon: "🔵",
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      WETH: "0x4200000000000000000000000000000000000006",
    },
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    rpc: "https://optimism.llamarpc.com",
    nativeCurrency: { symbol: "ETH", decimals: 18, coingeckoId: "ethereum" },
    icon: "🔴",
    tokens: {
      USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      WETH: "0x4200000000000000000000000000000000000006",
    },
  },
} as const

export type ChainKey = keyof typeof SUPPORTED_CHAINS

// ERC20 ABI for balance queries
const ERC20_BALANCE_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]

// Token prices (stablecoins are always $1)
const STABLE_COINS = ["USDC", "USDT", "DAI"]

// Cache for token prices
let priceCache: { [key: string]: number } = {}
let priceCacheTime = 0
const PRICE_CACHE_DURATION = 60000 // 1 minute

export interface ChainBalance {
  chainKey: ChainKey
  chainName: string
  chainIcon: string
  balanceUSD: number
  percentage: number
  tokens: {
    symbol: string
    balance: string
    balanceUSD: number
    price: number
  }[]
  nativeBalance: string
  nativeBalanceUSD: number
}

export interface MultiChainBalance {
  totalUSD: number
  chains: ChainBalance[]
  lastUpdated: string
}

// Fetch token prices from CoinGecko (with fallback)
async function fetchTokenPrices(): Promise<{ [key: string]: number }> {
  const now = Date.now()
  if (now - priceCacheTime < PRICE_CACHE_DURATION && Object.keys(priceCache).length > 0) {
    return priceCache
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network&vs_currencies=usd",
      { next: { revalidate: 60 } },
    )

    if (!response.ok) throw new Error("Price fetch failed")

    const data = await response.json()
    priceCache = {
      ethereum: data.ethereum?.usd || 2500,
      "matic-network": data["matic-network"]?.usd || 0.5,
    }
    priceCacheTime = now
    return priceCache
  } catch (error) {
    console.warn("[MultiChain] Price fetch failed, using fallback prices")
    return {
      ethereum: 2500,
      "matic-network": 0.5,
    }
  }
}

// Get balance for a single token on a chain
async function getTokenBalance(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  tokenAddress: string,
): Promise<{ balance: string; decimals: number }> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_BALANCE_ABI, provider)
    const [balance, decimals] = await Promise.all([contract.balanceOf(walletAddress), contract.decimals()])
    return {
      balance: ethers.formatUnits(balance, decimals),
      decimals: Number(decimals),
    }
  } catch (error) {
    return { balance: "0", decimals: 18 }
  }
}

// Get native balance for a chain
async function getNativeBalance(provider: ethers.JsonRpcProvider, walletAddress: string): Promise<string> {
  try {
    const balance = await provider.getBalance(walletAddress)
    return ethers.formatEther(balance)
  } catch (error) {
    return "0"
  }
}

// Get all balances for a single chain
async function getChainBalances(
  chainKey: ChainKey,
  walletAddress: string,
  prices: { [key: string]: number },
): Promise<ChainBalance> {
  const chain = SUPPORTED_CHAINS[chainKey]
  const provider = new ethers.JsonRpcProvider(chain.rpc)

  // Get native balance
  const nativeBalance = await getNativeBalance(provider, walletAddress)
  const nativePrice = prices[chain.nativeCurrency.coingeckoId] || 0
  const nativeBalanceUSD = Number.parseFloat(nativeBalance) * nativePrice

  // Get token balances
  const tokenEntries = Object.entries(chain.tokens)
  const tokenBalances = await Promise.all(
    tokenEntries.map(async ([symbol, address]) => {
      const { balance } = await getTokenBalance(provider, walletAddress, address)
      const price = STABLE_COINS.includes(symbol) ? 1 : prices[symbol.toLowerCase()] || 0
      const balanceNum = Number.parseFloat(balance) || 0
      return {
        symbol,
        balance,
        balanceUSD: balanceNum * price,
        price,
      }
    }),
  )

  // Filter out zero balances
  const nonZeroTokens = tokenBalances.filter((t) => Number.parseFloat(t.balance) > 0.0001)

  // Calculate total for this chain
  const tokenTotalUSD = tokenBalances.reduce((sum, t) => sum + t.balanceUSD, 0)
  const chainTotalUSD = tokenTotalUSD + nativeBalanceUSD

  return {
    chainKey,
    chainName: chain.name,
    chainIcon: chain.icon,
    balanceUSD: chainTotalUSD,
    percentage: 0, // Will be calculated after we have all chains
    tokens: nonZeroTokens,
    nativeBalance,
    nativeBalanceUSD,
  }
}

// Main function to fetch all chain balances
export async function fetchMultiChainBalance(walletAddress: string): Promise<MultiChainBalance> {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return {
      totalUSD: 0,
      chains: [],
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // Fetch prices first
    const prices = await fetchTokenPrices()

    // Fetch all chain balances in parallel
    const chainKeys = Object.keys(SUPPORTED_CHAINS) as ChainKey[]
    const chainBalances = await Promise.all(
      chainKeys.map((chainKey) => getChainBalances(chainKey, walletAddress, prices)),
    )

    // Calculate total
    const totalUSD = chainBalances.reduce((sum, chain) => sum + chain.balanceUSD, 0)

    // Calculate percentages and filter out chains with no balance
    const chainsWithBalance = chainBalances
      .map((chain) => ({
        ...chain,
        percentage: totalUSD > 0 ? (chain.balanceUSD / totalUSD) * 100 : 0,
      }))
      .filter((chain) => chain.balanceUSD > 0.01)
      .sort((a, b) => b.balanceUSD - a.balanceUSD)

    return {
      totalUSD,
      chains: chainsWithBalance,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[MultiChain] Failed to fetch balances:", error)
    return {
      totalUSD: 0,
      chains: [],
      lastUpdated: new Date().toISOString(),
    }
  }
}
