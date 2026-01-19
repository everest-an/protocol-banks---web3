export const SUPPORTED_TOKENS = {
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    chains: [1, 137, 42161],
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    chains: [1, 137, 42161],
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    chains: [1, 137, 42161],
  },
  ETH: {
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    chains: [1, 137, 42161],
  },
} as const

export type SupportedTokenSymbol = keyof typeof SUPPORTED_TOKENS
