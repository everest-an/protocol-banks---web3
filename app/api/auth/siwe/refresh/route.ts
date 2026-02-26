/**
 * POST /api/auth/siwe/refresh
 *
 * Refresh an expired JWT access token using a valid refresh token.
 *
 * Request body:
 *   { refreshToken: string }
 *
 * Response:
 *   { token, expiresAt }
 */

import { type NextRequest, NextResponse } from "next/server"
import { signJwt, hashToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Missing required field: refreshToken" },
        { status: 400 }
      )
    }

    // 1. Hash the refresh token and look it up
    const refreshHash = await hashToken(refreshToken)
    const session = await prisma.aiSession.findUnique({
      where: { refresh_hash: refreshHash },
    })

    if (!session) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      )
    }

    // 2. Check if revoked or expired
    if (session.is_revoked) {
      return NextResponse.json(
        { error: "Session has been revoked" },
        { status: 401 }
      )
    }

    if (session.refresh_expires < new Date()) {
      return NextResponse.json(
        { error: "Refresh token expired" },
        { status: 401 }
      )
    }

    // 3. Issue new JWT access token
    const { token, expiresAt } = await signJwt(session.wallet_address)

    // 4. Update session: new token hash + last_active_at
    const newTokenHash = await hashToken(token)
    await prisma.aiSession.update({
      where: { id: session.id },
      data: {
        token_hash: newTokenHash,
        expires_at: new Date(expiresAt),
        last_active_at: new Date(),
      },
    })

    return NextResponse.json({
      token,
      expiresAt,
      address: session.wallet_address,
    })
  } catch (error) {
    console.error("[SIWE Refresh] Error:", error)
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 }
    )
  }
}
