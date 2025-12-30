export interface TokenBalance {
  token: string
  chain: string
  balance: string
  balanceUSD: number
  price: number
}

export interface WalletBalance {
  totalUSD: number
  tokens: TokenBalance[]
  lastUpdated: string
}
