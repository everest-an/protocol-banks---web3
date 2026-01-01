export interface TokenBalance {
  token: string
  chain: string
  balance: string
  balanceUSD: number
  price: number
}

export interface ChainDistribution {
  chainKey: string
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
}

export interface WalletBalance {
  totalUSD: number
  tokens: TokenBalance[]
  chainDistribution?: ChainDistribution[]
  lastUpdated: string
}
