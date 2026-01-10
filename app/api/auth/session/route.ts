/**
 * Session API
 *
 * GET /api/auth/session - Get current session
 * DELETE /api/auth/session - Logout
 */

import { NextResponse } from "next/server"
import { getSession, destroySession } from "@/lib/auth/session"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        walletAddress: session.walletAddress,
      },
      expiresAt: session.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("[Auth] Session error:", error)
    return NextResponse.json({ authenticated: false })
  }
}

export async function DELETE() {
  try {
    await destroySession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Auth] Logout error:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}
