/**
 * Get Wallet Info API
 *
 * GET /api/auth/wallet/get
 *
 * Returns wallet address and server share (encrypted)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: wallet, error } = await supabase
      .from("embedded_wallets")
      .select("address, server_share_encrypted, server_share_iv, salt")
      .eq("user_id", session.userId)
      .single()

    if (error || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
    }

    return NextResponse.json({
      address: wallet.address,
      serverShare: {
        encrypted: wallet.server_share_encrypted,
        iv: wallet.server_share_iv,
      },
      salt: wallet.salt,
    })
  } catch (error) {
    console.error("[Auth] Get wallet error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
