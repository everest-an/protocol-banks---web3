import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { createEmbeddedWallet, validatePIN } from "@/lib/auth/embedded-wallet"
import { hashPin } from "@/lib/auth/pin"
import { sha256 } from "@/lib/auth/crypto"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pin } = await request.json()

    const pinValidation = validatePIN(pin)
    if (!pinValidation.valid) {
      return NextResponse.json({ error: pinValidation.error }, { status: 400 })
    }

    const supabase = await createClient()

    // Ensure user exists and has not set a PIN yet
    const { data: user, error: userError } = await supabase
      .from("auth_users")
      .select("id, status, pin_hash")
      .eq("id", session.userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.pin_hash) {
      return NextResponse.json({ error: "PIN already set" }, { status: 400 })
    }

    // Prevent duplicate wallet creation
    const { data: existingWallet } = await supabase
      .from("embedded_wallets")
      .select("id")
      .eq("user_id", session.userId)
      .maybeSingle()

    if (existingWallet) {
      return NextResponse.json({ error: "Wallet already exists" }, { status: 400 })
    }

    // Create wallet + shares
    const walletResult = await createEmbeddedWallet(pin)
    const normalizedMnemonic = walletResult.mnemonic.trim().toLowerCase().replace(/\s+/g, " ")
    const recoveryHash = await sha256(normalizedMnemonic)

    // Store wallet on server (Share B + encrypted recovery + metadata)
    const { error: insertError } = await supabase.from("embedded_wallets").insert({
      user_id: session.userId,
      address: walletResult.address,
      wallet_address: walletResult.address,
      public_key: walletResult.publicKey,
      chain_id: 1,
      share_a_encrypted: walletResult.shares.deviceShare.encrypted,
      share_a_iv: walletResult.shares.deviceShare.iv,
      share_b_encrypted: walletResult.shares.serverShare.encrypted,
      share_b_iv: walletResult.shares.serverShare.iv,
      share_c_recovery: walletResult.shares.encryptedMnemonic.ciphertext,
      share_c_iv: walletResult.shares.encryptedMnemonic.iv,
      recovery_phrase_hash: recoveryHash,
      server_share_encrypted: walletResult.shares.serverShare.encrypted,
      server_share_iv: walletResult.shares.serverShare.iv,
      recovery_share_encrypted: walletResult.shares.recoveryShare.encrypted,
      recovery_share_iv: walletResult.shares.recoveryShare.iv,
      salt: walletResult.shares.salt,
      chain_type: "EVM",
      is_primary: true,
    })

    if (insertError) {
      console.error("[Auth] Failed to store wallet:", insertError)
      return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 })
    }

    // Hash PIN and update user status
    const pinHash = await hashPin(pin)
    const { error: updateError } = await supabase
      .from("auth_users")
      .update({ pin_hash: pinHash, status: "pin_set", email_verified: true })
      .eq("id", session.userId)

    if (updateError) {
      console.error("[Auth] Failed to update user PIN:", updateError)
      return NextResponse.json({ error: "Failed to update PIN" }, { status: 500 })
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: session.userId,
      action: "pin_set",
      details: { address: walletResult.address },
    })

    return NextResponse.json({
      success: true,
      walletAddress: walletResult.address,
      recoveryPhrase: walletResult.mnemonic,
      deviceShare: walletResult.shares.deviceShare,
      salt: walletResult.shares.salt,
      nextStep: "confirm_recovery",
    })
  } catch (error) {
    console.error("[Auth] Setup PIN error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
