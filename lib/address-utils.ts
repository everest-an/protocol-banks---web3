/**
 * Address Utilities
 * Unified address validation and detection across EVM and TRON networks
 */

import { ethers } from "ethers"

export type AddressType = "EVM" | "TRON" | "INVALID"

/**
 * Detect the type of blockchain address
 */
export function detectAddressType(address: string): AddressType {
  if (!address || typeof address !== "string") {
    return "INVALID"
  }

  const trimmed = address.trim()

  // TRON address detection
  // TRON addresses start with 'T' and are 34 characters long (Base58)
  if (trimmed.startsWith("T") && trimmed.length === 34) {
    // Additional validation: check if it's valid Base58
    if (isValidBase58(trimmed)) {
      return "TRON"
    }
  }

  // EVM address detection
  // EVM addresses are 42 characters (0x + 40 hex chars)
  if (ethers.isAddress(trimmed)) {
    return "EVM"
  }

  return "INVALID"
}

/**
 * Validate if a string is valid Base58
 */
function isValidBase58(str: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
  return base58Regex.test(str)
}

/**
 * Validate TRON address
 */
export function isValidTronAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false

  const trimmed = address.trim()

  // Check format
  if (!trimmed.startsWith("T") || trimmed.length !== 34) {
    return false
  }

  // Check Base58 format
  if (!isValidBase58(trimmed)) {
    return false
  }

  // If TronWeb is available, use it for more accurate validation
  if (typeof window !== "undefined" && window.tronWeb) {
    try {
      return window.tronWeb.isAddress(trimmed)
    } catch (e) {
      // Fallback to basic validation
      return true
    }
  }

  return true
}

/**
 * Validate EVM address
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false
  return ethers.isAddress(address.trim())
}

/**
 * Validate address for any supported network
 */
export function validateAddress(address: string, networkType?: "EVM" | "TRON"): {
  isValid: boolean
  type: AddressType
  checksumAddress?: string
  error?: string
} {
  const trimmed = address.trim()

  // If network type is specified, validate accordingly
  if (networkType === "TRON") {
    const isValid = isValidTronAddress(trimmed)
    return {
      isValid,
      type: isValid ? "TRON" : "INVALID",
      checksumAddress: isValid ? trimmed : undefined,
      error: isValid ? undefined : "Invalid TRON address format",
    }
  }

  if (networkType === "EVM") {
    const isValid = isValidEvmAddress(trimmed)
    return {
      isValid,
      type: isValid ? "EVM" : "INVALID",
      checksumAddress: isValid ? ethers.getAddress(trimmed) : undefined,
      error: isValid ? undefined : "Invalid EVM address format",
    }
  }

  // Auto-detect network type
  const detectedType = detectAddressType(trimmed)

  if (detectedType === "INVALID") {
    return {
      isValid: false,
      type: "INVALID",
      error: "Invalid address format (not EVM or TRON)",
    }
  }

  if (detectedType === "TRON") {
    return {
      isValid: true,
      type: "TRON",
      checksumAddress: trimmed,
    }
  }

  // EVM
  return {
    isValid: true,
    type: "EVM",
    checksumAddress: ethers.getAddress(trimmed),
  }
}

/**
 * Get the appropriate network ID for an address
 */
export function getNetworkForAddress(address: string, defaultNetwork: string = "ethereum"): string {
  const validation = validateAddress(address)

  if (!validation.isValid) {
    throw new Error("Invalid address format")
  }

  if (validation.type === "TRON") {
    return "tron"
  }

  if (validation.type === "EVM") {
    return defaultNetwork
  }

  throw new Error("Invalid address format")
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 5): string {
  if (!address) return ""

  if (address.length <= startChars + endChars) {
    return address
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Get block explorer URL for an address
 */
export function getExplorerAddressUrl(address: string, network: string): string {
  const explorers: Record<string, string> = {
    ethereum: "https://etherscan.io/address",
    sepolia: "https://sepolia.etherscan.io/address",
    arbitrum: "https://arbiscan.io/address",
    base: "https://basescan.org/address",
    bsc: "https://bscscan.com/address",
    tron: "https://tronscan.org/#/address",
    "tron-nile": "https://nile.tronscan.org/#/address",
  }

  const explorerBase = explorers[network] || explorers.ethereum

  return `${explorerBase}/${address}`
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string, network: string): string {
  const explorers: Record<string, string> = {
    ethereum: "https://etherscan.io/tx",
    sepolia: "https://sepolia.etherscan.io/tx",
    arbitrum: "https://arbiscan.io/tx",
    base: "https://basescan.org/tx",
    bsc: "https://bscscan.com/tx",
    tron: "https://tronscan.org/#/transaction",
    "tron-nile": "https://nile.tronscan.org/#/transaction",
  }

  const explorerBase = explorers[network] || explorers.ethereum

  return `${explorerBase}/${txHash}`
}

/**
 * Convert TRON address from hex to base58 (if needed)
 */
export function tronHexToBase58(hexAddress: string): string {
  if (typeof window !== "undefined" && window.tronWeb) {
    try {
      return window.tronWeb.address.fromHex(hexAddress)
    } catch (e) {
      console.warn("Failed to convert TRON hex to base58:", e)
      return hexAddress
    }
  }
  return hexAddress
}

/**
 * Convert TRON address from base58 to hex (if needed)
 */
export function tronBase58ToHex(base58Address: string): string {
  if (typeof window !== "undefined" && window.tronWeb) {
    try {
      return window.tronWeb.address.toHex(base58Address)
    } catch (e) {
      console.warn("Failed to convert TRON base58 to hex:", e)
      return base58Address
    }
  }
  return base58Address
}

/**
 * Batch validate addresses
 */
export function validateAddressBatch(addresses: string[]): {
  valid: string[]
  invalid: string[]
  byType: {
    EVM: string[]
    TRON: string[]
  }
} {
  const result = {
    valid: [] as string[],
    invalid: [] as string[],
    byType: {
      EVM: [] as string[],
      TRON: [] as string[],
    },
  }

  for (const address of addresses) {
    const validation = validateAddress(address)

    if (validation.isValid) {
      result.valid.push(validation.checksumAddress!)
      if (validation.type === "EVM") {
        result.byType.EVM.push(validation.checksumAddress!)
      } else if (validation.type === "TRON") {
        result.byType.TRON.push(validation.checksumAddress!)
      }
    } else {
      result.invalid.push(address)
    }
  }

  return result
}
