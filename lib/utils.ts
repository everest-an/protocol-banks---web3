import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Vendor } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get display name for a vendor with proper fallback chain
 * Prevents null/undefined display issues across the app
 * @param vendor - The vendor object (can be null/undefined)
 * @param options - Optional configuration
 * @returns A safe display string
 */
export function getVendorDisplayName(
  vendor: Vendor | null | undefined,
  options?: { 
    showWalletFallback?: boolean
    maxLength?: number 
  }
): string {
  if (!vendor) return 'Unknown'
  
  const { showWalletFallback = true, maxLength } = options || {}
  
  // Priority: name > company_name > ens_name > wallet address
  let displayName = vendor.name || vendor.company_name || vendor.ens_name
  
  // Fallback to truncated wallet address if allowed
  if (!displayName && showWalletFallback && vendor.wallet_address) {
    // Sanitize wallet address - only allow valid hex characters
    const sanitizedAddress = vendor.wallet_address.replace(/[^a-fA-F0-9xT]/g, '')
    if (sanitizedAddress.length >= 8) {
      displayName = `Wallet ${sanitizedAddress.slice(0, 6)}...${sanitizedAddress.slice(-4)}`
    }
  }
  
  if (!displayName) return 'Unknown'
  
  // Truncate if maxLength specified
  if (maxLength && displayName.length > maxLength) {
    return displayName.slice(0, maxLength - 3) + '...'
  }
  
  return displayName
}

/**
 * Get initials for avatar display
 * @param vendor - The vendor object
 * @returns 2-character initials string
 */
export function getVendorInitials(vendor: Vendor | null | undefined): string {
  if (!vendor) return '??'
  
  const name = vendor.name || vendor.company_name || vendor.ens_name
  if (!name) return '??'
  
  // Sanitize: remove any non-alphanumeric characters except spaces
  const sanitized = name.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  if (!sanitized) return '??'
  
  const words = sanitized.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return sanitized.substring(0, 2).toUpperCase()
}

/**
 * Safely get vendor email with fallback
 */
export function getVendorEmail(vendor: Vendor | null | undefined): string | undefined {
  if (!vendor) return undefined
  return vendor.contact_email || vendor.email
}
