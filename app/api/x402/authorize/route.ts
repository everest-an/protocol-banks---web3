import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

/**
 * x402 Protocol - Payment Authorization Endpoint
 *
 * This endpoint handles HTTP 402 Payment Required authorization.
 * It generates and verifies payment authorizations for gasless transactions.
 */

export interface X402AuthorizationRequest {
  from: string
  to: string
  amount: string
  token: string
  chainId: number
  validAfter?: number
  validBefore?: number
  nonce?: string
}

export interface X402AuthorizationResponse {
  success: boolean
  authorization?: {
    signature: string
    nonce: string
    validAfter: number
    validBefore: number
    transferId: string
  }
  error?: string
}

// Generate a cryptographically secure nonce
function generateNonce(): string {
  return `0x${crypto.randomBytes(32).toString("hex")}`
}

// Generate transfer ID
function generateTransferId(): string {
  return `x402_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`
}

export async function POST(request: NextRequest): Promise<NextResponse<X402AuthorizationResponse>> {
  try {
    const body = await request.json() as X402AuthorizationRequest
    const { from, to, amount, token, chainId, validAfter, validBefore } = body

    // Validate required fields
    if (!from || !to || !amount || !token || !chainId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: from, to, amount, token, chainId" },
        { status: 400 }
      )
    }

    // Validate addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!addressRegex.test(from) || !addressRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: "Invalid Ethereum address format" },
        { status: 400 }
      )
    }

    // Validate amount
    const amountNum = Number.parseFloat(amount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      )
    }

    // Generate authorization parameters
    const nonce = body.nonce || generateNonce()
    const transferId = generateTransferId()
    const now = Math.floor(Date.now() / 1000)
    const authValidAfter = validAfter || now
    const authValidBefore = validBefore || now + 3600 // 1 hour validity

    // Store authorization in database for verification
    try {
      await prisma.x402Authorization.create({
        data: {
          proposal_id: transferId,
          network: `evm-${chainId}`,
          payment_address: to.toLowerCase(),
          from_address: from.toLowerCase(),
          amount,
          token,
          chain_id: chainId,
          nonce,
          valid_after: new Date(authValidAfter * 1000),
          valid_before: new Date(authValidBefore * 1000),
          status: "pending",
          transfer_id: transferId,
          expires_at: new Date(authValidBefore * 1000),
        },
      })
    } catch (dbError) {
      console.error("[x402] Database error:", dbError)
      // Continue even if DB fails - authorization can still work
    }

    // The authorization message follows EIP-3009 transferWithAuthorization.
    // The SERVER returns the structured message; the CLIENT signs it with their
    // wallet private key and submits the signature to POST /api/x402/execute.
    const messageToSign = {
      from,
      to,
      amount,
      token,
      chainId,
      nonce,
      validAfter: authValidAfter,
      validBefore: authValidBefore,
      transferId,
    }

    return NextResponse.json({
      success: true,
      authorization: {
        signature: "",  // filled by client wallet after signing messageToSign
        nonce,
        validAfter: authValidAfter,
        validBefore: authValidBefore,
        transferId,
        messageToSign,
      },
    })
  } catch (error) {
    console.error("[x402] Authorization error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const transferId = searchParams.get("transferId")

  if (!transferId) {
    return NextResponse.json(
      { success: false, error: "Missing transferId parameter" },
      { status: 400 }
    )
  }

  try {
    const data = await prisma.x402Authorization.findFirst({
      where: { transfer_id: transferId },
    })

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Authorization not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      authorization: {
        transferId: data.transfer_id,
        from: data.from_address,
        to: data.payment_address,
        amount: data.amount,
        token: data.token,
        chainId: data.chain_id,
        status: data.status,
        nonce: data.nonce,
        validAfter: new Date(data.valid_after).getTime() / 1000,
        validBefore: new Date(data.valid_before).getTime() / 1000,
        txHash: data.tx_hash,
      },
    })
  } catch (error) {
    console.error("[x402] Get authorization error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
