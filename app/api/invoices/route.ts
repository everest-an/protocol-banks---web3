/**
 * Invoices API - List and manage invoices
 */

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
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
      }
    )

    // Build query
    let query = supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: invoices, error, count } = await query

    if (error) {
      console.error("[API] Invoices fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
    }

    // Update expired invoices
    const now = new Date()
    const updatedInvoices = invoices?.map((inv) => {
      if (inv.status === "pending" && new Date(inv.expires_at) < now) {
        return { ...inv, status: "expired" }
      }
      return inv
    })

    return NextResponse.json({
      invoices: updatedInvoices || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("[API] Invoices error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

// Delete invoice
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get("id")

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
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
      }
    )

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("invoice_id", invoiceId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] Invoice delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete invoice" },
      { status: 500 }
    )
  }
}
