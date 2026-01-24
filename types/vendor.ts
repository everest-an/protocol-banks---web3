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
  email?: string  // Alias for contact_email
  contact_name?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  tags?: string[]
  notes?: string
  monthly_volume?: number
  transaction_count?: number
  metadata?: {
    total_volume?: number
    tx_count?: number
    last_activity?: string
  }
}

export interface VendorStats {
  totalVolume: number
  activeEntities: number
  avgTransaction: number
  healthScore: number
  totalEntities?: number
  subsidiaries?: number
  partners?: number
  vendors?: number
  totalTransactions?: number
}


export interface VendorInput {
  wallet_address: string
  company_name?: string
  name?: string
  category: VendorCategory
  tier?: VendorTier
  type?: string
  chain: string
  contact_email?: string
  contact_name?: string
  notes?: string
  tags?: string[]
}
