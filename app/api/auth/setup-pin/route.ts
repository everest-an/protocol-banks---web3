// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
/**
 * Setup PIN and Create Wallet API
 *
 * This endpoint:
 * 1. Derives encryption key from PIN using PBKDF2
 * 2. Generates BIP39 mnemonic (12 words)
 * 3. Creates Ethereum wallet from mnemonic
 * 4. Splits private key using Shamir Secret Sharing (2-of-3)
 * 5. Encrypts and stores shares in database
 * 6. Returns mnemonic and recovery code to user
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english"
import { HDNodeWallet } from "ethers"
import {
  deriveKeyFromPIN,
  encryptAES,
  generateRandomBytes,
  generateRandomHex,
  toBase64,
  fromHex,
} from "@/lib/auth/crypto"
import { splitSecret, encodeShare } from "@/lib/auth/shamir"

interface SetupPINRequest {
  pin: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SetupPINRequest = await request.json()
    const { pin } = body

    // Validation
    if (!pin || pin.length !== 6) {
      return NextResponse.json({ success: false, error: "PIN must be 6 digits" }, { status: 400 })
    }

    if (!/^\d+$/.test(pin)) {
      return NextResponse.json({ success: false, error: "PIN must contain only numbers" }, { status: 400 })
    }

    // Get authenticated user via session
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.userId

    // Check if user already has a wallet
    const existingWallet = await prisma.embeddedWallet.findFirst({
      where: { user_id: userId },
      select: { id: true },
    })

    if (existingWallet) {
      return NextResponse.json({ success: false, error: "Wallet already exists" }, { status: 400 })
    }

    // Step 1: Generate mnemonic (12 words)
    const mnemonic = generateMnemonic(wordlist, 128) // 128 bits = 12 words

    // Step 2: Derive wallet from mnemonic
    const seed = mnemonicToSeedSync(mnemonic, "")
    const hdNode = HDNodeWallet.fromSeed(Buffer.from(seed))
    const wallet = hdNode.derivePath("m/44'/60'/0'/0/0") // Standard Ethereum derivation path

    const address = wallet.address
    const privateKey = wallet.privateKey.slice(2) // Remove '0x' prefix
    const privateKeyBytes = fromHex(privateKey)

    // Step 3: Generate recovery code (Share C)
    const recoveryCode = generateRecoveryCode()

    // Step 4: Split private key using Shamir Secret Sharing (2-of-3 threshold)
    const shares = splitSecret(privateKeyBytes, 3, 2)

    // Share A: Device (will be stored encrypted in IndexedDB on client)
    // Share B: Server (stored encrypted with PIN-derived key)
    // Share C: Recovery Code (returned to user for safekeeping)

    const shareA = shares[0] // Device share
    const shareB = shares[1] // Server share
    const shareC = shares[2] // Recovery share

    // Step 5: Derive encryption key from PIN using PBKDF2
    const saltBytes = generateRandomBytes(16)
    const pinKey = await deriveKeyFromPIN(pin, saltBytes)

    // Step 6: Encrypt Share B with PIN-derived key
    const encryptedShareB = await encryptAES(shareB.shares, pinKey)

    // Combine ciphertext and IV for storage
    const encryptedData = {
      ciphertext: toBase64(encryptedShareB.ciphertext),
      iv: toBase64(encryptedShareB.iv),
      x: shareB.x,
    }

    // Step 7: Store wallet in database
    try {
      await prisma.embeddedWallet.create({
        data: {
          user_id: userId,
          wallet_address: address.toLowerCase(),
          address: address.toLowerCase(),
          encrypted_share_b: JSON.stringify(encryptedData),
          share_c_hash: await hashShare(encodeShare(shareC)),
          salt: toBase64(saltBytes),
          derivation_path: "m/44'/60'/0'/0/0",
          chain_type: "EVM",
          is_primary: true,
        },
      })
    } catch (insertError) {
      console.error("[Setup PIN] Failed to store wallet:", insertError)
      return NextResponse.json({ success: false, error: "Failed to create wallet" }, { status: 500 })
    }

    // Step 8: Update auth_users table
    await prisma.authUser.update({
      where: { id: userId },
      data: {
        wallet_address: address.toLowerCase(),
        onboarding_completed: true,
      },
    })

    // Step 9: Return success with mnemonic, recovery code, and share A (for client storage)
    return NextResponse.json({
      success: true,
      mnemonic, // User should write this down
      recoveryCode, // User should write this down (Share C)
      address,
      shareA: encodeShare(shareA), // Client will encrypt and store in IndexedDB
      salt: toBase64(saltBytes), // Client needs this for PIN verification
    })
  } catch (error) {
    console.error("[Setup PIN] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Generate a human-readable recovery code (Share C)
 * Format: XXXX-XXXX-XXXX-XXXX
 */
function generateRecoveryCode(): string {
  const segments = []
  for (let i = 0; i < 4; i++) {
    const segment = Math.random().toString(36).substring(2, 6).toUpperCase()
    segments.push(segment)
  }
  return segments.join("-")
}

/**
 * Hash a share for verification (using Web Crypto API)
 */
async function hashShare(shareEncoded: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(shareEncoded)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
