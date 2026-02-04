export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled"
export type PaymentType = "sent" | "received"
export type PaymentMethod = "eip3009" | "direct" | "batch"

export interface Payment {
  id: string
  from_address: string
  to_address: string
  amount: string | number
  token: string
  chain: string
  status: PaymentStatus
  type: PaymentType
  method?: PaymentMethod
  tx_hash?: string
  created_at: string
  timestamp: string  // Required - use created_at as fallback when mapping
  completed_at?: string
  created_by?: string
  vendor_name?: string
  category?: string
  memo?: string
  notes?: string
  token_symbol?: string
  amount_usd?: number
  vendor?: {
    name: string
  }
  is_external?: boolean
}

export interface PaymentHistory {
  payments: Payment[]
  totalSent: number
  totalReceived: number
  thisMonth: number
  lastMonth: number
}

export interface MonthlyPaymentData {
  month: string
  amount: number
  count: number
}

export interface PaymentRecipient {
  id: string
  address: string
  amount: string
  vendorName?: string
  vendorId?: string
  token: string
  chain?: string // Chain identifier (EVM, SOLANA, BTC, etc.)
}


export interface Transaction {
  id: string
  from_address: string
  to_address: string
  amount: string
  token: string
  token_symbol?: string
  chain: string
  status: PaymentStatus
  type: PaymentType
  tx_hash?: string
  created_at: string
  completed_at?: string
  timestamp?: string
  memo?: string
  notes?: string
  amount_usd?: number
  method?: PaymentMethod
  created_by?: string
}

// Recipient type for batch payments
export interface Recipient {
  address: string
  amount: number
  token?: string
  memo?: string
  vendorId?: string
  vendorName?: string
}

// Payment result type
export interface PaymentResult {
  success: boolean
  txHash?: string
  error?: string
  amount?: number
  recipient?: string
  token?: string
}

// Batch report types
export interface BatchReportItem {
  recipient: string
  amount: number | string
  token: string
  status: "success" | "failed"
  txHash?: string
  error?: string
}

export interface BatchReport {
  items: BatchReportItem[]
  totalSuccess: number
  totalFailed: number
  totalAmount: string
}
