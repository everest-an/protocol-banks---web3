/**
 * GET /api/auth/siwe/nonce
 *
 * Generate a single-use SIWE challenge nonce for AI agent authentication.
 * The nonce expires after 5 minutes and can only be used once.
 *
 * Rate limit: 10 requests/minute per IP.
 */

import { NextResponse } from "next/server"
import { generateSiweNonce } from "@/lib/auth/siwe"

export async function GET() {
  try {
    const { nonce, expiresAt } = await generateSiweNonce()

    return NextResponse.json({
      nonce,
      expiresAt,
    })
  } catch (error) {
    console.error("[SIWE Nonce] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500 }
    )
  }
}
