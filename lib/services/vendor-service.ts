import type { Vendor, VendorInput, VendorStats } from "@/types"
import { validateAddress as validateMultiNetworkAddress } from "@/lib/address-utils"

/**
 * Validate wallet address (supports both EVM and TRON)
 */
export function validateAddress(address: string): { isValid: boolean; checksumAddress?: string; error?: string } {
  if (!address) {
    return { isValid: false, error: "Address is required" }
  }

  const result = validateMultiNetworkAddress(address.trim())
  return {
    isValid: result.isValid,
    checksumAddress: result.checksumAddress,
    error: result.error,
  }
}

/**
 * Validate vendor data
 */
export function validateVendorData(data: VendorInput | string): { isValid: boolean; checksumAddress?: string; error?: string } {
  // If string is passed, validate as address only
  if (typeof data === 'string') {
    return validateAddress(data)
  }

  // Full vendor validation
  if (!data.name && !data.company_name) {
    return { isValid: false, error: "Vendor name is required" }
  }

  const addressValidation = validateAddress(data.wallet_address)
  if (!addressValidation.isValid) {
    return addressValidation
  }

  return { isValid: true, checksumAddress: addressValidation.checksumAddress }
}

/**
 * Calculate network statistics
 */
export function calculateNetworkStats(vendors: Vendor[]): VendorStats {
  const subsidiaries = vendors.filter((v) => v.category === "subsidiary")
  const partners = vendors.filter((v) => v.category === "partner")
  const vendorsList = vendors.filter((v) => v.category === "vendor")

  // Calculate total volume from vendors metadata
  const totalVolume = vendors.reduce((sum, v) => {
    const volume = v.metadata?.total_volume || 0
    return sum + volume
  }, 0)

  // Calculate total transactions
  const totalTransactions = vendors.reduce((sum, v) => {
    const count = v.metadata?.tx_count || 0
    return sum + count
  }, 0)

  // Calculate average transaction
  const avgTransaction = totalTransactions > 0 ? totalVolume / totalTransactions : 0

  // Calculate active entities (with transactions in last 30 days)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const activeEntities = vendors.filter((v) => {
    const lastActivity = v.metadata?.last_activity
    return lastActivity && new Date(lastActivity) > thirtyDaysAgo
  }).length

  return {
    totalEntities: vendors.length,
    subsidiaries: subsidiaries.length,
    partners: partners.length,
    vendors: vendorsList.length,
    totalVolume,
    totalTransactions,
    avgTransaction,
    activeEntities,
    healthScore: calculateHealthScore(vendors),
  }
}

/**
 * Calculate network health score
 */
function calculateHealthScore(vendors: Vendor[]): number {
  if (vendors.length === 0) return 0

  // Calculate health score based on activity, volume, connections
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const activeCount = vendors.filter((v) => {
    const lastActivity = v.metadata?.last_activity
    return lastActivity && new Date(lastActivity) > thirtyDaysAgo
  }).length

  const activeRatio = activeCount / vendors.length
  const healthScore = Math.round(activeRatio * 100)

  return Math.min(100, Math.max(0, healthScore))
}

/**
 * Format vendor for display
 */
export function formatVendorForDisplay(vendor: Vendor) {
  const categoryLabels: Record<string, string> = {
    subsidiary: "Subsidiary",
    partner: "Partner",
    vendor: "Vendor",
    supplier: "Supplier",
    "service-provider": "Service Provider",
    contractor: "Contractor",
    other: "Other",
  }

  return {
    ...vendor,
    formattedCategory: vendor.category ? categoryLabels[vendor.category] || vendor.category : "Unknown",
    formattedAddress: `${vendor.wallet_address.slice(0, 6)}...${vendor.wallet_address.slice(-4)}`,
    formattedVolume: vendor.metadata?.total_volume ? `$${vendor.metadata.total_volume.toLocaleString()}` : "$0",
  }
}

/**
 * Group vendors by category
 */
export function groupVendorsByCategory(vendors: Vendor[]) {
  return {
    subsidiaries: vendors.filter((v) => v.category === "subsidiary"),
    partners: vendors.filter((v) => v.category === "partner"),
    vendors: vendors.filter((v) => v.category === "vendor"),
  }
}
