export type SubscriptionStatus = "active" | "paused" | "cancelled"
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "yearly"

export interface SubscriptionInput {
  service_name: string
  amount: number
  token: string
  frequency: SubscriptionFrequency
  recipient_address: string
  max_amount?: number
  chain: string
  status: SubscriptionStatus
  next_payment: string
  created_by: string
}

export interface Subscription {
  id: string
  service_name: string
  recipient_address: string
  amount: string
  token: string
  chain: string
  frequency: SubscriptionFrequency
  status: SubscriptionStatus
  max_amount?: string
  next_payment?: string
  last_payment?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface AutoPayment {
  id: string
  vendor_id?: string
  vendorId?: string  // Legacy alias
  vendor_name?: string
  vendorName?: string  // Legacy alias
  recipient_address?: string
  walletAddress?: string  // Legacy alias
  amount: string
  token: string
  chain?: string
  frequency: SubscriptionFrequency
  status: SubscriptionStatus
  max_amount?: string
  maxAmount?: string  // Legacy alias
  next_execution?: string
  nextPayment?: Date  // Legacy alias
  last_execution?: string
  created_by?: string
  created_at?: string
}
