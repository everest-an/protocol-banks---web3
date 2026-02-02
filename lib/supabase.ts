/**
 * Unified Supabase Client Exports
 * 
 * This file re-exports Supabase browser clients from the canonical location.
 * 
 * Usage:
 * - For client components: import { createClient, getSupabase, supabase } from "@/lib/supabase"
 * - For server components/actions: import { createClient } from "@/lib/supabase/server"
 * 
 * Note: Server client must be imported directly from @/lib/supabase/server
 * because it's an async function that requires request context.
 */

// Re-export browser client only (server client must be imported directly)
export { createClient, getSupabase, supabase } from "@/lib/supabase/client"

// Re-export Database type for convenience
export type { Database } from "@/types/supabase"
