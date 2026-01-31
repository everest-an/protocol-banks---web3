/**
 * Unified Supabase Client Exports
 * 
 * This file re-exports Supabase clients from the canonical locations:
 * - Browser client: @/lib/supabase/client
 * - Server client: @/lib/supabase/server
 * 
 * Usage:
 * - For client components: import { createClient, getSupabase, supabase } from "@/lib/supabase"
 * - For server components/actions: import { createServerClient } from "@/lib/supabase/server"
 */

// Re-export browser client
export { createClient, getSupabase, supabase } from "@/lib/supabase/client"

// Re-export server client for convenience
export { createClient as createServerClient } from "@/lib/supabase/server"
