// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Merchant Management API
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }

// Generate API Key
function generateApiKey(): {
  keyId: string
  keySecret: string
  keySecretHash: string
} {
  const keyId = `pk_${crypto.randomBytes(16).toString("hex")}`
  const keySecret = `sk_${crypto.randomBytes(32).toString("hex")}`
  const keySecretHash = crypto.createHash("sha256").update(keySecret).digest("hex")

  return { keyId, keySecret, keySecretHash }
}

// Create merchant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, logo_url, wallet_address, callback_url } = body

    if (!name || !wallet_address) {
      return NextResponse.json({ error: "Name and wallet address are required" }, { status: 400 })
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }

    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const authUser = await prisma.authUser.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })

    if (!authUser) {
      return NextResponse.json({ error: "Invalid user session" }, { status: 400 })
    }

    // Create merchant
    const merchant = await prisma.merchant.create({
      data: {
        user_id: session.userId,
        name,
        logo_url,
        wallet_address,
        callback_url,
        status: "active",
      },
    })

    // Automatically generate an API Key
    const { keyId, keySecret, keySecretHash } = generateApiKey()

    try {
      await prisma.merchantApiKey.create({
        data: {
          merchant_id: merchant.id,
          key_id: keyId,
          key_secret_hash: keySecretHash,
          name: "Default API Key",
        },
      })
    } catch (keyError) {
      console.warn("[API] API Key creation warning:", keyError)
    }

    return NextResponse.json({
      success: true,
      merchant,
      api_key: {
        key_id: keyId,
        key_secret: keySecret,
      },
    })
  } catch (error: any) {
    console.error("[API] Merchant creation error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Get merchant list
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const merchants = await prisma.merchant.findMany({
      where: { user_id: session.userId },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ success: true, merchants }, { headers: NO_STORE_HEADERS })
  } catch (error: any) {
    console.error("[API] Merchants fetch error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
