/**
 * POST /api/auth/siwe/verify
 *
 * Verify a SIWE signature from an AI agent. On success, returns a JWT
 * access token (1h) and a refresh token (30d).
 *
 * Request body:
 *   { message: string, signature: string }
 *
 * Response:
 *   { token, refreshToken, expiresAt, address }
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  verifySiweSignature,
  parseSiweMessage,
  consumeNonce,
} from "@/lib/auth/siwe"
import {
  signJwt,
  generateRefreshToken,
  hashToken,
  getTokenExpiries,
} from "@/lib/auth/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, signature } = body

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: message, signature" },
        { status: 400 }
      )
    }

    // 1. Parse the SIWE message to extract fields
    const parsed = parseSiweMessage(message)
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid SIWE message format" },
        { status: 400 }
      )
    }

    // 2. Consume the nonce (single-use, prevents replay)
    const nonceValid = await consumeNonce(parsed.nonce)
    if (!nonceValid) {
      return NextResponse.json(
        { error: "Invalid, expired, or already-used nonce" },
        { status: 401 }
      )
    }

    // 3. Verify the cryptographic signature
    const recoveredAddress = await verifySiweSignature(
      message,
      signature as `0x${string}`
    )
    if (!recoveredAddress) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      )
    }

    // 4. Issue JWT access token
    const { token, expiresAt } = await signJwt(recoveredAddress)

    // 5. Generate refresh token
    const refreshToken = generateRefreshToken()
    const { refreshExpiresAt } = getTokenExpiries()

    // 6. Store session in DB (hashed tokens for security)
    const [tokenHash, refreshHash] = await Promise.all([
      hashToken(token),
      hashToken(refreshToken),
    ])

    await prisma.aiSession.create({
      data: {
        wallet_address: recoveredAddress,
        token_hash: tokenHash,
        refresh_hash: refreshHash,
        expires_at: new Date(expiresAt),
        refresh_expires: refreshExpiresAt,
        user_agent: request.headers.get("user-agent") || undefined,
        ip_address: request.headers.get("x-forwarded-for") || undefined,
      },
    })

    return NextResponse.json({
      token,
      refreshToken,
      expiresAt,
      address: recoveredAddress,
    })
  } catch (error) {
    console.error("[SIWE Verify] Error:", error)
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    )
  }
}
