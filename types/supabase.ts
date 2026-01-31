/**
 * Supabase Client Types
 * Provides type definitions for Supabase client to avoid eslint-disable comments
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Generic Supabase client type that can be used across services
export type SupabaseClientType = SupabaseClient<any, 'public', any>

// Optional Supabase client for services that support local fallback
export type OptionalSupabaseClient = SupabaseClientType | undefined | null

// Query result types
export interface QueryResult<T> {
  data: T | null
  error: { message: string } | null
}

export interface QueryArrayResult<T> {
  data: T[] | null
  error: { message: string } | null
}

// Common table types for strong typing
export interface FailedTransactionRow {
  id: string
  recipient: string
  amount: number
  token: string
  error: string
  attempts: number
  last_attempt: string
  original_batch_id?: string
}

export interface FeeDistributionRow {
  id: string
  total_fee: number
  protocol_fee: number
  relayer_fee: number
  network_fee: number
  transaction_hash?: string
  created_at: string
}

export interface UserWalletRow {
  id: string
  user_id: string
  wallet_address: string
  created_at: string
}
