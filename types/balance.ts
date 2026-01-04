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

export interface WalletBalance {
  totalUSD: number
  tokens: TokenBalance[]
  chainDistribution: ChainDistribution[]
  lastUpdated: string
  isLoading?: boolean
}
