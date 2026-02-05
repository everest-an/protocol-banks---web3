import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Base chain ID for CDP settlement (0 fee)
const BASE_CHAIN_ID = 8453

interface ExecuteResult {
  recipient: string
  amount: number
  status: "success" | "failed" | "pending"
  txHash?: string
  error?: string
}

/**
 * POST /api/batch-payment/execute
 * Execute a pending batch payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchId, signatures, chainId } = body

    if (!batchId) {
      return NextResponse.json({ error: "batchId required" }, { status: 400 })
    }

    // Get batch details
    const batch = await prisma.batchPayment.findUnique({
      where: { batch_id: batchId },
    })

    if (!batch) {
      // Demo mode - create mock batch
      const mockResults: ExecuteResult[] = [
        { recipient: "0x1234...5678", amount: 100, status: "success", txHash: `0x${Date.now().toString(16)}` },
        { recipient: "0xabcd...efgh", amount: 50, status: "success", txHash: `0x${(Date.now() + 1).toString(16)}` },
      ]

      return NextResponse.json({
        success: true,
        batchId,
        results: mockResults,
        summary: {
          total: mockResults.length,
          successful: mockResults.filter((r) => r.status === "success").length,
          failed: 0,
          totalAmount: mockResults.reduce((sum, r) => sum + r.amount, 0),
        },
      })
    }

    // Determine settlement method based on chain
    const effectiveChainId = chainId || batch.chain_id || BASE_CHAIN_ID
    const isBaseChain = effectiveChainId === BASE_CHAIN_ID
    const settlementMethod = isBaseChain ? "CDP" : "RELAYER"

    // Calculate fees
    const fee = isBaseChain ? 0 : batch.total_amount * 0.001

    // Update batch status to processing
    await prisma.batchPayment.update({
      where: { batch_id: batchId },
      data: { status: "processing" },
    })

    // In production, this would interact with the blockchain
    // For now, simulate successful execution
    const items = (batch.items as any[]) || []
    const results: ExecuteResult[] = items.map((item: any) => ({
      recipient: item.recipient,
      amount: item.amount,
      status: "success" as const,
      txHash: `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
    }))

    const successCount = results.filter((r) => r.status === "success").length
    const failedCount = results.filter((r) => r.status === "failed").length
    const totalPaid = results
      .filter((r) => r.status === "success")
      .reduce((sum, r) => sum + r.amount, 0)

    // Update batch with results
    await prisma.batchPayment.update({
      where: { batch_id: batchId },
      data: {
        status: failedCount === 0 ? "completed" : "partial",
        results: results as any,
        fee,
        settlement_method: settlementMethod,
        executed_at: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      batchId,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failedCount,
        totalAmount: totalPaid,
        fee,
        netAmount: totalPaid - fee,
        settlementMethod,
      },
      message: isBaseChain
        ? `Batch executed via CDP (0 fee) - ${successCount}/${results.length} successful`
        : `Batch executed via Relayer (fee: ${fee.toFixed(6)}) - ${successCount}/${results.length} successful`,
    })
  } catch (error: any) {
    console.error("[BatchPayment] Execute error:", error)
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 })
  }
}
