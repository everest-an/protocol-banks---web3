/**
 * Supabase Browser Client
 * 
 * Use this client for client-side operations in React components.
 * For server-side operations, use @/lib/supabase/server instead.
 */
import { createBrowserClient, type SupabaseClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"

// Singleton instance for browser client
let supabaseInstance: SupabaseClient<Database> | null = null

/**
 * Creates or returns the singleton Supabase browser client
 */
export function createClient(): SupabaseClient<Database> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Return a mock client that won't throw but logs warnings
    console.warn("[Supabase] Environment variables not configured")
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: { message: "Supabase not configured" } }),
        insert: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        update: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        delete: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        upsert: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        single: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        eq: function() { return this },
        neq: function() { return this },
        gt: function() { return this },
        gte: function() { return this },
        lt: function() { return this },
        lte: function() { return this },
        like: function() { return this },
        ilike: function() { return this },
        is: function() { return this },
        in: function() { return this },
        order: function() { return this },
        limit: function() { return this },
        range: function() { return this },
      }),
      rpc: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    } as unknown as SupabaseClient<Database>
  }

  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  }
  return supabaseInstance
}

/**
 * Returns the Supabase browser client instance
 * @deprecated Use createClient() instead for consistency
 */
export function getSupabase(): SupabaseClient<Database> {
  return createClient()
}

/**
 * Pre-initialized Supabase browser client
 * @deprecated Prefer createClient() for lazy initialization
 */
export const supabase = createClient()
