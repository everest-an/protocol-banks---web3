export type SubscriptionStatus = "active" | "paused" | "cancelled" | "payment_failed" | "authorization_expired"
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "yearly"
export type AutoPayUseCase = "individual" | "enterprise"

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
  // Auto Pay fields
  use_case?: AutoPayUseCase
  max_authorized_amount?: number
  authorization_expires_at?: string
  schedule_day?: number
  schedule_time?: string
  timezone?: string
  description?: string
  recipients?: Array<{ address: string; amount: string; name?: string }>
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
  // Auto Pay fields
  use_case: AutoPayUseCase
  max_authorized_amount?: string
  authorization_expires_at?: string
  total_paid?: string
  payment_count?: number
  schedule_day?: number
  schedule_time?: string
  timezone?: string
  description?: string
  recipients?: Array<{ address: string; amount: string; name?: string }>
  // Computed fields
  remaining_quota?: string
  authorization_valid?: boolean
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
