/**
 * Supabase Server Client
 * 
 * Use this client for server-side operations in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 * - Middleware
 * 
 * For client-side operations, use @/lib/supabase/client instead.
 */
import { createServerClient as createSupabaseServerClient, type SupabaseClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

/**
 * Creates a Supabase server client with cookie-based auth
 * Must be called within a request context (Server Component, Route Handler, etc.)
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

/**
 * Alias for createClient - use in server contexts
 */


/**
 * Creates a Supabase admin client with service role key
 * Use with caution - bypasses RLS policies
 */
export async function createAdminClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Ignore cookie errors in server context
          }
        },
      },
    }
  )
}
