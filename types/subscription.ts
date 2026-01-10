export type SubscriptionStatus = "active" | "paused" | "cancelled"
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "yearly"

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
  vendor_id: string
  vendor_name: string
  recipient_address: string
  amount: string
  token: string
  chain: string
  frequency: SubscriptionFrequency
  status: SubscriptionStatus
  max_amount: string
  next_execution: string
  last_execution?: string
  created_by: string
  created_at: string
}
