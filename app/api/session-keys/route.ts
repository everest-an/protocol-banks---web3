/**
 * Session Keys API
 * GET /api/session-keys - List session keys for the authenticated user
 * POST /api/session-keys - Create a new session key
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { encryptSessionKey } from "@/lib/security/encryption"

interface CreateSessionKeyRequest {
  chain_id: number
  spending_limit: string
  allowed_tokens?: string[]
  expires_at: string
}

// GET - List session keys
export const GET = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    // Fetch session keys
    const sessionKeys = await prisma.sessionKey.findMany({
      where: { owner_address: walletAddress.toLowerCase() },
      orderBy: { created_at: "desc" },
    })

    // Map data to safe response (never return encrypted_key)
    const safeKeys = sessionKeys.map((key) => ({
      id: key.id,
      owner_address: key.owner_address,
      session_key_address: key.session_address,
      chain_id: key.chain_id,
      spending_limit: key.spending_limit,
      spent_amount: key.amount_spent,
      allowed_tokens: key.allowed_tokens,
      expires_at: key.expires_at,
      is_active: key.is_active,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
    }))

    return NextResponse.json({
      success: true,
      sessionKeys: safeKeys,
    })
  } catch (error) {
    console.error("[SessionKeys] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}, { component: 'session-keys' })

// POST - Create session key
export const POST = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    // Parse request body
    const body: CreateSessionKeyRequest = await request.json()

    // Validate required fields
    if (!body.chain_id || !body.spending_limit || !body.expires_at) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: chain_id, spending_limit, expires_at" },
        { status: 400 }
      )
    }

    // Generate new session key
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)

    // Encrypt the private key with AES-256-GCM before storing
    const encryptedPrivateKey = encryptSessionKey(privateKey)

    // Insert session key
    const sessionKey = await prisma.sessionKey.create({
      data: {
        owner_address: walletAddress.toLowerCase(),
        session_address: account.address.toLowerCase(),
        encrypted_key: encryptedPrivateKey,
        chain_id: body.chain_id,
        spending_limit: body.spending_limit,
        amount_spent: "0",
        allowed_tokens: body.allowed_tokens || [],
        expires_at: new Date(body.expires_at),
        is_active: true,
      },
    })

    // Return safe response (never return encrypted_key)
    return NextResponse.json({
      success: true,
      sessionKey: {
        id: sessionKey.id,
        owner_address: sessionKey.owner_address,
        session_key_address: sessionKey.session_address,
        chain_id: sessionKey.chain_id,
        spending_limit: sessionKey.spending_limit,
        spent_amount: sessionKey.amount_spent,
        allowed_tokens: sessionKey.allowed_tokens,
        expires_at: sessionKey.expires_at,
        is_active: sessionKey.is_active,
        created_at: sessionKey.created_at,
      },
    })
  } catch (error) {
    console.error("[SessionKeys] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}, { component: 'session-keys' })
