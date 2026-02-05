import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/payments
 * Fetch payments for a wallet address using Prisma
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get("wallet")
    const type = searchParams.get("type") // "sent" | "received" | "all"
    const groupId = searchParams.get("group_id")

    if (!walletAddress) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 })
    }

    // Default: find payments where user is sender OR receiver (if type is not specified or 'all')
    let where: Record<string, unknown> = {}

    if (type === 'sent') {
      where = {
        from_address: walletAddress
      }
    } else if (type === 'received') {
      where = {
        to_address: walletAddress
      }
    } else {
      // type === 'all' or undefined
      where = {
        OR: [
          { from_address: walletAddress },
          { to_address: walletAddress }
        ]
      }
    }

    // Filter by payment group if specified
    if (groupId) {
      where.group_id = groupId
    }
    
    // Optional: filter by created_by if needed, but history usually wants all interactions
    // If strict ownership is needed: 
    // where.created_by = walletAddress 
    // But for received payments, created_by might be the sender. So we stick to address matching.

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { created_at: "desc" },
    })

    // Map Prisma result to match Payment type (add timestamp field)
    const mapped = payments.map((p) => ({
      ...p,
      amount: p.amount,
      timestamp: p.created_at.toISOString(),
      created_at: p.created_at.toISOString(),
      completed_at: p.completed_at?.toISOString() ?? undefined,
    }))

    return NextResponse.json({ payments: mapped })
  } catch (error: unknown) {
    console.error("[API] GET /api/payments error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/payments
 * Create a new payment record using Prisma
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      from_address,
      to_address,
      amount,
      token,
      token_symbol,
      chain,
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
    } = body

    if (!from_address || !to_address || !amount || !token || !chain || !type) {
      return NextResponse.json(
        { error: "Missing required fields: from_address, to_address, amount, token, chain, type" },
        { status: 400 },
      )
    }

    const payment = await prisma.payment.create({
      data: {
        from_address,
        to_address,
        amount: String(amount),
        token,
        token_symbol,
        chain,
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
      },
    })

    return NextResponse.json({
      payment: {
        ...payment,
        timestamp: payment.created_at.toISOString(),
        created_at: payment.created_at.toISOString(),
        completed_at: payment.completed_at?.toISOString() ?? undefined,
      },
    })
  } catch (error: unknown) {
    console.error("[API] POST /api/payments error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
