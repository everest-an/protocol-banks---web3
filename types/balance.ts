export interface TokenBalance {
  token: string
  chain: string
  balance: string
  balanceUSD: number
  price: number
  contractAddress?: string
}

export interface ChainDistribution {
  chain: string
  chainId: number
  totalUSD: number
  percentage: number
  tokenCount: number
  icon?: string
}

// Aggregated token distribution (across all chains)
export interface TokenDistribution {
  token: string
  totalBalance: number
  totalUSD: number
  percentage: number
  price: number
  chains: string[]
}

export interface WalletBalance {
  totalUSD: number
  tokens: TokenBalance[]
  chainDistribution: ChainDistribution[]
  tokenDistribution?: TokenDistribution[]
  lastUpdated: string
  isLoading?: boolean
}
