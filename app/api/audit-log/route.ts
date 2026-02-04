/**
 * Audit Log API
 *
 * Server-side endpoint for storing and retrieving audit logs.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { validateAndChecksumAddress, sanitizeTextInput } from "@/lib/security/security"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, actor, target_type, target_id, details } = body

    // Validate actor address
    const actorValidation = validateAndChecksumAddress(actor)
    if (!actorValidation.valid && actor !== "SYSTEM") {
      return NextResponse.json({ error: "Invalid actor address" }, { status: 400 })
    }

    // Sanitize details
    const sanitizedDetails = { ...details }
    for (const key in sanitizedDetails) {
      if (typeof sanitizedDetails[key] === "string") {
        const result = sanitizeTextInput(sanitizedDetails[key])
        sanitizedDetails[key] = result.sanitized
      }
    }

    // Get client info
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    // Insert audit log
    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        action,
        actor: actorValidation.checksummed || actor,
        target_type,
        target_id,
        details: sanitizedDetails,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, log: data })
  } catch (error: any) {
    console.error("[API] Audit log error:", error)
    return NextResponse.json({ error: error.message || "Failed to create audit log" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actor = searchParams.get("actor")
    const action = searchParams.get("action")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!actor) {
      return NextResponse.json({ error: "Actor (wallet address) is required" }, { status: 400 })
    }

    // Validate actor address
    const actorValidation = validateAndChecksumAddress(actor)
    if (!actorValidation.valid) {
      return NextResponse.json({ error: "Invalid actor address" }, { status: 400 })
    }

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    // Build query
    let query = supabase
      .from("audit_logs")
      .select("*")
      .or(`actor.ilike.${actorValidation.checksummed},actor.eq.SYSTEM`)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (action) {
      query = query.eq("action", action)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ logs: data })
  } catch (error: any) {
    console.error("[API] Audit log fetch error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch audit logs" }, { status: 500 })
  }
}
