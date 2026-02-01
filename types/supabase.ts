/**
 * Supabase Database Types
 * 
 * This file contains TypeScript types for the Supabase database.
 * For a full schema, run: npx supabase gen types typescript
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          address: string
          email: string | null
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          address: string
          email?: string | null
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address?: string
          email?: string | null
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          owner_address: string
          wallet_address: string
          service_name: string
          amount: string
          token: string
          chain_id: number | null
          interval: string
          status: string
          next_payment_date: string | null
          failure_count: number
          last_failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_address: string
          wallet_address: string
          service_name: string
          amount: string
          token: string
          chain_id?: number | null
          interval: string
          status?: string
          next_payment_date?: string | null
          failure_count?: number
          last_failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_address?: string
          wallet_address?: string
          service_name?: string
          amount?: string
          token?: string
          chain_id?: number | null
          interval?: string
          status?: string
          next_payment_date?: string | null
          failure_count?: number
          last_failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscription_payment_retries: {
        Row: {
          id: string
          subscription_id: string
          attempt_number: number
          error_message: string | null
          next_retry_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          attempt_number: number
          error_message?: string | null
          next_retry_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          attempt_number?: number
          error_message?: string | null
          next_retry_at?: string | null
          created_at?: string
        }
      }
      agents: {
        Row: {
          id: string
          name: string
          owner_address: string
          status: string
          daily_budget: string | null
          monthly_budget: string | null
          single_limit: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_address: string
          status?: string
          daily_budget?: string | null
          monthly_budget?: string | null
          single_limit?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_address?: string
          status?: string
          daily_budget?: string | null
          monthly_budget?: string | null
          single_limit?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          from_address: string
          to_address: string
          amount: string
          token: string
          chain_id: number
          tx_hash: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          from_address: string
          to_address: string
          amount: string
          token: string
          chain_id: number
          tx_hash?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          from_address?: string
          to_address?: string
          amount?: string
          token?: string
          chain_id?: number
          tx_hash?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      merchants: {
        Row: {
          id: string
          name: string
          owner_address: string
          api_key: string | null
          webhook_url: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_address: string
          api_key?: string | null
          webhook_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_address?: string
          api_key?: string | null
          webhook_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          merchant_id: string | null
          from_address: string
          to_address: string
          amount: string
          token: string
          chain_id: number
          status: string
          due_date: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          merchant_id?: string | null
          from_address: string
          to_address: string
          amount: string
          token: string
          chain_id: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string | null
          from_address?: string
          to_address?: string
          amount?: string
          token?: string
          chain_id?: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
