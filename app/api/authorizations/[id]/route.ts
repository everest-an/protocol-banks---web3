/**
 * x402 Authorization Detail API
 * GET /api/authorizations/[id] - Get a specific authorization
 * PATCH /api/authorizations/[id] - Cancel an authorization
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get specific authorization
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // Fetch authorization
    const { data: authorization, error } = await supabase
      .from("x402_authorizations")
      .select("*")
      .eq("id", id)
      .eq("from_address", ownerAddress.toLowerCase())
      .single()

    if (error || !authorization) {
      return NextResponse.json({ success: false, error: "Authorization not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      authorization,
    })
  } catch (error) {
    console.error("[Authorizations] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH - Cancel authorization
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // Parse request body
    const body = await request.json()

    // Only allow cancellation of pending authorizations
    if (body.status === "cancelled") {
      const { data: authorization, error } = await supabase
        .from("x402_authorizations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("from_address", ownerAddress.toLowerCase())
        .eq("status", "pending") // Can only cancel pending
        .select()
        .single()

      if (error || !authorization) {
        return NextResponse.json(
          { success: false, error: "Authorization not found or cannot be cancelled" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        authorization,
      })
    }

    return NextResponse.json({ success: false, error: "Invalid operation" }, { status: 400 })
  } catch (error) {
    console.error("[Authorizations] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
