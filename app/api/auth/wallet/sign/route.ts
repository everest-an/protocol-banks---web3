/**
 * Sign Transaction/Message API
 *
 * POST /api/auth/wallet/sign
 * Body: { pin: string, type: 'transaction' | 'message', data: any }
 *
 * Signs using device share (from client) + server share
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { signTransaction, signMessage } from "@/lib/auth/embedded-wallet"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pin, type, data, deviceShare } = await request.json()

    if (!pin || !type || !data || !deviceShare) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get server share
    const { data: wallet, error } = await supabase
      .from("embedded_wallets")
      .select("server_share_encrypted, server_share_iv, salt")
      .eq("user_id", session.userId)
      .single()

    if (error || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
    }

    const serverShare = {
      encrypted: wallet.server_share_encrypted,
      iv: wallet.server_share_iv,
    }

    try {
      let signature: string

      if (type === "transaction") {
        signature = await signTransaction(pin, wallet.salt, deviceShare, serverShare, data)
      } else if (type === "message") {
        signature = await signMessage(pin, wallet.salt, deviceShare, serverShare, data)
      } else {
        return NextResponse.json({ error: "Invalid sign type" }, { status: 400 })
      }

      return NextResponse.json({ success: true, signature })
    } catch (signError) {
      console.error("[Auth] Signing failed:", signError)
      return NextResponse.json({ error: "Signing failed - invalid PIN or corrupted share" }, { status: 400 })
    }
  } catch (error) {
    console.error("[Auth] Sign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
