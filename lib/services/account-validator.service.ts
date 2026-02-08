/**
 * Account Validator Service
 * Validates wallet addresses and account associations
 */

import { ethers } from 'ethers'
import { isEvmAddressFormat, safeGetChecksumAddress } from '@/lib/address-utils'
import { prisma } from '@/lib/prisma'

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return isEvmAddressFormat(address)
  } catch {
    return false
  }
}

/**
 * Validate address for specific chain
 */
export function isValidChainAddress(address: string, chain: string = 'EVM'): boolean {
  if (!address) return false
  
  switch (chain.toUpperCase()) {
    case 'SOLANA':
    case 'SOL':
       // Basic Base58 check for Solana (32-44 chars)
       return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
       
    case 'BITCOIN':
    case 'BTC':
       // Basic Bitcoin address validation (P2PKH, P2SH, Bech32)
       // Starts with 1, 3, or bc1, alphanumeric, 26-62 chars
       return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)
       
    case 'TRON':
    case 'TRX':
      // TRX addresses start with T and are 34 chars long
      return /^T[a-zA-Z0-9]{33}$/.test(address)

    case 'EVM':
    case 'ETH':
    case 'BSC':
    case 'POLYGON':
    default:
       return isValidAddress(address)
  }
}

/**
 * Normalize address to checksum format
 */
export function normalizeAddress(address: string): string {
  try {
    return safeGetChecksumAddress(address)
  } catch {
    throw new Error('Invalid address format')
  }
}

/**
 * Check if address is zero address
 */
export function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === '0x0000000000000000000000000000000000000000'
}

/**
 * Validate that an account has wallet association
 */
export async function validateAccountWalletAssociation(
  accountId: string,
  walletAddress: string
): Promise<{ valid: boolean; error?: string }> {
  if (!isValidAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format' }
  }
  
  if (isZeroAddress(walletAddress)) {
    return { valid: false, error: 'Cannot use zero address' }
  }
  
  try {
    const wallet = await prisma.embeddedWallet.findFirst({
      where: {
        user_id: accountId,
        wallet_address: walletAddress.toLowerCase(),
      },
      select: { id: true, wallet_address: true },
    })
    
    if (!wallet) {
      return { valid: false, error: 'Wallet not associated with this account' }
    }
    
    return { valid: true }
  } catch (err) {
    console.error('Error validating wallet association:', err)
    return { valid: false, error: 'Failed to validate wallet association' }
  }
}

/**
 * Validate sender and recipient addresses
 */
export function validateTransferAddresses(
  from: string,
  to: string
): { valid: boolean; error?: string } {
  if (!isValidAddress(from)) {
    return { valid: false, error: 'Invalid sender address' }
  }
  
  if (!isValidAddress(to)) {
    return { valid: false, error: 'Invalid recipient address' }
  }
  
  if (isZeroAddress(from)) {
    return { valid: false, error: 'Cannot send from zero address' }
  }
  
  if (isZeroAddress(to)) {
    return { valid: false, error: 'Cannot send to zero address' }
  }
  
  if (from.toLowerCase() === to.toLowerCase()) {
    return { valid: false, error: 'Sender and recipient cannot be the same' }
  }
  
  return { valid: true }
}

/**
 * Batch validate multiple addresses
 */
export function validateAddressBatch(addresses: string[]): {
  valid: boolean
  invalidAddresses: string[]
} {
  const invalidAddresses = addresses.filter(addr => !isValidAddress(addr))
  return {
    valid: invalidAddresses.length === 0,
    invalidAddresses,
  }
}
