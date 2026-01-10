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
