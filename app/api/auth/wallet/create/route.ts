// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Create Embedded Wallet API
 *
 * POST /api/auth/wallet/create
 * Body: { pin: string }
 *
 * Creates a new embedded wallet with Shamir secret sharing
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"
import { createEmbeddedWallet, validatePIN } from "@/lib/auth/embedded-wallet"

export async function POST(request: NextRequest) {
  try {
    // Check session
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pin } = await request.json()

    // Validate PIN
    const pinValidation = validatePIN(pin)
    if (!pinValidation.valid) {
      return NextResponse.json({ error: pinValidation.error }, { status: 400 })
    }

    // Check if user already has a wallet
    const existingWallet = await prisma.embeddedWallet.findFirst({
      where: { user_id: session.userId },
      select: { id: true },
    })

    if (existingWallet) {
      return NextResponse.json({ error: "Wallet already exists" }, { status: 400 })
    }

    // Create wallet with Shamir secret sharing
    const walletResult = await createEmbeddedWallet(pin)

    // Store wallet in database (server share only)
    try {
      await prisma.embeddedWallet.create({
        data: {
          user_id: session.userId,
          address: walletResult.address,
          server_share_encrypted: walletResult.shares.serverShare.encrypted,
          server_share_iv: walletResult.shares.serverShare.iv,
          recovery_share: walletResult.shares.recoveryShare.encrypted,
          recovery_iv: walletResult.shares.recoveryShare.iv,
          salt: walletResult.shares.salt,
          chain_type: "EVM",
          is_primary: true,
        },
      })
    } catch (insertError) {
      console.error("[Auth] Failed to store wallet:", insertError)
      return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 })
    }

    // Return device share and mnemonic (client stores device share in IndexedDB)
    // Mnemonic and recovery code shown once for backup
    return NextResponse.json({
      success: true,
      address: walletResult.address,
      deviceShare: walletResult.shares.deviceShare,
      salt: walletResult.shares.salt,
      mnemonic: walletResult.mnemonic, // Show once for backup
      recoveryCode: walletResult.recoveryCode, // Show once for backup
    })
  } catch (error) {
    console.error("[Auth] Wallet creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
