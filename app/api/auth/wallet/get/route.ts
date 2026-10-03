// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Get Wallet Info API
 *
 * GET /api/auth/wallet/get
 *
 * Returns wallet address and server share (encrypted)
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const wallet = await prisma.embeddedWallet.findFirst({
      where: { user_id: session.userId },
      select: {
        address: true,
        server_share_encrypted: true,
        server_share_iv: true,
        salt: true,
      },
    })

    if (!wallet) {
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
