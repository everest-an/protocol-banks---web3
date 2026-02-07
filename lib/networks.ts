/**
 * Unified Network Configuration
 * Supports both EVM and TRON networks
 */

export type NetworkType = "EVM" | "TRON"

export interface NetworkConfig {
  id: string
  name: string
  type: NetworkType
  chainId?: number // EVM only
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrl: string
  blockExplorer: string
  icon?: string
  isTestnet: boolean
}

// EVM Networks
export const EVM_NETWORKS: Record<string, NetworkConfig> = {
  ETHEREUM: {
    id: "ethereum",
    name: "Ethereum",
    type: "EVM",
    chainId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    isTestnet: false,
  },
  SEPOLIA: {
    id: "sepolia",
    name: "Sepolia Testnet",
    type: "EVM",
    chainId: 11155111,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    isTestnet: true,
  },
  BASE: {
    id: "base",
    name: "Base",
    type: "EVM",
    chainId: 8453,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    isTestnet: false,
  },
  ARBITRUM: {
    id: "arbitrum",
    name: "Arbitrum One",
    type: "EVM",
    chainId: 42161,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    isTestnet: false,
  },
  BSC: {
    id: "bsc",
    name: "BNB Smart Chain",
    type: "EVM",
    chainId: 56,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: "https://bsc-dataseed.binance.org",
    blockExplorer: "https://bscscan.com",
    isTestnet: false,
  },
}

// TRON Networks
export const TRON_NETWORKS: Record<string, NetworkConfig> = {
  TRON_MAINNET: {
    id: "tron",
    name: "TRON Mainnet",
    type: "TRON",
    nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
    rpcUrl: "https://api.trongrid.io",
    blockExplorer: "https://tronscan.org",
    isTestnet: false,
  },
  TRON_NILE: {
    id: "tron-nile",
    name: "TRON Nile Testnet",
    type: "TRON",
    nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
    rpcUrl: "https://nile.trongrid.io",
    blockExplorer: "https://nile.tronscan.org",
    isTestnet: true,
  },
}

// All Networks (lowercase keys for consistency)
export const ALL_NETWORKS: Record<string, NetworkConfig> = {
  ethereum: EVM_NETWORKS.ETHEREUM,
  sepolia: EVM_NETWORKS.SEPOLIA,
  base: EVM_NETWORKS.BASE,
  arbitrum: EVM_NETWORKS.ARBITRUM,
  bsc: EVM_NETWORKS.BSC,
  tron: TRON_NETWORKS.TRON_MAINNET,
  "tron-nile": TRON_NETWORKS.TRON_NILE,
}

// Token addresses for each network
export interface TokenConfig {
  address: string
  symbol: string
  decimals: number
  logo?: string
}

export const NETWORK_TOKENS: Record<string, TokenConfig[]> = {
  // Ethereum
  ethereum: [
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      decimals: 18,
    },
  ],

  // Arbitrum
  arbitrum: [
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      symbol: "DAI",
      decimals: 18,
    },
  ],

  // Base
  base: [
    {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      symbol: "DAI",
      decimals: 18,
    },
  ],

  // BSC
  bsc: [
    {
      address: "0x55d398326f99059fF775485246999027B3197955",
      symbol: "USDT",
      decimals: 18,
    },
    {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      symbol: "USDC",
      decimals: 18,
    },
    {
      address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
      symbol: "DAI",
      decimals: 18,
    },
  ],

  // TRON Mainnet
  tron: [
    {
      address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT TRC20
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", // USDC TRC20
      symbol: "USDC",
      decimals: 6,
    },
  ],

  // TRON Nile Testnet
  "tron-nile": [
    {
      address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", // Test USDT
      symbol: "USDT",
      decimals: 6,
    },
  ],

  // Sepolia (testnet tokens)
  sepolia: [
    {
      address: "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
      symbol: "DAI",
      decimals: 18,
    },
  ],
}

// Helper functions
export function getNetworkById(id: string): NetworkConfig | undefined {
  return ALL_NETWORKS[id]
}

export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(EVM_NETWORKS).find((n) => n.chainId === chainId)
}

export function getSupportedTokens(networkId: string): TokenConfig[] {
  return NETWORK_TOKENS[networkId] || []
}

export function getTokenAddress(networkId: string, symbol: string): string | undefined {
  const tokens = NETWORK_TOKENS[networkId]
  return tokens?.find((t) => t.symbol === symbol)?.address
}

export function isNetworkSupported(networkId: string): boolean {
  return !!ALL_NETWORKS[networkId]
}

export function getMainnetNetworks(): NetworkConfig[] {
  return Object.values(ALL_NETWORKS).filter((n) => !n.isTestnet)
}

export function getTestnetNetworks(): NetworkConfig[] {
  return Object.values(ALL_NETWORKS).filter((n) => n.isTestnet)
}
