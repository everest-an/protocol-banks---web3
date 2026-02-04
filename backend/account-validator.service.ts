/**
 * Account Validator Service
 * Validates wallet addresses and account associations
 */

import { ethers } from 'ethers'

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address)
  } catch {
    return false
  }
}

/**
 * Normalize address to checksum format
 */
export function normalizeAddress(address: string): string {
  try {
    return ethers.getAddress(address)
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
  walletAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ valid: boolean; error?: string }> {
  if (!isValidAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format' }
  }
  
  if (isZeroAddress(walletAddress)) {
    return { valid: false, error: 'Cannot use zero address' }
  }
  
  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('id, wallet_address')
      .eq('user_id', accountId)
      .eq('wallet_address', walletAddress.toLowerCase())
      .single()
    
    if (error || !data) {
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
