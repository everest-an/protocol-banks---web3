/**
 * x402 Authorizations API
 * GET /api/authorizations - List x402 payment authorizations for the user
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List authorizations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get owner_address
    const { data: authUser } = await supabase
      .from("auth_users")
      .select("wallet_address")
      .eq("id", user.id)
      .single()

    const ownerAddress = authUser?.wallet_address
    if (!ownerAddress) {
      return NextResponse.json({ success: false, error: "No wallet associated" }, { status: 400 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // pending, used, cancelled, expired
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build query
    let query = supabase
      .from("x402_authorizations")
      .select("*", { count: "exact" })
      .eq("from_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: authorizations, error, count } = await query

    if (error) {
      console.error("[Authorizations] Failed to fetch:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch authorizations" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      authorizations: authorizations || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error("[Authorizations] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
