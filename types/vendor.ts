export type VendorTier = "subsidiary" | "partner" | "vendor"

export type VendorCategory =
  | "supplier"
  | "service-provider"
  | "contractor"
  | "partner"
  | "subsidiary"
  | "vendor"
  | "other"
  | "Technology"
  | "Manufacturing"
  | "Software"
  | "Internal"
  | "Marketing"
  | "Infrastructure"
  | "Legal"

// Web3 reputation tags for stablecoin Stripe-style contacts
export type ReputationTag = "whale" | "active" | "newbie" | "inactive"

export interface Vendor {
  id: string
  wallet_address: string
  ens_name?: string  // ENS domain (e.g. vitalik.eth)
  company_name?: string
  name?: string  // Alias for company_name
  category?: VendorCategory
  tier?: VendorTier
  type?: string  // Legacy field
  chain: string
  last_chain?: string  // Last chain used for payment (Base, Polygon, Arbitrum)
  last_wallet_type?: string  // Last wallet type used (MetaMask, Safe, OKX)
  contact_email?: string
  email?: string  // Alias for contact_email
  contact_name?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  tags?: string[]
  reputation_tag?: ReputationTag  // Whale / Active / Newbie / Inactive
  notes?: string
  monthly_volume?: number
  transaction_count?: number
  on_chain_balance?: number  // Stablecoin balance in wallet (USDC/USDT)
  ltv?: number  // Lifetime value through platform
  parentId?: string  // For network graph hierarchy
  totalReceived?: number  // Total amount received
  last_payment_at?: string  // Last payment timestamp
  integrity_hash?: string  // SHA-256 hash for tamper detection
  integrity_verified?: boolean | null  // Result of integrity check on read
  address_changed_at?: string  // ISO timestamp of last address change
  address_change_signature?: string  // Wallet signature confirming last address change
  owner_address?: string  // Owner's wallet address
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
  category?: VendorCategory
  tier?: VendorTier
  type?: string
  chain: string
  contact_email?: string
  email?: string  // Alias for contact_email
  contact_name?: string
  notes?: string
  tags?: string[]
}
