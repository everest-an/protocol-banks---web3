import { SUPPORTED_TOKENS } from "@/services/token-registry"

export type TokenMetadata = {
  symbol: string
  address: string
  decimals: number
  chains: number[]
}

export function getSupportedTokens(): Record<string, TokenMetadata> {
  return SUPPORTED_TOKENS
}

export function getToken(symbol: string, chainId?: number): TokenMetadata | undefined {
  const token = SUPPORTED_TOKENS[symbol.toUpperCase()]
  if (!token) return undefined
  if (chainId && !token.chains.includes(chainId)) return undefined
  return { ...token, symbol: symbol.toUpperCase() }
}

export function isSupportedToken(symbol: string, chainId?: number): boolean {
  return Boolean(getToken(symbol, chainId))
}
