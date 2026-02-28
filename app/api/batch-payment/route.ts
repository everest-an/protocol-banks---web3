import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBatch, calculateBatchTotals, type BatchPaymentItem } from "@/lib/services"
import { withAuth } from "@/lib/middleware/api-auth"
import { validateAddress, getNetworkForAddress } from "@/lib/address-utils"
import { ALL_NETWORKS } from "@/lib/networks"
import { createBatchItems } from "@/lib/services/batch-item-service"
import { checkIdempotency, completeIdempotency, failIdempotency } from "@/lib/services/idempotency-service"

/**
 * POST /api/batch-payment
 * Create a new batch payment job
 */
export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const {
      recipients,
      token,
      chainId,
      chain,
      network_type,
      fromAddress: bodyFromAddress,
      memo
    } = body

    // Enforce fromAddress matches caller
    const fromAddress = callerAddress;

    if (bodyFromAddress && bodyFromAddress.toLowerCase() !== callerAddress.toLowerCase()) {
         return NextResponse.json({ error: "Forbidden: Cannot create batch for another address" }, { status: 403 })
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients array required" }, { status: 400 })
    }

    // Idempotency check
    const idempotencyKey = request.headers.get("idempotency-key")
    if (idempotencyKey) {
      try {
        const idempResult = await checkIdempotency(idempotencyKey, callerAddress, "/api/batch-payment", { recipients: recipients.length, token, chain })
        if (idempResult.isDuplicate && idempResult.existingResponse) {
          return NextResponse.json(idempResult.existingResponse.body, { status: idempResult.existingResponse.statusCode })
        }
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
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

    // Auto-detect network from first recipient if not provided
    let finalChain = chain
    let finalNetworkType = network_type
    let finalChainId = chainId

    if (!finalChain && items.length > 0) {
      try {
        const firstRecipient = items[0].recipient
        const addressValidation = validateAddress(firstRecipient)

        if (addressValidation.isValid) {
          const detectedNetwork = getNetworkForAddress(firstRecipient)
          finalChain = detectedNetwork
          finalNetworkType = addressValidation.type === "TRON" ? "TRON" : "EVM"

          // Set chain ID for EVM networks
          if (finalNetworkType === "EVM" && ALL_NETWORKS[detectedNetwork]) {
            finalChainId = ALL_NETWORKS[detectedNetwork].chainId
          }
        }
      } catch (error) {
        // If detection fails, use defaults
        finalChain = finalChain || "base"
        finalNetworkType = finalNetworkType || "EVM"
        finalChainId = finalChainId || 8453
      }
    } else {
      // Set defaults if still not provided
      finalChain = finalChain || "base"
      finalNetworkType = finalNetworkType || "EVM"
      finalChainId = finalChainId || 8453
    }

    // Validate ALL recipients match the batch network type
    const mismatchedRecipients: string[] = []
    for (let i = 0; i < items.length; i++) {
      const addrVal = validateAddress(items[i].recipient)
      if (!addrVal.isValid) {
        return NextResponse.json(
          { error: `Invalid recipient address at index ${i}: ${items[i].recipient}` },
          { status: 400 }
        )
      }
      const recipientType = addrVal.type === "TRON" ? "TRON" : "EVM"
      if (recipientType !== finalNetworkType) {
        mismatchedRecipients.push(`#${i + 1} (${items[i].recipient.slice(0, 10)}... is ${recipientType})`)
      }
    }
    if (mismatchedRecipients.length > 0) {
      return NextResponse.json(
        {
          error: `Network mismatch: batch is ${finalNetworkType} but these recipients are on a different network: ${mismatchedRecipients.join(", ")}`,
        },
        { status: 400 }
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
          chain: finalChain,
          chain_id: finalChainId,
          network_type: finalNetworkType,
          status: "pending",
          items: items as any,
          memo,
        },
      })
      // Create individual BatchItem records for per-recipient tracking
      await createBatchItems({
        batchId,
        items: items.map((item) => ({
          recipient: item.recipient,
          amount: item.amount.toString(),
          token: item.token || token || "USDC",
          chain: finalChain,
        })),
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

    const responseBody = {
      success: true,
      batchId,
      totals,
      itemCount: items.length,
      status: "pending",
      chain: finalChain,
      networkType: finalNetworkType,
      chainId: finalChainId,
      message: `Batch created with ${items.length} payments totaling ${totals.totalAmount} ${token || "USDC"} on ${finalChain}`,
    }

    // Mark idempotency as completed
    if (idempotencyKey) {
      await completeIdempotency(idempotencyKey, 200, responseBody).catch(() => {})
    }

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error("[BatchPayment] Create error:", error)
    const key = request.headers.get("idempotency-key")
    if (key) await failIdempotency(key).catch(() => {})
    return NextResponse.json({ error: error.message || "Failed to create batch" }, { status: 500 })
  }
}, { component: 'batch-payment' })

/**
 * GET /api/batch-payment
 * Get batch payment(s) with optional filtering
 *
 * Query parameters:
 * - batchId: specific batch ID to retrieve
 * - fromAddress: filter by sender address (must match authenticated address)
 * - network: filter by specific network (e.g., "ethereum", "tron", "base")
 * - network_type: filter by "EVM" | "TRON"
 * - status: filter by batch status
 * - limit: number of results (default 50, max 100)
 */
export const GET = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get("batchId")
    const fromAddressParam = searchParams.get("fromAddress")
    const network = searchParams.get("network")
    const networkType = searchParams.get("network_type")
    const status = searchParams.get("status")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)

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

      // Include per-recipient BatchItem tracking data
      const batchItems = await prisma.batchItem.findMany({
        where: { batch_id: batchId },
        orderBy: { index: "asc" },
      })

      const itemsSerialized = batchItems.map((item) => ({
        ...item,
        amount: item.amount.toString(),
        fee_amount: item.fee_amount?.toString() ?? null,
        gas_used: item.gas_used?.toString() ?? null,
        energy_used: item.energy_used?.toString() ?? null,
      }))

      return NextResponse.json({
        batch,
        items: itemsSerialized,
        itemSummary: {
          total: batchItems.length,
          completed: batchItems.filter((i) => i.status === "completed").length,
          failed: batchItems.filter((i) => i.status === "failed").length,
          pending: batchItems.filter((i) => i.status === "pending").length,
        },
      })
    }

    // Default to caller address if fromAddress not specific (or enforce it matches)
    const targetAddress = callerAddress;

    if (fromAddressParam && fromAddressParam.toLowerCase() !== callerAddress.toLowerCase()) {
         return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (targetAddress) {
      // Build filter conditions
      const where: Record<string, any> = {
        from_address: targetAddress.toLowerCase()
      }

      // Network filtering
      if (network) {
        where.chain = network.toLowerCase()
      }

      if (networkType) {
        where.network_type = networkType
      }

      // Status filtering
      if (status) {
        where.status = status
      }

      // Get all batches for address with filters
      try {
        const batches = await prisma.batchPayment.findMany({
          where,
          orderBy: { created_at: "desc" },
          take: limit,
        })

        return NextResponse.json({
          batches: batches || [],
          count: batches.length
        })
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
}, { component: 'batch-payment' })
