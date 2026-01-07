/**
 * Batch Payout API Route
 *
 * Handles batch payment requests, routing to Go service or TypeScript
 * based on feature flags.
 */

import { type NextRequest, NextResponse } from "next/server"
import { submitBatchPayment, getBatchPaymentStatus } from "@/lib/grpc/payout-bridge"
import { verifySession } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { senderAddress, recipients, useMultisig, multisigWalletId, priority } = body

    // Validate request
    if (!senderAddress || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Invalid request: senderAddress and recipients are required" }, { status: 400 })
    }

    // Validate each recipient
    for (const recipient of recipients) {
      if (!recipient.address || !recipient.amount || !recipient.token) {
        return NextResponse.json(
          { error: "Invalid recipient: address, amount, and token are required" },
          { status: 400 },
        )
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient.address)) {
        return NextResponse.json({ error: `Invalid address format: ${recipient.address}` }, { status: 400 })
      }
    }

    // Submit batch payment
    const result = await submitBatchPayment(session.userId, senderAddress, recipients, {
      useMultisig,
      multisigWalletId,
      priority,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Batch payout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get("batchId")

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 })
    }

    const status = await getBatchPaymentStatus(batchId, session.userId)

    if (!status) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("[API] Get batch status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
