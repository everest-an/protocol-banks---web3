import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * POST /api/payment/verify
 * Verifies HMAC signature for payment links
 */
export async function POST(req: NextRequest) {
  try {
    const { to, amount, token, exp, sig } = await req.json()

    // Validate required fields
    if (!to || !amount || !token || !sig) {
      return NextResponse.json(
        { valid: false, error: "Missing required parameters" },
        { status: 400 }
      )
    }

    // Get secret from environment
    const secret = process.env.PAYMENT_LINK_SECRET
    if (!secret) {
      console.error("[Payment Verify] PAYMENT_LINK_SECRET not configured")
      return NextResponse.json(
        { valid: false, error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Construct message (same format used when generating the signature)
    const message = `${to}:${amount}:${token}:${exp || ""}`

    // Compute HMAC-SHA256
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex")
      .slice(0, 16) // Use first 16 characters for compact URLs

    // Constant-time comparison to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(sig, "utf8"),
      Buffer.from(expectedSig, "utf8")
    )

    return NextResponse.json({ valid })
  } catch (error: any) {
    console.error("[Payment Verify] Error:", error)
    return NextResponse.json(
      { valid: false, error: "Verification failed" },
      { status: 500 }
    )
  }
}
