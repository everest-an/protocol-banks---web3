/**
 * Batch Payout API Route
 *
 * Handles batch payment requests, routing to Go service or TypeScript
 * based on feature flags. Uses TypeScript service layer for validation.
 */

import { type NextRequest, NextResponse } from "next/server"
import { submitBatchPayment, getBatchPaymentStatus } from "@/lib/grpc/payout-bridge"
import { verifySession } from "@/lib/auth/session"
import {
  validateBatch,
  findDuplicateRecipients,
  calculateBatchFees,
  formatFee,
  logFeeDistribution,
  type BatchPaymentItem,
} from "@/backend"

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { senderAddress, recipients, useMultisig, multisigWalletId, priority, chainId = "base" } = body

    // Validate request
    if (!senderAddress || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Invalid request: senderAddress and recipients are required" }, { status: 400 })
    }

    // Convert to BatchPaymentItem for validation
    const batchItems: BatchPaymentItem[] = recipients.map((r: any) => ({
      recipient: r.address,
      amount: r.amount,
      token: r.token,
    }))

    // Use TypeScript service layer for validation
    const validationResult = validateBatch(batchItems)
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.errors,
        },
        { status: 400 },
      )
    }

    // Check for duplicate recipients
    const duplicates = findDuplicateRecipients(batchItems)
    if (duplicates.length > 0) {
      console.warn("[API] Duplicate recipients detected:", duplicates)
    }

    // Calculate fees using fee service
    const amounts = recipients.map((r: any) => r.amount)
    const feeBreakdown = calculateBatchFees(amounts, chainId)
    console.log("[API] Fee breakdown:", {
      totalAmount: formatFee(feeBreakdown.totalAmount),
      totalFees: formatFee(feeBreakdown.totalFees),
      netAmount: formatFee(feeBreakdown.totalNetAmount),
    })

    // Submit batch payment
    const result = await submitBatchPayment(session.userId, senderAddress, recipients, {
      useMultisig,
      multisigWalletId,
      priority,
    })

    // Log fee distribution for completed payments
    if (result.status === "completed" || result.status === "partial_failure") {
      logFeeDistribution({
        totalFee: feeBreakdown.totalAmount,
        protocolFee: feeBreakdown.totalFees,
        relayerFee: 0,
        networkFee: 0,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      ...result,
      feeBreakdown: {
        totalAmount: formatFee(feeBreakdown.totalAmount),
        totalFees: formatFee(feeBreakdown.totalFees),
        netAmount: formatFee(feeBreakdown.totalNetAmount),
      },
      duplicateWarnings: duplicates.length > 0 ? duplicates : undefined,
    })
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
