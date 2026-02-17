// Supported chains configuration
export const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum", symbol: "ETH", icon: "⟠", color: "#627EEA" },
  { id: 137, name: "Polygon", symbol: "MATIC", icon: "⬡", color: "#8247E5" },
  { id: 42161, name: "Arbitrum", symbol: "ETH", icon: "🔷", color: "#28A0F0" },
  { id: 8453, name: "Base", symbol: "ETH", icon: "🔵", color: "#0052FF" },
  { id: 10, name: "Optimism", symbol: "ETH", icon: "🔴", color: "#FF0420" },
  { id: 56, name: "BNB Chain", symbol: "BNB", icon: "⬡", color: "#F0B90B" },
  { id: 177, name: "HashKey Chain", symbol: "HSK", icon: "🔑", color: "#2D6AE0" },
] as const

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

// Common ERC20 tokens with contract addresses per chain
export const COMMON_TOKENS: Record<
  string,
  { symbol: string; decimals: number; addresses: Partial<Record<SupportedChainId, string>> }
> = {
  HSK: {
    symbol: "HSK",
    decimals: 18,
    addresses: {
      177: "NATIVE",
    },
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
    addresses: {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      177: "0x8845E8C74cE5dF8E0d37bf0fe57dc5E0ddD8021b",
    },
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    addresses: {
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      56: "0x55d398326f99059fF775485246999027B3197955",
    },
  },
  DAI: {
    symbol: "DAI",
    decimals: 18,
    addresses: {
      1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    },
  },
  WETH: {
    symbol: "WETH",
    decimals: 18,
    addresses: {
      1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      8453: "0x4200000000000000000000000000000000000006",
      10: "0x4200000000000000000000000000000000000006",
    },
  },
  BUSD: {
    symbol: "BUSD",
    decimals: 18,
    addresses: {
      56: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    },
  },
  BNB: {
    symbol: "BNB",
    decimals: 18,
    addresses: {
      56: "NATIVE",
    },
  },
  WBTC: {
    symbol: "WBTC",
    decimals: 8,
    addresses: {
      1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      137: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    },
  },
}

// Get token addresses for a specific chain.
// Merges data from COMMON_TOKENS (this file) with NETWORK_TOKENS (networks.ts)
// so tokens only configured in one source still appear.
export function getTokensForChain(chainId: SupportedChainId): { symbol: string; address: string; decimals: number }[] {
  const seen = new Set<string>()
  const tokens: { symbol: string; address: string; decimals: number }[] = []

  // Primary: COMMON_TOKENS (tokens.ts)
  for (const [, token] of Object.entries(COMMON_TOKENS)) {
    const address = token.addresses[chainId]
    if (address) {
      tokens.push({ symbol: token.symbol, address, decimals: token.decimals })
      seen.add(token.symbol)
    }
  }

  // Secondary: NETWORK_TOKENS (networks.ts) — fills gaps
  try {
    // Lazy import to avoid circular dependencies at module level
    const { getNetworkByChainId, NETWORK_TOKENS } = require("@/lib/networks")
    const network = getNetworkByChainId(chainId)
    if (network) {
      const networkTokens = NETWORK_TOKENS[network.id] || []
      for (const nt of networkTokens) {
        if (!seen.has(nt.symbol)) {
          tokens.push({ symbol: nt.symbol, address: nt.address, decimals: nt.decimals })
          seen.add(nt.symbol)
        }
      }
    }
  } catch {
    // networks.ts not available — use COMMON_TOKENS only
  }

  return tokens
}

// Get chain info by ID
export function getChainInfo(chainId: number) {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId)
}
