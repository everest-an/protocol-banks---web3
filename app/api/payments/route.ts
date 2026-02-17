import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"
import { validateAddress, getNetworkForAddress } from "@/lib/address-utils"
import { checkIdempotency, completeIdempotency, failIdempotency } from "@/lib/services/idempotency-service"
import { assessTransaction } from "@/lib/services/risk-service"

/**
 * GET /api/payments
 * Fetch payments for a wallet address using Prisma with multi-network filtering
 *
 * Query parameters:
 * - wallet: wallet address (optional, defaults to authenticated address)
 * - type: "sent" | "received" | "all"
 * - group_id: filter by payment group
 * - network: specific network (e.g., "ethereum", "tron", "base")
 * - network_type: "EVM" | "TRON"
 * - status: payment status (e.g., "pending", "completed", "failed")
 * - start_date: filter payments after this date (ISO format)
 * - end_date: filter payments before this date (ISO format)
 * - limit: number of results (default 100, max 1000)
 * - offset: pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletParam = searchParams.get("wallet")
    const type = searchParams.get("type") // "sent" | "received" | "all"
    const groupId = searchParams.get("group_id")
    const network = searchParams.get("network")
    const networkType = searchParams.get("network_type")
    const status = searchParams.get("status")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "100"), 1000)
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Security: Enforce authentication
    const authAddress = await getAuthenticatedAddress(request);
    if (!authAddress) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // If wallet param is provided, it must match auth address
    // (unless we are an admin, but for now we enforce strict isolation)
    if (walletParam && walletParam.toLowerCase() !== authAddress.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden: Access denied to other wallets" }, { status: 403 })
    }

    // Use the authenticated address
    const walletAddress = authAddress;

    // Build filter conditions
    let where: Record<string, any> = {}

    // Address filtering
    if (type === 'sent') {
      where.from_address = walletAddress
    } else if (type === 'received') {
      where.to_address = walletAddress
    } else {
      // type === 'all' or undefined
      where.OR = [
        { from_address: walletAddress },
        { to_address: walletAddress }
      ]
    }

    // Filter by payment group if specified
    if (groupId) {
      where.group_id = groupId
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

    // Date range filtering
    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) {
        where.created_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate)
      }
    }

    // Execute query with pagination
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
        include: {
          vendor: {
            select: { name: true },
          },
        },
      }),
      prisma.payment.count({ where })
    ])

    // Map Prisma result to match Payment type (add timestamp field, convert BigInt)
    const mapped = payments.map((p) => ({
      ...p,
      amount: p.amount,
      timestamp: p.created_at.toISOString(),
      created_at: p.created_at.toISOString(),
      completed_at: p.completed_at?.toISOString() ?? undefined,
      // Convert BigInt to string for JSON serialization
      energy_used: p.energy_used?.toString(),
      bandwidth_used: p.bandwidth_used?.toString(),
      gas_used: p.gas_used?.toString(),
      gas_price: p.gas_price?.toString(),
      block_number: p.block_number?.toString(),
    }))

    return NextResponse.json({
      payments: mapped,
      total,
      limit,
      offset,
      hasMore: offset + payments.length < total
    })
  } catch (error: unknown) {
    console.error("[API] GET /api/payments error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/payments
 * Update payment tags (authenticated)
 */
export async function PATCH(request: NextRequest) {
  try {
    const callerAddress = await getAuthenticatedAddress(request)
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, tags } = body as { id?: string; tags?: string[] }

    if (!id || !Array.isArray(tags)) {
      return NextResponse.json({ error: "Missing or invalid fields: id, tags" }, { status: 400 })
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, from_address: true },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    if (payment.from_address.toLowerCase() !== callerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { tags },
    })

    return NextResponse.json({
      payment: {
        ...updated,
        timestamp: updated.created_at.toISOString(),
        created_at: updated.created_at.toISOString(),
        completed_at: updated.completed_at?.toISOString() ?? undefined,
        // Convert BigInt to string for JSON serialization
        energy_used: updated.energy_used?.toString(),
        bandwidth_used: updated.bandwidth_used?.toString(),
        gas_used: updated.gas_used?.toString(),
        gas_price: updated.gas_price?.toString(),
        block_number: updated.block_number?.toString(),
      },
    })
  } catch (error: unknown) {
    console.error("[API] PATCH /api/payments error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/payments
 * Create a new payment record using Prisma with automatic network detection
 */
export async function POST(request: NextRequest) {
  try {
    const callerAddress = await getAuthenticatedAddress(request);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json()

    const {
      from_address,
      to_address,
      amount,
      token,
      token_symbol,
      chain,
      chain_id,
      network_type,
      status = "pending",
      type,
      method,
      tx_hash,
      created_by,
      vendor_name,
      category,
      memo,
      notes,
      amount_usd,
      is_external,
      group_id,
      tags,
      purpose,
      // Network-specific fields
      energy_used,
      bandwidth_used,
      gas_used,
      gas_price,
      confirmations,
      block_number,
    } = body

    if (!from_address || !to_address || !amount || !token || !type) {
      return NextResponse.json(
        { error: "Missing required fields: from_address, to_address, amount, token, type" },
        { status: 400 },
      )
    }

    // Idempotency check - prevent duplicate payments
    const idempotencyKey = request.headers.get("idempotency-key")
    if (idempotencyKey) {
      try {
        const idempotencyResult = await checkIdempotency(
          idempotencyKey,
          callerAddress,
          "/api/payments",
          { from_address, to_address, amount, token, type }
        )
        if (idempotencyResult.isDuplicate && idempotencyResult.existingResponse) {
          return NextResponse.json(
            idempotencyResult.existingResponse.body,
            { status: idempotencyResult.existingResponse.statusCode }
          )
        }
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }

    // Validate addresses
    const fromValidation = validateAddress(from_address)
    const toValidation = validateAddress(to_address)

    if (!fromValidation.isValid) {
      return NextResponse.json(
        { error: `Invalid from_address: ${fromValidation.error}` },
        { status: 400 }
      )
    }

    if (!toValidation.isValid) {
      return NextResponse.json(
        { error: `Invalid to_address: ${toValidation.error}` },
        { status: 400 }
      )
    }

    // Validate sender and recipient are on the same network type
    const fromType = fromValidation.type === "TRON" ? "TRON" : "EVM"
    const toType = toValidation.type === "TRON" ? "TRON" : "EVM"
    if (fromType !== toType) {
      return NextResponse.json(
        { error: `Network mismatch: sender is ${fromType} but recipient is ${toType}. Cross-chain transfers require the bridge.` },
        { status: 400 }
      )
    }

    // Auto-detect network if not provided
    let finalChain = chain
    let finalNetworkType = network_type
    let finalChainId = chain_id

    if (!finalChain || !finalNetworkType) {
      try {
        const detectedNetwork = getNetworkForAddress(to_address)
        if (!finalChain) finalChain = detectedNetwork
        if (!finalNetworkType) {
          finalNetworkType = toValidation.type === "TRON" ? "TRON" : "EVM"
        }
      } catch (error) {
        // If detection fails, require explicit chain parameter
        if (!finalChain) {
          return NextResponse.json(
            { error: "Could not auto-detect network. Please specify 'chain' parameter." },
            { status: 400 }
          )
        }
      }
    }

    // Risk assessment (non-blocking for "approve" decisions)
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    try {
      const riskResult = await assessTransaction({
        referenceType: "payment",
        referenceId: paymentId,
        userAddress: callerAddress,
        recipient: to_address,
        amount,
        token,
        chain: finalChain || "ethereum",
      })

      if (riskResult.decision === "block") {
        if (idempotencyKey) await failIdempotency(idempotencyKey)
        return NextResponse.json(
          {
            error: "Payment blocked by risk assessment",
            riskLevel: riskResult.riskLevel,
            riskScore: riskResult.riskScore,
          },
          { status: 403 }
        )
      }
    } catch (riskError) {
      // Risk assessment failure should not block payments - log and continue
      console.warn("[API] Risk assessment failed, proceeding:", riskError)
    }

    const payment = await prisma.payment.create({
      data: {
        from_address: fromValidation.checksumAddress || from_address,
        to_address: toValidation.checksumAddress || to_address,
        amount: String(amount),
        token,
        token_symbol,
        chain: finalChain,
        chain_id: finalChainId,
        network_type: finalNetworkType,
        status,
        type,
        method,
        tx_hash,
        created_by,
        vendor_name,
        category: purpose || category,
        memo,
        notes,
        amount_usd: amount_usd ? Number(amount_usd) : undefined,
        is_external: is_external ?? false,
        group_id,
        tags: tags || [],
        // Network-specific fields
        energy_used: energy_used ? BigInt(energy_used) : undefined,
        bandwidth_used: bandwidth_used ? BigInt(bandwidth_used) : undefined,
        gas_used: gas_used ? BigInt(gas_used) : undefined,
        gas_price: gas_price ? BigInt(gas_price) : undefined,
        confirmations: confirmations || 0,
        block_number: block_number ? BigInt(block_number) : undefined,
      },
    })

    const responseBody = {
      payment: {
        ...payment,
        timestamp: payment.created_at.toISOString(),
        created_at: payment.created_at.toISOString(),
        completed_at: payment.completed_at?.toISOString() ?? undefined,
        // Convert BigInt to string for JSON serialization
        energy_used: payment.energy_used?.toString(),
        bandwidth_used: payment.bandwidth_used?.toString(),
        gas_used: payment.gas_used?.toString(),
        gas_price: payment.gas_price?.toString(),
        block_number: payment.block_number?.toString(),
      },
    }

    // Mark idempotency key as completed
    if (idempotencyKey) {
      await completeIdempotency(idempotencyKey, 200, responseBody).catch((e) =>
        console.warn("[API] Failed to complete idempotency key:", e)
      )
    }

    return NextResponse.json(responseBody)
  } catch (error: unknown) {
    console.error("[API] POST /api/payments error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    if (request.headers.get("idempotency-key")) {
      await failIdempotency(request.headers.get("idempotency-key")!).catch(() => {})
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
