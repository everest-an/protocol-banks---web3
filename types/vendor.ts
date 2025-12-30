export type VendorTier = "subsidiary" | "partner" | "vendor"

export type VendorCategory = "supplier" | "service-provider" | "contractor" | "partner" | "subsidiary" | "other"

export interface Vendor {
  id: string
  wallet_address: string
  company_name: string
  category: VendorCategory
  tier: VendorTier
  chain: string
  contact_email?: string
  contact_name?: string
  created_by: string
  created_at: string
  updated_at: string
  tags?: string[]
  notes?: string
  monthly_volume?: number
  transaction_count?: number
}

export interface VendorStats {
  totalVolume: number
  activeEntities: number
  avgTransaction: number
  healthScore: number
}
