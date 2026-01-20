/**
 * ProtocolBanks SDK - Multi-Chain Configuration
 * 
 * 支持的区块链和代币配置
 * Supports: Ethereum, Polygon, Base, Arbitrum, Optimism, BSC, Solana, Bitcoin
 */

import type { ChainId, ChainConfig, TokenConfig, TokenSymbol } from '../types';

// ============================================================================
// Token Addresses by Chain
// ============================================================================

/** USDC contract addresses */
export const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',    // Polygon
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',     // BSC
};

/** USDT contract addresses */
export const USDT_ADDRESSES: Record<number, string> = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',      // Ethereum
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',    // Polygon
  8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',   // Base
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // Arbitrum
  10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',     // Optimism
  56: '0x55d398326f99059fF775485246999027B3197955',     // BSC
};

/** DAI contract addresses */
export const DAI_ADDRESSES: Record<number, string> = {
  1: '0x6B175474E89094C44Da98b954EescdeCB5BE3830',      // Ethereum
  137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',    // Polygon
  42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',  // Arbitrum
  10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',     // Optimism
  56: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',     // BSC
};

// ============================================================================
// Token Configurations
// ============================================================================

/** Create token config helper */
function createToken(
  symbol: TokenSymbol,
  name: string,
  address: string,
  decimals: number,
  supportsGasless: boolean = false
): TokenConfig {
  return { symbol, name, address, decimals, supportsGasless };
}

/** Ethereum tokens */
const ETHEREUM_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[1]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[1]!, 6, false),
  createToken('DAI', 'Dai Stablecoin', DAI_ADDRESSES[1]!, 18, true),
  createToken('ETH', 'Ethereum', 'native', 18, false),
];

/** Polygon tokens */
const POLYGON_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[137]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[137]!, 6, false),
  createToken('DAI', 'Dai Stablecoin', DAI_ADDRESSES[137]!, 18, true),
  createToken('MATIC', 'Polygon', 'native', 18, false),
];

/** Base tokens */
const BASE_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[8453]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[8453]!, 6, false),
  createToken('ETH', 'Ethereum', 'native', 18, false),
];

/** Arbitrum tokens */
const ARBITRUM_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[42161]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[42161]!, 6, false),
  createToken('DAI', 'Dai Stablecoin', DAI_ADDRESSES[42161]!, 18, true),
  createToken('ETH', 'Ethereum', 'native', 18, false),
];

/** Optimism tokens */
const OPTIMISM_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[10]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[10]!, 6, false),
  createToken('DAI', 'Dai Stablecoin', DAI_ADDRESSES[10]!, 18, true),
  createToken('ETH', 'Ethereum', 'native', 18, false),
];

/** BSC tokens */
const BSC_TOKENS: TokenConfig[] = [
  createToken('USDC', 'USD Coin', USDC_ADDRESSES[56]!, 6, true),
  createToken('USDT', 'Tether USD', USDT_ADDRESSES[56]!, 6, false),
  createToken('DAI', 'Dai Stablecoin', DAI_ADDRESSES[56]!, 18, false),
  createToken('BNB', 'BNB', 'native', 18, false),
];

/** Solana tokens */
const SOLANA_TOKENS: TokenConfig[] = [
  createToken('SOL', 'Solana', 'native', 9, false),
  createToken('USDC', 'USD Coin', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, false),
];

/** Bitcoin tokens */
const BITCOIN_TOKENS: TokenConfig[] = [
  createToken('BTC', 'Bitcoin', 'native', 8, false),
];

// ============================================================================
// Chain Configurations
// ============================================================================

/** All supported chain configurations */
export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    tokens: ETHEREUM_TOKENS,
  },
  
  // Polygon
  137: {
    id: 137,
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    rpcUrl: 'https://polygon.llamarpc.com',
    explorerUrl: 'https://polygonscan.com',
    tokens: POLYGON_TOKENS,
  },
  
  // Base
  8453: {
    id: 8453,
    name: 'Base',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://base.llamarpc.com',
    explorerUrl: 'https://basescan.org',
    tokens: BASE_TOKENS,
  },
  
  // Arbitrum
  42161: {
    id: 42161,
    name: 'Arbitrum',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://arbitrum.llamarpc.com',
    explorerUrl: 'https://arbiscan.io',
    tokens: ARBITRUM_TOKENS,
  },
  
  // Optimism
  10: {
    id: 10,
    name: 'Optimism',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://optimism.llamarpc.com',
    explorerUrl: 'https://optimistic.etherscan.io',
    tokens: OPTIMISM_TOKENS,
  },
  
  // BSC
  56: {
    id: 56,
    name: 'BSC',
    nativeCurrency: 'BNB',
    rpcUrl: 'https://bsc.llamarpc.com',
    explorerUrl: 'https://bscscan.com',
    tokens: BSC_TOKENS,
  },
  
  // Solana
  'solana': {
    id: 'solana',
    name: 'Solana',
    nativeCurrency: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    tokens: SOLANA_TOKENS,
  },
  
  // Bitcoin
  'bitcoin': {
    id: 'bitcoin',
    name: 'Bitcoin',
    nativeCurrency: 'BTC',
    rpcUrl: 'https://blockstream.info/api',
    explorerUrl: 'https://blockstream.info',
    tokens: BITCOIN_TOKENS,
  },
};

// ============================================================================
// Testnet Configurations
// ============================================================================

/** Testnet chain configurations */
export const TESTNET_CHAIN_CONFIGS: Record<string, ChainConfig> = {
  // Sepolia (Ethereum testnet)
  '11155111': {
    id: 1, // Maps to mainnet for type compatibility
    name: 'Ethereum',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    explorerUrl: 'https://sepolia.etherscan.io',
    tokens: [
      createToken('USDC', 'USD Coin (Test)', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 6, true),
      createToken('ETH', 'Ethereum', 'native', 18, false),
    ],
    isTestnet: true,
  },
  
  // Mumbai (Polygon testnet)
  '80001': {
    id: 137,
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://mumbai.polygonscan.com',
    tokens: [
      createToken('USDC', 'USD Coin (Test)', '0x0FA8781a83E46826621b3BC094Ea2A0212e71B23', 6, true),
      createToken('MATIC', 'Polygon', 'native', 18, false),
    ],
    isTestnet: true,
  },
  
  // Base Sepolia
  '84532': {
    id: 8453,
    name: 'Base',
    nativeCurrency: 'ETH',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    tokens: [
      createToken('USDC', 'USD Coin (Test)', '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 6, true),
      createToken('ETH', 'Ethereum', 'native', 18, false),
    ],
    isTestnet: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get chain config by ID */
export function getChainConfig(chainId: ChainId): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/** Get all supported chain IDs */
export function getSupportedChainIds(): ChainId[] {
  return Object.keys(CHAIN_CONFIGS).map(id => {
    const num = parseInt(id, 10);
    return isNaN(num) ? id as ChainId : num as ChainId;
  });
}

/** Get token config for a chain */
export function getTokenConfig(chainId: ChainId, symbol: TokenSymbol): TokenConfig | undefined {
  const chain = CHAIN_CONFIGS[chainId];
  return chain?.tokens.find(t => t.symbol === symbol);
}

/** Get all tokens for a chain */
export function getChainTokens(chainId: ChainId): TokenConfig[] {
  return CHAIN_CONFIGS[chainId]?.tokens ?? [];
}

/** Get chains that support a token */
export function getChainsForToken(symbol: TokenSymbol): ChainId[] {
  return getSupportedChainIds().filter(chainId => {
    const chain = CHAIN_CONFIGS[chainId];
    return chain?.tokens.some(t => t.symbol === symbol);
  });
}

/** Check if chain supports gasless (x402) */
export function chainSupportsGasless(chainId: ChainId): boolean {
  const chain = CHAIN_CONFIGS[chainId];
  return chain?.tokens.some(t => t.supportsGasless) ?? false;
}

/** Get gasless tokens for a chain */
export function getGaslessTokens(chainId: ChainId): TokenConfig[] {
  const chain = CHAIN_CONFIGS[chainId];
  return chain?.tokens.filter(t => t.supportsGasless) ?? [];
}

/** Check if chain is EVM compatible */
export function isEVMChain(chainId: ChainId): boolean {
  return typeof chainId === 'number';
}

/** Get token decimals */
export function getTokenDecimals(chainId: ChainId, symbol: TokenSymbol): number {
  const token = getTokenConfig(chainId, symbol);
  return token?.decimals ?? 18;
}

/** Get token address */
export function getTokenAddress(chainId: ChainId, symbol: TokenSymbol): string | undefined {
  const token = getTokenConfig(chainId, symbol);
  return token?.address;
}

/** Format amount with decimals */
export function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return (num / Math.pow(10, decimals)).toFixed(decimals);
}

/** Parse amount to smallest unit */
export function parseAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return Math.floor(num * Math.pow(10, decimals)).toString();
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default chain ID */
export const DEFAULT_CHAIN_ID: ChainId = 137; // Polygon - low fees

/** Default token */
export const DEFAULT_TOKEN: TokenSymbol = 'USDC';

/** Default expiry hours */
export const DEFAULT_EXPIRY_HOURS = 24;

/** Maximum expiry hours */
export const MAX_EXPIRY_HOURS = 168; // 7 days

/** Maximum batch size */
export const MAX_BATCH_SIZE = 500;

/** Maximum amount (1 billion) */
export const MAX_AMOUNT = '1000000000';

/** Minimum amount */
export const MIN_AMOUNT = '0.000001';

// ============================================================================
// API Endpoints
// ============================================================================

/** API base URLs by environment */
export const API_BASE_URLS = {
  production: 'https://api.protocolbanks.com',
  sandbox: 'https://sandbox-api.protocolbanks.com',
  testnet: 'https://testnet-api.protocolbanks.com',
} as const;

/** Payment link base URL */
export const PAYMENT_LINK_BASE_URL = 'https://app.protocolbanks.com/pay';

/** Checkout widget URL */
export const CHECKOUT_WIDGET_URL = 'https://sdk.protocolbanks.com/checkout.js';
