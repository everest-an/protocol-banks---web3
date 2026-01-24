import type { Vendor, VendorInput, VendorStats } from "@/types"
import { ethers } from "ethers"

/**
 * 验证钱包地址
 */
export function validateAddress(address: string): { isValid: boolean; checksumAddress?: string; error?: string } {
  if (!address) {
    return { isValid: false, error: "Address is required" }
  }

  try {
    if (!ethers.isAddress(address)) {
      return { isValid: false, error: "Invalid wallet address format" }
    }
    const checksumAddress = ethers.getAddress(address)
    return { isValid: true, checksumAddress }
  } catch {
    return { isValid: false, error: "Invalid wallet address" }
  }
}

/**
 * 验证供应商数据
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
 * 计算网络统计
 */
export function calculateNetworkStats(vendors: Vendor[]): VendorStats {
  const subsidiaries = vendors.filter((v) => v.category === "subsidiary")
  const partners = vendors.filter((v) => v.category === "partner")
  const vendorsList = vendors.filter((v) => v.category === "vendor")

  // 计算总交易量（从 vendors 的 metadata 中获取）
  const totalVolume = vendors.reduce((sum, v) => {
    const volume = v.metadata?.total_volume || 0
    return sum + volume
  }, 0)

  // 计算总交易数
  const totalTransactions = vendors.reduce((sum, v) => {
    const count = v.metadata?.tx_count || 0
    return sum + count
  }, 0)

  // 计算平均交易额
  const avgTransaction = totalTransactions > 0 ? totalVolume / totalTransactions : 0

  // 计算活跃实体（最近30天有交易的）
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
 * 计算网络健康分数
 */
function calculateHealthScore(vendors: Vendor[]): number {
  if (vendors.length === 0) return 0

  // 基于活跃度、交易量、连接数等因素计算健康分数
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
 * 格式化供应商用于显示
 */
export function formatVendorForDisplay(vendor: Vendor) {
  const categoryLabels = {
    subsidiary: "Subsidiary",
    partner: "Partner",
    vendor: "Vendor",
  }

  return {
    ...vendor,
    formattedCategory: categoryLabels[vendor.category],
    formattedAddress: `${vendor.wallet_address.slice(0, 6)}...${vendor.wallet_address.slice(-4)}`,
    formattedVolume: vendor.metadata?.total_volume ? `$${vendor.metadata.total_volume.toLocaleString()}` : "$0",
  }
}

/**
 * 按类型分组供应商
 */
export function groupVendorsByCategory(vendors: Vendor[]) {
  return {
    subsidiaries: vendors.filter((v) => v.category === "subsidiary"),
    partners: vendors.filter((v) => v.category === "partner"),
    vendors: vendors.filter((v) => v.category === "vendor"),
  }
}
