/**
 * Session Keys API
 * GET /api/session-keys - List session keys for the authenticated user
 * POST /api/session-keys - Create a new session key
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

interface CreateSessionKeyRequest {
  chain_id: number
  spending_limit: string
  allowed_tokens?: string[]
  expires_at: string
}

// GET - List session keys
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get owner_address from user metadata or query auth_users
    const { data: authUser } = await supabase
      .from("auth_users")
      .select("wallet_address")
      .eq("id", user.id)
      .single()

    const ownerAddress = authUser?.wallet_address
    if (!ownerAddress) {
      return NextResponse.json({ success: false, error: "No wallet associated" }, { status: 400 })
    }

    // Fetch session keys
    const { data: sessionKeys, error } = await supabase
      .from("session_keys")
      .select("*")
      .eq("owner_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[SessionKeys] Failed to fetch:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch session keys" }, { status: 500 })
    }

    // Map data to safe response (never return encrypted_private_key)
    const safeKeys = (sessionKeys || []).map((key) => ({
      id: key.id,
      owner_address: key.owner_address,
      session_key_address: key.session_key_address,
      chain_id: key.chain_id,
      spending_limit: key.spending_limit,
      spent_amount: key.spent_amount,
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
}

// POST - Create session key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get owner_address from user metadata or query auth_users
    const { data: authUser } = await supabase
      .from("auth_users")
      .select("wallet_address")
      .eq("id", user.id)
      .single()

    const ownerAddress = authUser?.wallet_address
    if (!ownerAddress) {
      return NextResponse.json({ success: false, error: "No wallet associated" }, { status: 400 })
    }

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

    // In production, encrypt the private key before storing
    // For now, we'll store it as-is (should use proper encryption)
    const encryptedPrivateKey = privateKey // TODO: Encrypt with user's PIN or master key

    // Insert session key
    const { data: sessionKey, error } = await supabase
      .from("session_keys")
      .insert({
        owner_address: ownerAddress.toLowerCase(),
        session_key_address: account.address.toLowerCase(),
        encrypted_private_key: encryptedPrivateKey,
        chain_id: body.chain_id,
        spending_limit: body.spending_limit,
        spent_amount: "0",
        allowed_tokens: body.allowed_tokens || [],
        expires_at: body.expires_at,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[SessionKeys] Failed to create:", error)
      return NextResponse.json({ success: false, error: "Failed to create session key" }, { status: 500 })
    }

    // Return safe response (never return encrypted_private_key)
    return NextResponse.json({
      success: true,
      sessionKey: {
        id: sessionKey.id,
        owner_address: sessionKey.owner_address,
        session_key_address: sessionKey.session_key_address,
        chain_id: sessionKey.chain_id,
        spending_limit: sessionKey.spending_limit,
        spent_amount: sessionKey.spent_amount,
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
}
