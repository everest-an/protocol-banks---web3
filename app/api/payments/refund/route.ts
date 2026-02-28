import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import { recordTransfer, generateIdempotencyKey } from "@/lib/services/ledger-service"

/**
 * POST /api/payments/refund
 *
 * Create a refund for a completed payment.
 * - Full or partial refund supported
 * - Creates reverse ledger entries (CREDIT sender, DEBIT receiver)
 * - Links to original payment via reference_id
 * - Requires original payment to be "completed"
 */
export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { paymentId, amount, reason } = body

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing required field: paymentId" },
        { status: 400 }
      )
    }

    // Find original payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Only the sender can initiate a refund
    if (payment.from_address.toLowerCase() !== callerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: Only the payment sender can initiate a refund" },
        { status: 403 }
      )
    }

    if (payment.status !== "completed") {
      return NextResponse.json(
        { error: `Cannot refund payment with status '${payment.status}'. Only 'completed' payments can be refunded.` },
        { status: 400 }
      )
    }

    // Determine refund amount (full or partial)
    const originalAmount = Number(payment.amount)
    const refundAmount = amount ? Math.min(Number(amount), originalAmount) : originalAmount

    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: "Refund amount must be positive" },
        { status: 400 }
      )
    }

    // Check for existing refunds on this payment
    const existingRefunds = await prisma.payment.findMany({
      where: {
        memo: { contains: `refund:${paymentId}` },
        status: { in: ["completed", "pending"] },
      },
    })

    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    )

    if (totalRefunded + refundAmount > originalAmount) {
      return NextResponse.json(
        {
          error: `Refund would exceed original amount. Original: ${originalAmount}, already refunded: ${totalRefunded}, requested: ${refundAmount}`,
        },
        { status: 400 }
      )
    }

    // Create refund payment record (reverse direction)
    const refundPayment = await prisma.payment.create({
      data: {
        from_address: payment.to_address,
        to_address: payment.from_address,
        amount: String(refundAmount),
        token: payment.token,
        token_symbol: payment.token_symbol,
        chain: payment.chain,
        chain_id: payment.chain_id,
        network_type: payment.network_type,
        status: "pending",
        type: "refund",
        method: "refund",
        created_by: callerAddress,
        category: "refund",
        memo: `refund:${paymentId}${reason ? ` - ${reason}` : ""}`,
        vendor_id: payment.vendor_id,
      },
    })

    // Record reverse ledger entries
    try {
      await recordTransfer({
        idempotencyKey: generateIdempotencyKey("refund", paymentId, refundPayment.id),
        fromAddress: payment.to_address, // Receiver returns funds
        toAddress: payment.from_address, // Sender gets refund
        amount: refundAmount,
        token: payment.token,
        chain: payment.chain,
        category: "refund",
        referenceType: "refund",
        referenceId: refundPayment.id,
        description: `Refund for payment ${paymentId}${reason ? `: ${reason}` : ""}`,
        metadata: {
          original_payment_id: paymentId,
          refund_type: refundAmount === originalAmount ? "full" : "partial",
        },
      })
    } catch (ledgerError) {
      // Ledger recording failure is non-fatal - refund still created
      console.warn("[Refund] Ledger entry failed:", ledgerError)
    }

    // Update original payment status if fully refunded
    if (totalRefunded + refundAmount >= originalAmount) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "refunded" },
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "payment.refund",
        actor: callerAddress,
        target_type: "payment",
        target_id: paymentId,
        details: {
          refund_payment_id: refundPayment.id,
          refund_amount: refundAmount,
          original_amount: originalAmount,
          total_refunded: totalRefunded + refundAmount,
          reason,
          refund_type: refundAmount === originalAmount ? "full" : "partial",
        },
      },
    })

    return NextResponse.json({
      success: true,
      refund: {
        id: refundPayment.id,
        originalPaymentId: paymentId,
        amount: refundAmount,
        token: payment.token,
        chain: payment.chain,
        type: refundAmount === originalAmount ? "full" : "partial",
        status: "pending",
        totalRefunded: totalRefunded + refundAmount,
        remainingRefundable: originalAmount - totalRefunded - refundAmount,
      },
    })
  } catch (error: unknown) {
    console.error("[API] POST /api/payments/refund error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'payments-refund' })
