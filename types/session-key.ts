/**
 * Session Key Types
 * TypeScript definitions for AI Agent session key management
 */

// ============================================
// Core Types
// ============================================

export interface SessionKeyConfig {
  sessionKey: string;          // Session key wallet address
  maxBudget: bigint;           // Maximum budget in wei
  maxSingleTx: bigint;         // Max single transaction amount in wei
  duration: number;            // Duration in seconds
  allowedTokens: string[];     // Allowed token addresses
  allowedTargets: string[];    // Allowed contract addresses
}

export interface SessionKeyDetails {
  sessionId: string;           // Unique session identifier (bytes32)
  owner: string;               // Session owner address
  sessionKey: string;          // Session key address
  maxBudget: bigint;           // Maximum budget in wei
  usedBudget: bigint;          // Used budget in wei
  remainingBudget: bigint;     // Remaining budget in wei
  maxSingleTx: bigint;         // Max single tx in wei
  expiresAt: number;           // Expiration timestamp
  createdAt: number;           // Creation timestamp
  isActive: boolean;           // Whether session is active
  isFrozen: boolean;           // Whether session is frozen
  allowedTokens: string[];     // Allowed token addresses
  allowedTargets: string[];    // Allowed contract addresses
}

export interface UsageRecord {
  timestamp: number;
  amount: bigint;
  token: string;
  target: string;
  txHash: string;
}

export interface SessionKeyStats {
  totalSessionsCreated: number;
  totalBudgetAllocated: bigint;
  totalBudgetUsed: bigint;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateSessionKeyRequest {
  sessionKeyAddress: string;
  maxBudgetEth: string;        // Budget in ETH string (e.g., "10.5")
  maxSingleTxEth: string;      // Max single tx in ETH string
  durationHours: number;       // Duration in hours
  allowedTokens?: string[];
  allowedTargets?: string[];
  chainId: number;             // Target chain ID
}

export interface CreateSessionKeyResponse {
  success: boolean;
  sessionId?: string;
  txHash?: string;
  error?: string;
}

export interface GetSessionKeyRequest {
  sessionId: string;
  chainId: number;
}

export interface GetSessionKeyResponse {
  success: boolean;
  session?: SessionKeyDetails;
  error?: string;
}

export interface ListSessionsRequest {
  ownerAddress: string;
  chainId: number;
}

export interface ListSessionsResponse {
  success: boolean;
  sessions?: SessionKeyDetails[];
  error?: string;
}

export interface ValidateAndRecordRequest {
  sessionId: string;
  amount: string;              // Amount in wei as string
  token: string;               // Token address (0x0 for ETH)
  target: string;              // Target contract address
  signature: string;           // Session key signature
  chainId: number;
}

export interface ValidateAndRecordResponse {
  success: boolean;
  txHash?: string;
  newUsedBudget?: string;
  error?: string;
}

export interface FreezeSessionRequest {
  sessionId: string;
  reason: string;
  chainId: number;
}

export interface UnfreezeSessionRequest {
  sessionId: string;
  chainId: number;
}

export interface RevokeSessionRequest {
  sessionId: string;
  chainId: number;
}

export interface TopUpBudgetRequest {
  sessionId: string;
  additionalBudgetEth: string;
  chainId: number;
}

// ============================================
// Chain Configuration
// ============================================

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Base Mainnet
  8453: {
    chainId: 8453,
    name: "Base",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
    contractAddress: process.env.NEXT_PUBLIC_SESSION_KEY_BASE || "",
    explorerUrl: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  // Base Sepolia
  84532: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    contractAddress: process.env.NEXT_PUBLIC_SESSION_KEY_BASE_SEPOLIA || "",
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  // HashKey Mainnet
  177: {
    chainId: 177,
    name: "HashKey Chain",
    rpcUrl: process.env.NEXT_PUBLIC_HASHKEY_RPC || "https://mainnet.hashkeychain.com",
    contractAddress: process.env.NEXT_PUBLIC_SESSION_KEY_HASHKEY || "",
    explorerUrl: "https://explorer.hashkeychain.com",
    nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  },
  // HashKey Testnet
  133: {
    chainId: 133,
    name: "HashKey Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_HASHKEY_TESTNET_RPC || "https://hashkeychain-testnet.alt.technology",
    contractAddress: process.env.NEXT_PUBLIC_SESSION_KEY_HASHKEY_TESTNET || "",
    explorerUrl: "https://hashkeychain-testnet-explorer.alt.technology",
    nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  },
};

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

export function isSupportedChain(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS;
}
