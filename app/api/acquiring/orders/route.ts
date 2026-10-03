// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Order Management API
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }

// Generate order number
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `ORDER${timestamp}${random}`
}

// Create order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchant_id,
      amount,
      currency = "USD",
      token = "USDC",
      order_no,
      notify_url,
      return_url,
      expire_minutes = 30,
      metadata,
    } = body

    if (!merchant_id || !amount) {
      return NextResponse.json({ error: "Merchant ID and amount are required" }, { status: 400 })
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify merchant exists and belongs to user
    const merchant = await prisma.merchant.findFirst({
      where: { id: merchant_id, user_id: session.userId },
    })

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 })
    }

    if (merchant.status !== "active") {
      return NextResponse.json({ error: "Merchant is not active" }, { status: 403 })
    }

    const finalOrderNo = order_no || generateOrderNo()
    const expiresAt = new Date(Date.now() + expire_minutes * 60 * 1000)

    const order = await prisma.acquiringOrder.create({
      data: {
        order_no: finalOrderNo,
        merchant_id,
        amount: parseFloat(amount),
        currency,
        token,
        notify_url,
        return_url,
        expires_at: expiresAt,
        metadata: metadata || undefined,
        status: "pending",
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocol-banks.vercel.app"
    const checkoutUrl = `${baseUrl}/checkout?order=${order.order_no}`

    return NextResponse.json({ success: true, order, checkout_url: checkoutUrl })
  } catch (error: any) {
    console.error("[API] Order creation error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Get order list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get("merchant_id")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    // Get all merchant IDs owned by user
    const merchantRows = await prisma.merchant.findMany({
      where: { user_id: session.userId },
      select: { id: true },
    })

    const merchantIds = merchantRows.map((row) => row.id)

    if (merchantId && !merchantIds.includes(merchantId)) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    if (merchantIds.length === 0) {
      return NextResponse.json({ success: true, orders: [], total: 0, limit, offset }, { headers: NO_STORE_HEADERS })
    }

    const where: any = {
      merchant_id: merchantId ? merchantId : { in: merchantIds },
    }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.acquiringOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.acquiringOrder.count({ where }),
    ])

    return NextResponse.json({ success: true, orders, total, limit, offset }, { headers: NO_STORE_HEADERS })
  } catch (error: any) {
    console.error("[API] Orders fetch error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
