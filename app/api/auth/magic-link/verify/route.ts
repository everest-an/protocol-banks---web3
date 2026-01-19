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
    const { data: verification, error: findError } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (findError || !verification) {
      return NextResponse.redirect(`${baseUrl}/auth/error?error=invalid_or_expired_link`)
    }

    // Mark link as used
    await supabase
      .from("email_verifications")
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq("id", verification.id)

    // Find or create user
    let { data: user } = await supabase.from("auth_users").select("*").eq("email", verification.email).single()

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("auth_users")
        .insert({
          email: verification.email,
          email_verified: true,
          status: "email_verified",
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
      const nextStatus = ["pin_set", "wallet_created", "active"].includes(user.status)
        ? user.status
        : "email_verified"

      await supabase
        .from("auth_users")
        .update({ email_verified: true, status: nextStatus })
        .eq("id", user.id)
    }

    // Check if user has embedded wallet
    const { data: wallet } = await supabase
      .from("embedded_wallets")
      .select("wallet_address, address")
      .eq("user_id", user.id)
      .maybeSingle()

    // Create session
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    await createSession(user.id, user.email, wallet?.wallet_address || wallet?.address, {
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
