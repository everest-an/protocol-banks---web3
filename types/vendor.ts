export type VendorTier = "subsidiary" | "partner" | "vendor"

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

export interface Vendor {
  id: string
  wallet_address: string
  company_name?: string
  name?: string  // Alias for company_name
  category: VendorCategory
  tier?: VendorTier
  type?: string  // Legacy field
  chain: string
  contact_email?: string
  contact_name?: string
  created_by?: string
  created_at?: string
  updated_at?: string
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
