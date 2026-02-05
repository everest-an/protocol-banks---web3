import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * x402 Protocol - Payment Verification Endpoint
 *
 * Verifies that a payment authorization has been executed on-chain.
 */

export interface X402VerifyRequest {
  transferId: string
  txHash: string
  signature?: string
}

export interface X402VerifyResponse {
  success: boolean
  verified: boolean
  status?: "pending" | "completed" | "failed" | "expired"
  message?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<X402VerifyResponse>> {
  try {
    const body = await request.json() as X402VerifyRequest
    const { transferId, txHash } = body

    if (!transferId || !txHash) {
      return NextResponse.json(
        { success: false, verified: false, error: "Missing transferId or txHash" },
        { status: 400 }
      )
    }

    // Validate txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { success: false, verified: false, error: "Invalid transaction hash format" },
        { status: 400 }
      )
    }

    // Get the authorization
    const auth = await prisma.x402Authorization.findFirst({
      where: { transfer_id: transferId },
    })

    if (!auth) {
      return NextResponse.json(
        { success: false, verified: false, error: "Authorization not found" },
        { status: 404 }
      )
    }

    // Check if already verified
    if (auth.status === "completed" && auth.tx_hash) {
      return NextResponse.json({
        success: true,
        verified: true,
        status: "completed",
        message: "Payment already verified",
      })
    }

    // Check if expired
    const now = new Date()
    const validBefore = new Date(auth.valid_before)
    if (now > validBefore) {
      await prisma.x402Authorization.update({
        where: { id: auth.id },
        data: { status: "expired" },
      })

      return NextResponse.json({
        success: true,
        verified: false,
        status: "expired",
        message: "Authorization has expired",
      })
    }

    // Update authorization with transaction hash and mark as completed
    try {
      await prisma.x402Authorization.update({
        where: { id: auth.id },
        data: {
          tx_hash: txHash,
          status: "completed",
        },
      })
    } catch (updateError) {
      console.error("[x402] Update error:", updateError)
      return NextResponse.json(
        { success: false, verified: false, error: "Failed to update authorization" },
        { status: 500 }
      )
    }

    // Log the successful payment
    try {
      await prisma.paymentLog.create({
        data: {
          type: "x402_payment",
          transfer_id: transferId,
          from_address: auth.from_address,
          to_address: auth.payment_address,
          amount: auth.amount,
          token: auth.token,
          chain_id: auth.chain_id,
          tx_hash: txHash,
          status: "completed",
        },
      })
    } catch (err) {
      console.error("[x402] Failed to log payment:", err)
    }

    return NextResponse.json({
      success: true,
      verified: true,
      status: "completed",
      message: "Payment verified successfully",
    })
  } catch (error) {
    console.error("[x402] Verification error:", error)
    return NextResponse.json(
      { success: false, verified: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
