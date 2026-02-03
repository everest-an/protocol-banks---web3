/**
 * Payment Link Tracking API
 *
 * Track views, clicks, and payment events for payment links.
 * Events: "view", "click", "payment"
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getServiceSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
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
    },
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { linkId, event, txHash, amount, payer } = body

    if (!linkId || !event) {
      return NextResponse.json({ error: "linkId and event required" }, { status: 400 })
    }

    const supabase = await getServiceSupabase()
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    const userAgent = request.headers.get("user-agent")

    if (event === "view" || event === "click") {
      // Record view/click event and increment view count on the link
      try {
        await supabase.from("payment_link_events").insert({
          link_id: linkId,
          event_type: event,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
      } catch {
        // Table might not exist yet
      }

      // Increment view count on the payment link itself
      try {
        const { data: link } = await supabase
          .from("payment_links")
          .select("total_views")
          .eq("link_id", linkId)
          .single()

        if (link) {
          await supabase
            .from("payment_links")
            .update({
              total_views: (link.total_views || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("link_id", linkId)
        }
      } catch {
        // Column might not exist yet
      }
    }

    if (event === "payment") {
      // Update payment link stats
      const { error: updateError } = await supabase.rpc("increment_payment_link_stats", {
        p_link_id: linkId,
        p_amount: parseFloat(amount) || 0,
      })

      if (updateError) {
        // Fallback: direct update if RPC doesn't exist
        const { data: link } = await supabase
          .from("payment_links")
          .select("total_payments, total_amount")
          .eq("link_id", linkId)
          .single()

        if (link) {
          await supabase
            .from("payment_links")
            .update({
              total_payments: (link.total_payments || 0) + 1,
              total_amount: (link.total_amount || 0) + (parseFloat(amount) || 0),
              updated_at: new Date().toISOString(),
            })
            .eq("link_id", linkId)
        }
      }

      // Record the payment event
      try {
        await supabase.from("payment_link_events").insert({
          link_id: linkId,
          event_type: "payment",
          tx_hash: txHash,
          amount: parseFloat(amount) || 0,
          payer_address: payer,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
      } catch {
        console.log(`[PaymentLink] Payment: ${linkId} - ${amount} - ${txHash}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] Track error:", error)
    return NextResponse.json({ success: true }) // Don't fail for tracking
  }
}

/**
 * GET - Retrieve tracking analytics for a payment link
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("linkId")

    if (!linkId) {
      return NextResponse.json({ error: "linkId required" }, { status: 400 })
    }

    const supabase = await getServiceSupabase()

    // Get link stats
    const { data: link, error: linkError } = await supabase
      .from("payment_links")
      .select("link_id, total_payments, total_amount, total_views, created_at")
      .eq("link_id", linkId)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
    }

    // Get recent events
    let events: any[] = []
    try {
      const { data } = await supabase
        .from("payment_link_events")
        .select("event_type, tx_hash, amount, payer_address, created_at")
        .eq("link_id", linkId)
        .order("created_at", { ascending: false })
        .limit(50)

      events = data || []
    } catch {
      // Table might not exist
    }

    return NextResponse.json({
      linkId: link.link_id,
      totalPayments: link.total_payments || 0,
      totalAmount: link.total_amount || 0,
      totalViews: link.total_views || 0,
      createdAt: link.created_at,
      recentEvents: events,
    })
  } catch (error: any) {
    console.error("[API] Track GET error:", error)
    return NextResponse.json({ error: error.message || "Failed to get analytics" }, { status: 500 })
  }
}
