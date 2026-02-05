import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBatch, calculateBatchTotals, type BatchPaymentItem } from "@/lib/services"
import { getAuthenticatedAddress } from "@/lib/api-auth"

/**
 * POST /api/batch-payment
 * Create a new batch payment job
 */
export async function POST(request: NextRequest) {
  try {
    const callerAddress = await getAuthenticatedAddress(request);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json()
    const { recipients, token, chainId, fromAddress: bodyFromAddress, memo } = body

    // Enforce fromAddress matches caller
    const fromAddress = callerAddress;

    if (bodyFromAddress && bodyFromAddress.toLowerCase() !== callerAddress.toLowerCase()) {
         return NextResponse.json({ error: "Forbidden: Cannot create batch for another address" }, { status: 403 })
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients array required" }, { status: 400 })
    }

    // Validate batch
    const items: BatchPaymentItem[] = recipients.map((r: any, idx: number) => ({
      id: `item_${idx}`,
      recipient: r.address || r.recipient,
      amount: Number.parseFloat(r.amount),
      token: r.token || token || "USDC",
      memo: r.memo || memo,
    }))

    const validation = validateBatch(items)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 },
      )
    }

    // Calculate totals
    const totals = calculateBatchTotals(items)

    // Create batch job in database
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    try {
      await prisma.batchPayment.create({
        data: {
          batch_id: batchId,
          from_address: fromAddress.toLowerCase(),
          total_amount: totals.totalAmount,
          total_items: totals.itemCount,
          token: token || "USDC",
          chain_id: chainId || 8453,
          status: "pending",
          items: items as any,
          memo,
        },
      })
    } catch (dbError: any) {
      console.error("[BatchPayment] DB error:", dbError)
      return NextResponse.json(
        {
          error: "Failed to save batch to database",
          details: dbError.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      batchId,
      totals,
      itemCount: items.length,
      status: "pending",
      message: `Batch created with ${items.length} payments totaling ${totals.totalAmount} ${token || "USDC"}`,
    })
  } catch (error: any) {
    console.error("[BatchPayment] Create error:", error)
    return NextResponse.json({ error: error.message || "Failed to create batch" }, { status: 500 })
  }
}

/**
 * GET /api/batch-payment?batchId=xxx
 * Get batch payment status
 */
export async function GET(request: NextRequest) {
  try {
    const callerAddress = await getAuthenticatedAddress(request);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get("batchId")
    const fromAddressParam = searchParams.get("fromAddress")

    if (batchId) {
      // Get specific batch
      const batch = await prisma.batchPayment.findUnique({
        where: { batch_id: batchId },
      })

      if (!batch) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 })
      }

      // Security: Ensure the batch belongs to the caller
      if (batch.from_address.toLowerCase() !== callerAddress.toLowerCase()) {
         return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      return NextResponse.json({ batch })
    }

    // Default to caller address if fromAddress not specific (or enforce it matches)
    const targetAddress = callerAddress;

    if (fromAddressParam && fromAddressParam.toLowerCase() !== callerAddress.toLowerCase()) {
         return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (targetAddress) {
      // Get all batches for address
      try {
        const batches = await prisma.batchPayment.findMany({
          where: { from_address: targetAddress.toLowerCase() },
          orderBy: { created_at: "desc" },
          take: 50,
        })

        return NextResponse.json({ batches: batches || [] })
      } catch (error) {
        console.error("[BatchPayment] Query error:", error)
        return NextResponse.json({ batches: [] })
      }
    }

    return NextResponse.json({ error: "batchId or fromAddress required" }, { status: 400 })
  } catch (error: any) {
    console.error("[BatchPayment] Get error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
