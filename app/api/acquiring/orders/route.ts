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

function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `ORDER${timestamp}${random}`
}

function getAppBaseUrl(request: NextRequest): string {
  const origin = request.nextUrl.origin
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "")
  let url = process.env.NEXT_PUBLIC_APP_URL || "https://www.protocolbanks.com"
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url.replace(/\/+$/, "")
}

function getApiKeyCredentials(request: NextRequest): { keyId: string; keySecret: string } | null {
  const header = request.headers.get("x-api-key") || request.headers.get("authorization")
  if (!header) return null
  const value = header.replace(/^Bearer\s+/i, "").trim()
  const separator = value.indexOf(":")
  if (separator <= 0) return null
  return {
    keyId: value.slice(0, separator),
    keySecret: value.slice(separator + 1),
  }
}

async function authenticateMerchant(request: NextRequest, merchantId?: string) {
  const credentials = getApiKeyCredentials(request)
  if (credentials) {
    const apiKey = await prisma.merchantApiKey.findUnique({
      where: { key_id: credentials.keyId },
      include: { merchant: true },
    })
    if (!apiKey) return null
    const suppliedHash = crypto.createHash("sha256").update(credentials.keySecret).digest("hex")
    const supplied = Buffer.from(suppliedHash, "utf8")
    const expected = Buffer.from(apiKey.key_secret_hash, "utf8")
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
    if (apiKey.merchant.status !== "active") return null
    if (merchantId && merchantId !== apiKey.merchant_id) return null
    return apiKey.merchant
  }

  const session = await verifySession()
  if (!session || !merchantId) return null
  return prisma.merchant.findFirst({ where: { id: merchantId, user_id: session.userId } })
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

    if (!amount) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 })
    }

    const numericAmount = Number.parseFloat(String(amount))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const merchant = await authenticateMerchant(request, merchant_id)
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized merchant" }, { status: 401 })
    }

    if (merchant.status !== "active") {
      return NextResponse.json({ error: "Merchant is not active" }, { status: 403 })
    }

    if (order_no && !/^[A-Za-z0-9_-]{1,64}$/.test(order_no)) {
      return NextResponse.json({ error: "Invalid order number" }, { status: 400 })
    }

    const callbackUrl = notify_url || merchant.callback_url || null
    if (callbackUrl) {
      try {
        const parsed = new URL(callbackUrl)
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol")
      } catch {
        return NextResponse.json({ error: "Invalid notify URL" }, { status: 400 })
      }
    }

    const finalOrderNo = order_no || generateOrderNo()
    const ttlMinutes = Math.min(24 * 60, Math.max(5, Number.parseInt(String(expire_minutes), 10) || 30))
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

    const order = await prisma.acquiringOrder.create({
      data: {
        order_no: finalOrderNo,
        merchant_id: merchant.id,
        amount: numericAmount,
        currency: String(currency || "USD").toUpperCase(),
        token: String(token || "USDC").toUpperCase(),
        notify_url: callbackUrl,
        return_url: return_url || null,
        expires_at: expiresAt,
        metadata: metadata || undefined,
        status: "pending",
      },
    })

    const checkoutUrl = `${getAppBaseUrl(request)}/checkout?order=${encodeURIComponent(order.order_no)}`

    return NextResponse.json({ success: true, order, checkout_url: checkoutUrl }, { status: 201, headers: NO_STORE_HEADERS })
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
    const orderNo = searchParams.get("order_no")
    const status = searchParams.get("status")
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10) || 50))
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0)

    const hasApiKey = Boolean(getApiKeyCredentials(request))
    const apiKeyMerchant = hasApiKey
      ? await authenticateMerchant(request, merchantId || undefined)
      : null
    if (hasApiKey && !apiKeyMerchant) {
      return NextResponse.json({ error: "Unauthorized merchant" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    let merchantIds: string[] = []
    if (apiKeyMerchant) {
      merchantIds = [apiKeyMerchant.id]
    } else {
      const session = await verifySession()
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
      }
      const merchantRows = await prisma.merchant.findMany({
        where: { user_id: session.userId },
        select: { id: true },
      })
      merchantIds = merchantRows.map((row) => row.id)
      if (merchantId && !merchantIds.includes(merchantId)) {
        return NextResponse.json({ error: "Merchant not found" }, { status: 404, headers: NO_STORE_HEADERS })
      }
    }

    if (merchantIds.length === 0) {
      return NextResponse.json({ success: true, orders: [], total: 0, limit, offset }, { headers: NO_STORE_HEADERS })
    }

    if (orderNo) {
      const order = await prisma.acquiringOrder.findFirst({
        where: { order_no: orderNo, merchant_id: { in: merchantIds } },
      })
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404, headers: NO_STORE_HEADERS })
      }
      return NextResponse.json({ success: true, order }, { headers: NO_STORE_HEADERS })
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
