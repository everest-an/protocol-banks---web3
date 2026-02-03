/**
 * Subscription Payments History API
 * GET /api/subscriptions/[id]/payments - Get payment history for a subscription
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get payment history for a subscription
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: subscriptionId } = await params
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

    // Verify the subscription belongs to this user
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("id, owner_address")
      .eq("id", subscriptionId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    }

    if (subscription.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
    }

    // Parse query parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // Fetch payment history
    const { data: payments, error, count } = await supabase
      .from("subscription_payments")
      .select("*", { count: "exact" })
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("[SubscriptionPayments] Failed to fetch:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch payment history" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error("[SubscriptionPayments] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
