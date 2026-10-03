import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"
import { createBatchItems } from "@/lib/services/batch-item-service"
import { executeBatch, CHAIN_ID_BY_NAME } from "@/lib/services/batch-execution-worker"
import {
  validateAuthorizations,
  type SignedAuthorizationInput,
} from "@/lib/services/eip3009-authorization"
import { isERC3009Supported } from "@/lib/erc3009"

/**
 * POST /api/batch/execute
 *
 * Execute a parsed (file-upload) batch job non-custodially.
 *
 * Call with `{ jobId, chain, chainId }` first: the parsed rows come back so the
 * wallet can sign one EIP-3009 authorization per row. Call again with
 * `authorizations` to execute. There is no "mark APPROVED and hope" step — the
 * same worker as the synchronous path runs, from the payer's own balance.
 */
export const POST = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()
    const { jobId, chain, chainId, authorizations } = body

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    }

    const job = await prisma.batchJob.findFirst({
      where: { id: jobId, user_id: walletAddress.toLowerCase() },
    })
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
    if (!["PENDING_APPROVAL", "APPROVED", "PROCESSING", "PARTIAL", "FAILED"].includes(job.status)) {
      return NextResponse.json(
        { error: `Job is not in approval state (current: ${job.status})` },
        { status: 400 },
      )
    }

    const chunks = await prisma.batchChunk.findMany({
      where: { job_id: jobId },
      orderBy: { chunk_index: "asc" },
    })
    if (!chunks.length) {
      return NextResponse.json({ error: "No chunks found for this job" }, { status: 500 })
    }

    // Flatten the parsed rows across chunks; the flattened order is the
    // authorization index the wallet signs against.
    const items: Array<{ index: number; recipient: string; amount: string; token: string }> = []
    for (const chunk of chunks) {
      const rows = Array.isArray(chunk.data) ? (chunk.data as Array<Record<string, unknown>>) : []
      for (const row of rows) {
        const recipient = typeof row?.recipient === "string" ? row.recipient : ""
        const amount = row?.amount
        if (!recipient || amount === undefined || amount === null) continue
        items.push({
          index: items.length,
          recipient,
          amount: String(amount),
          token: String(row?.token ?? "USDC").toUpperCase(),
        })
      }
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Job has no parsed recipients" }, { status: 400 })
    }

    const chainSlug = String(chain ?? "").toLowerCase()
    const resolvedChainId = Number(chainId) || CHAIN_ID_BY_NAME[chainSlug]
    if (!chainSlug || !resolvedChainId || !CHAIN_ID_BY_NAME[chainSlug]) {
      return NextResponse.json(
        { error: `chain/chainId required (supported: ${Object.keys(CHAIN_ID_BY_NAME).join(", ")})` },
        { status: 400 },
      )
    }

    const tokens = new Set(items.map((item) => item.token))
    if (tokens.size !== 1) {
      return NextResponse.json({ error: "Mixed tokens in one file are not supported" }, { status: 400 })
    }
    const token = items[0].token
    if (!isERC3009Supported(resolvedChainId, token)) {
      return NextResponse.json(
        {
          error:
            `${token} does not support EIP-3009 on ${chainSlug}. Async batches settle from the payer's own wallet ` +
            "and need a signable token (USDC).",
        },
        { status: 503 },
      )
    }

    // Step 1 — no signatures yet: hand the rows back so the wallet can sign.
    if (!Array.isArray(authorizations) || authorizations.length === 0) {
      return NextResponse.json({
        requiresAuthorizations: true,
        chain: chainSlug,
        chainId: resolvedChainId,
        token,
        items,
      })
    }

    // Step 2 — validate the signatures, materialize the batch, run the worker.
    const itemRows = items.map((item) => ({
      index: item.index,
      recipient: item.recipient,
      amount: { toString: () => item.amount },
      token: item.token,
      chain: chainSlug,
      status: "pending",
      chainId: resolvedChainId,
    }))

    let validated: Awaited<ReturnType<typeof validateAuthorizations>>
    try {
      validated = await validateAuthorizations(
        walletAddress,
        walletAddress,
        itemRows,
        authorizations as SignedAuthorizationInput[],
      )
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid authorization" },
        { status: 400 },
      )
    }

    const batchId = `async_${jobId}`
    const existing = await prisma.batchPayment.findUnique({ where: { batch_id: batchId } })
    if (!existing) {
      const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
      await prisma.batchPayment.create({
        data: {
          batch_id: batchId,
          from_address: walletAddress.toLowerCase(),
          total_amount: total,
          total_items: items.length,
          token,
          chain: chainSlug,
          chain_id: resolvedChainId,
          network_type: "EVM",
          status: "pending",
          items: items,
          memo: `File batch ${jobId}`,
        },
      })
      await createBatchItems({
        batchId,
        items: items.map((item) => ({
          recipient: item.recipient,
          amount: item.amount,
          token: item.token,
          chain: chainSlug,
        })),
      })
    }

    await prisma.batchJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } })

    const result = await executeBatch(batchId, walletAddress, "EVM", validated)

    const finalStatus =
      result.failed > 0 && result.completed === 0 ? "failed" : result.failed > 0 ? "partial" : "completed"
    await prisma.batchJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        error_message: result.failed > 0 ? `${result.failed} item(s) failed` : null,
      },
    })
    await prisma.batchChunk.updateMany({
      where: { job_id: jobId },
      data: { status: finalStatus === "completed" ? "COMPLETED" : "PARTIAL" },
    })

    return NextResponse.json({
      success: true,
      jobId,
      batchId,
      status: finalStatus,
      execution: result,
    })
  } catch (error: any) {
    console.error("Batch execute error:", error)
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 })
  }
}, { component: "batch-execute" })
