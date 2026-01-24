export type VendorTier = "subsidiary" | "partner" | "vendor" | "Partner" | "Vendor" | "Subsidiary"

export type VendorCategory = 
  | "supplier" 
  | "service-provider" 
  | "contractor" 
  | "partner" 
  | "subsidiary" 
  | "other"
  | "Technology"
  | "Manufacturing"
  | "Software"
  | "Internal"
  | "Marketing"
  | "Infrastructure"
  | "Legal"
  | string // Allow any string for flexibility

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
  // Aliases for backward compatibility
  name?: string
  email?: string
  type?: string
}

export interface VendorInput {
  wallet_address: string
  name: string
  company_name?: string
  category?: VendorCategory
  tier?: VendorTier
  chain?: string
  contact_email?: string
  email?: string
  contact_name?: string
  notes?: string
}

export interface VendorStats {
  totalVolume: number
  activeEntities: number
  avgTransaction: number
  healthScore: number
}
