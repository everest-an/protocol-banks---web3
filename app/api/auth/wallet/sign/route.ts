/**
 * Sign Transaction/Message API
 *
 * POST /api/auth/wallet/sign
 * Body: { pin: string, type: 'transaction' | 'message', data: any }
 *
 * Signs using device share (from client) + server share
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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

    // Get server share
    const wallet = await prisma.embeddedWallet.findFirst({
      where: { user_id: session.userId },
      select: {
        server_share_encrypted: true,
        server_share_iv: true,
        salt: true,
      },
    })

    if (!wallet || !wallet.salt || !wallet.server_share_encrypted || !wallet.server_share_iv) {
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
