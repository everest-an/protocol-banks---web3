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
  timestamp?: string
  completed_at?: string
  created_by?: string
  vendor_name?: string
  category?: string
  memo?: string
  token_symbol?: string
  amount_usd?: number
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
