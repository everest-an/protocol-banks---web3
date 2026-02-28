import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import { executeBatch } from "@/lib/services/batch-execution-worker"
import { getBatchItems } from "@/lib/services/batch-item-service"

// Base chain ID for CDP settlement (0 fee)
const BASE_CHAIN_ID = 8453

/**
 * POST /api/batch-payment/execute
 * Execute a pending batch payment using the concurrent BatchItem engine.
 * Each recipient is tracked individually with retry support.
 */
export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { batchId, chainId } = body

    if (!batchId) {
      return NextResponse.json({ error: "batchId required" }, { status: 400 })
    }

    // Get batch details
    const batch = await prisma.batchPayment.findUnique({
      where: { batch_id: batchId },
    })

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    // Security: Only the batch owner can execute
    if (batch.from_address.toLowerCase() !== callerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (batch.status === "completed") {
      return NextResponse.json(
        { error: "Batch already completed" },
        { status: 400 }
      )
    }

    // Determine settlement method
    const effectiveChainId = chainId || batch.chain_id || BASE_CHAIN_ID
    const isBaseChain = effectiveChainId === BASE_CHAIN_ID
    const settlementMethod = isBaseChain ? "CDP" : "RELAYER"
    const fee = isBaseChain ? 0 : batch.total_amount * 0.001

    // Execute batch using the concurrent worker engine
    const result = await executeBatch(
      batchId,
      callerAddress,
      batch.network_type || "EVM"
    )

    // Get detailed item results
    const { items, summary } = await getBatchItems(batchId)

    // Update batch with fee info
    await prisma.batchPayment.update({
      where: { batch_id: batchId },
      data: {
        fee,
        settlement_method: settlementMethod,
      },
    })

    return NextResponse.json({
      success: true,
      batchId,
      execution: result,
      items,
      summary: {
        ...summary,
        fee,
        netAmount: Number(summary.completedAmount) - fee,
        settlementMethod,
      },
      message: isBaseChain
        ? `Batch executed via CDP (0 fee) - ${result.completed}/${result.totalItems} successful`
        : `Batch executed via Relayer (fee: ${fee.toFixed(6)}) - ${result.completed}/${result.totalItems} successful`,
    })
  } catch (error: any) {
    console.error("[BatchPayment] Execute error:", error)
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 })
  }
}, { component: 'batch-payment-execute' })
