/**
 * Verify Magic Link API
 *
 * GET /api/auth/magic-link/verify?token=xxx
 * Redirects to dashboard on success, error page on failure
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sha256 } from "@/lib/auth/crypto"
import { createSession } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://protocolbank.io"

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/auth/error?error=missing_token`)
  }

  try {
    const supabase = await createClient()
    const tokenHash = await sha256(token)

    // Find magic link
    const { data: magicLink, error: findError } = await supabase
      .from("magic_links")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (findError || !magicLink) {
      return NextResponse.redirect(`${baseUrl}/auth/error?error=invalid_or_expired_link`)
    }

    // Mark link as used
    await supabase.from("magic_links").update({ used: true, used_at: new Date().toISOString() }).eq("id", magicLink.id)

    // Find or create user
    let { data: user } = await supabase.from("auth_users").select("*").eq("email", magicLink.email).single()

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("auth_users")
        .insert({
          email: magicLink.email,
          email_verified: true,
        })
        .select()
        .single()

      if (createError) {
        console.error("[Auth] Failed to create user:", createError)
        return NextResponse.redirect(`${baseUrl}/auth/error?error=user_creation_failed`)
      }

      user = newUser
    } else {
      // Update email verification status
      await supabase.from("auth_users").update({ email_verified: true }).eq("id", user.id)
    }

    // Check if user has embedded wallet
    const { data: wallet } = await supabase.from("embedded_wallets").select("address").eq("user_id", user.id).single()

    // Create session
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    await createSession(user.id, user.email, wallet?.address, {
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
