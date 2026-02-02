import { type NextRequest, NextResponse } from "next/server"
import { splitPaymentService } from "@/lib/services/split-payment-service"
import type {
  SplitPaymentRequest,
  SplitRecipient,
  AllocationMethod,
} from "@/types/split-payment"

/**
 * POST /api/split-payment/preview
 * Preview split payment calculation without executing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { totalAmount, token, method, recipients, options } = body

    // Validate required fields
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: "totalAmount must be greater than 0" },
        { status: 400 }
      )
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "recipients array required" },
        { status: 400 }
      )
    }

    if (!method || !["percentage", "fixed"].includes(method)) {
      return NextResponse.json(
        { error: "method must be 'percentage' or 'fixed'" },
        { status: 400 }
      )
    }

    // Build split payment request
    const splitRecipients: SplitRecipient[] = recipients.map((r: any) => ({
      address: r.address,
      allocation: Number(r.allocation || r.percentage || r.amount),
      name: r.name,
      memo: r.memo,
    }))

    const splitRequest: SplitPaymentRequest = {
      totalAmount: Number(totalAmount),
      token: token || "USDC",
      method: method as AllocationMethod,
      recipients: splitRecipients,
    }

    // Preview calculation
    const preview = splitPaymentService.preview(splitRequest, options)

    return NextResponse.json({
      success: preview.validation.valid,
      validation: preview.validation,
      calculation: preview.calculation,
      fees: preview.fees,
      summary: preview.calculation
        ? {
            totalAmount: preview.calculation.totalAmount,
            allocatedTotal: preview.calculation.allocatedTotal,
            roundingDifference: preview.calculation.roundingDifference,
            recipientCount: preview.calculation.recipients.length,
            estimatedFees: preview.fees?.platformFee || 0,
            estimatedGas: preview.fees?.estimatedGasFee || 0,
          }
        : null,
    })
  } catch (error: any) {
    console.error("[SplitPayment] Preview error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to preview split payment" },
      { status: 500 }
    )
  }
}
