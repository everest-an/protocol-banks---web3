/**
 * ERC-3009 Authorization Utilities
 * 
 * ERC-3009 enables gasless token transfers through signature-based authorization.
 * This is the standard used by USDC for "transfer with authorization".
 * 
 * @see https://eips.ethereum.org/EIPS/eip-3009
 */

// EIP-712 Domain for ERC-3009
export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

// Transfer authorization data
export interface TransferWithAuthorization {
  from: string
  to: string
  value: bigint | string
  validAfter: number
  validBefore: number
  nonce: string
}

// Supported tokens with ERC-3009 support
export const ERC3009_TOKENS: Record<number, Record<string, { address: string; name: string; version: string }>> = {
  // Ethereum Mainnet
  1: {
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      name: "USD Coin",
      version: "2",
    },
  },
  // Polygon
  137: {
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      name: "USD Coin",
      version: "2",
    },
  },
  // Arbitrum
  42161: {
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      name: "USD Coin",
      version: "2",
    },
  },
  // Base
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      version: "2",
    },
  },
  // Optimism
  10: {
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      name: "USD Coin",
      version: "2",
    },
  },
}

// EIP-712 type definitions for TransferWithAuthorization
export const ERC3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
}

/**
 * Generate a random nonce for ERC-3009 authorization
 */
export function generateNonce(): string {
  const array = new Uint8Array(32)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    // Node.js environment
    const crypto = require('crypto')
    crypto.randomFillSync(array)
  }
  return '0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get EIP-712 domain for a token
 */
export function getEIP712Domain(chainId: number, tokenSymbol: string): EIP712Domain | null {
  const token = ERC3009_TOKENS[chainId]?.[tokenSymbol]
  if (!token) return null

  return {
    name: token.name,
    version: token.version,
    chainId,
    verifyingContract: token.address,
  }
}

/**
 * Build the EIP-712 typed data for signing
 */
export function buildTransferAuthorizationTypedData(
  chainId: number,
  tokenSymbol: string,
  authorization: TransferWithAuthorization
) {
  const domain = getEIP712Domain(chainId, tokenSymbol)
  if (!domain) {
    throw new Error(`Token ${tokenSymbol} not supported for ERC-3009 on chain ${chainId}`)
  }

  return {
    domain,
    types: ERC3009_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: authorization.from,
      to: authorization.to,
      value: authorization.value.toString(),
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
    },
  }
}

/**
 * Parse amount to token units (assumes 6 decimals for USDC)
 */
export function parseTokenAmount(amount: string, decimals: number = 6): bigint {
  const [integer, fraction = ""] = amount.split(".")
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals)
  return BigInt(integer + paddedFraction)
}

/**
 * Format token units to decimal amount
 */
export function formatTokenAmount(units: bigint, decimals: number = 6): string {
  const str = units.toString().padStart(decimals + 1, "0")
  const integer = str.slice(0, -decimals) || "0"
  const fraction = str.slice(-decimals)
  return `${integer}.${fraction}`.replace(/\.?0+$/, "")
}

/**
 * Check if a token supports ERC-3009 on a given chain
 */
export function isERC3009Supported(chainId: number, tokenSymbol: string): boolean {
  return !!ERC3009_TOKENS[chainId]?.[tokenSymbol]
}

/**
 * Get token address for ERC-3009 transfers
 */
export function getTokenAddress(chainId: number, tokenSymbol: string): string | null {
  return ERC3009_TOKENS[chainId]?.[tokenSymbol]?.address || null
}

/**
 * Create authorization parameters for a transfer
 */
export function createTransferAuthorization(params: {
  from: string
  to: string
  amount: string
  validityMinutes?: number
}): TransferWithAuthorization {
  const { from, to, amount, validityMinutes = 60 } = params
  const now = Math.floor(Date.now() / 1000)

  return {
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    value: parseTokenAmount(amount),
    validAfter: now - 60, // Valid from 1 minute ago (clock skew tolerance)
    validBefore: now + validityMinutes * 60,
    nonce: generateNonce(),
  }
}

/**
 * Interface for wallet signing function
 */
export type SignTypedDataFn = (params: {
  domain: EIP712Domain
  types: typeof ERC3009_TYPES
  primaryType: string
  message: Record<string, any>
}) => Promise<string>

/**
 * Request signature for a transfer authorization
 */
export async function signTransferAuthorization(
  chainId: number,
  tokenSymbol: string,
  authorization: TransferWithAuthorization,
  signTypedData: SignTypedDataFn
): Promise<string> {
  const typedData = buildTransferAuthorizationTypedData(chainId, tokenSymbol, authorization)
  return await signTypedData(typedData)
}

/**
 * ABI for the transferWithAuthorization function
 */
export const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "uint256", name: "validAfter", type: "uint256" },
      { internalType: "uint256", name: "validBefore", type: "uint256" },
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "uint8", name: "v", type: "uint8" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "s", type: "bytes32" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

/**
 * Encode the transferWithAuthorization call data
 */
export function encodeTransferWithAuthorization(
  authorization: TransferWithAuthorization,
  signature: string
): string {
  // Split signature into v, r, s components
  const r = signature.slice(0, 66)
  const s = "0x" + signature.slice(66, 130)
  const v = parseInt(signature.slice(130, 132), 16)

  // Function selector for transferWithAuthorization
  const selector = "0xe3ee160e"

  // Encode parameters (left-padded to 32 bytes each)
  const from = authorization.from.slice(2).toLowerCase().padStart(64, "0")
  const to = authorization.to.slice(2).toLowerCase().padStart(64, "0")
  const value = BigInt(authorization.value).toString(16).padStart(64, "0")
  const validAfter = authorization.validAfter.toString(16).padStart(64, "0")
  const validBefore = authorization.validBefore.toString(16).padStart(64, "0")
  const nonce = authorization.nonce.slice(2).padStart(64, "0")
  const vHex = v.toString(16).padStart(64, "0")
  const rHex = r.slice(2).padStart(64, "0")
  const sHex = s.slice(2).padStart(64, "0")

  return selector + from + to + value + validAfter + validBefore + nonce + vHex + rHex + sHex
}
