import { createBrowserClient } from "@supabase/ssr"

// Singleton instance
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Return a mock client that won't throw but logs warnings
    return {
      from: () => ({
        select: () => ({ data: [], error: { message: "Supabase not configured" } }),
        insert: () => ({ data: null, error: { message: "Supabase not configured" } }),
        update: () => ({ data: null, error: { message: "Supabase not configured" } }),
        delete: () => ({ data: null, error: { message: "Supabase not configured" } }),
        single: () => ({ data: null, error: { message: "Supabase not configured" } }),
        eq: () => ({ data: [], error: { message: "Supabase not configured" } }),
      }),
      rpc: () => ({ data: null, error: { message: "Supabase not configured" } }),
    } as any
  }

  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  }
  return supabaseInstance
}

export function getSupabase() {
  return createClient()
}

export const supabase = createClient()
