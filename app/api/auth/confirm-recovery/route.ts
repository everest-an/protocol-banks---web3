import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession, createSession } from "@/lib/auth/session"
import { sha256 } from "@/lib/auth/crypto"
import { validateAccountWalletAssociation } from "@/services/account-validator.service"

function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { recoveryPhrase } = await request.json()

    if (!recoveryPhrase || typeof recoveryPhrase !== "string") {
      return NextResponse.json({ error: "Recovery phrase is required" }, { status: 400 })
    }

    const normalizedPhrase = normalizePhrase(recoveryPhrase)

    const supabase = await createClient()

    const { data: wallet, error: walletError } = await supabase
      .from("embedded_wallets")
      .select("id, wallet_address, recovery_phrase_hash")
      .eq("user_id", session.userId)
      .maybeSingle()

    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
    }

    const phraseHash = await sha256(normalizedPhrase)
    if (wallet.recovery_phrase_hash !== phraseHash) {
      return NextResponse.json({ error: "Recovery phrase does not match" }, { status: 400 })
    }

    const validation = await validateAccountWalletAssociation(session.userId)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || "Account validation failed" }, { status: 400 })
    }

    // Update user status to active after validation
    const { error: updateError } = await supabase
      .from("auth_users")
      .update({ status: "active", last_login_at: new Date().toISOString() })
      .eq("id", session.userId)

    if (updateError) {
      console.error("[Auth] Failed to update user status after recovery confirmation:", updateError)
      return NextResponse.json({ error: "Failed to update account status" }, { status: 500 })
    }

    // Refresh session binding wallet address
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    await createSession(session.userId, session.email, wallet.wallet_address, {
      ipAddress,
      userAgent,
    })

    await supabase.from("audit_logs").insert({
      user_id: session.userId,
      action: "recovery_confirmed",
      details: { walletAddress: wallet.wallet_address },
    })

    return NextResponse.json({
      success: true,
      message: "Account setup complete",
      redirectTo: "/dashboard",
    })
  } catch (error) {
    console.error("[Auth] Confirm recovery error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
