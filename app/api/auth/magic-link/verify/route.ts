// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Verify Magic Link API
 *
 * GET /api/auth/magic-link/verify?token=xxx
 * Redirects to dashboard on success, error page on failure
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sha256 } from "@/lib/auth/crypto"
import { createSession } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocolbank.io"

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/auth/error?error=missing_token`)
  }

  try {
    const tokenHash = await sha256(token)

    // Find magic link
    const magicLink = await prisma.magicLink.findFirst({
      where: {
        token_hash: tokenHash,
        used: false,
        expires_at: { gt: new Date() },
      },
    })

    if (!magicLink) {
      return NextResponse.redirect(`${baseUrl}/auth/error?error=invalid_or_expired_link`)
    }

    // Mark link as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { used: true, used_at: new Date() },
    })

    // Find or create user
    let user = await prisma.authUser.findUnique({
      where: { email: magicLink.email },
    })

    if (!user) {
      // Create new user
      try {
        user = await prisma.authUser.create({
          data: {
            email: magicLink.email,
            email_verified: true,
          },
        })
      } catch (createError) {
        console.error("[Auth] Failed to create user:", createError)
        return NextResponse.redirect(`${baseUrl}/auth/error?error=user_creation_failed`)
      }
    } else {
      // Update email verification status
      await prisma.authUser.update({
        where: { id: user.id },
        data: { email_verified: true },
      })
    }

    // Check if user has embedded wallet
    const wallet = await prisma.embeddedWallet.findFirst({
      where: { user_id: user.id },
      select: { address: true },
    })

    // Create session
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    await createSession(user.id, user.email || '', wallet?.address, {
      ipAddress,
      userAgent,
    })

    // Redirect based on wallet status
    if (wallet) {
      return NextResponse.redirect(`${baseUrl}/?login=success`)
    } else {
      // New user needs to set up PIN and create wallet
      return NextResponse.redirect(`${baseUrl}/auth/setup-pin`)
    }
  } catch (error) {
    console.error("[Auth] Magic link verification error:", error)
    return NextResponse.redirect(`${baseUrl}/auth/error?error=verification_failed`)
  }
}
