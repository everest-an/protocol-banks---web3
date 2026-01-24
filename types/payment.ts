export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled"
export type PaymentType = "sent" | "received"
export type PaymentMethod = "eip3009" | "direct" | "batch"

export interface Payment {
  id: string
  from_address: string
  to_address: string
  amount: string
  token: string
  chain: string
  status: PaymentStatus
  type: PaymentType
  method: PaymentMethod
  tx_hash?: string
  created_at: string
  completed_at?: string
  created_by: string
  vendor_name?: string
  category?: string
  memo?: string
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
  memo?: string
}

export interface Transaction {
  id: string
  type: "sent" | "received" | "swap" | "stake"
  amount: string
  token: string
  to?: string
  from?: string
  hash?: string
  status: PaymentStatus
  timestamp: string
  chain?: string
  // Additional properties for compatibility
  to_address?: string
  from_address?: string
  tx_hash?: string
  token_symbol?: string
  notes?: string
  amount_usd?: number
}

export interface Recipient {
  address: string
  amount: number | string
  token?: string
  vendorName?: string
  vendorId?: string
  memo?: string
}
