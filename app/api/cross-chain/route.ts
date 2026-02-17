import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedAddress } from "@/lib/api-auth"
import {
  createCrossChainTransaction,
  transitionState,
  getCrossChainTransaction,
  listCrossChainTransactions,
} from "@/lib/services/cross-chain-state-machine"

/**
 * GET /api/cross-chain
 * List cross-chain transactions or get a specific one
 */
export async function GET(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const tx = await getCrossChainTransaction(id)
      if (!tx) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }
      if (tx.user_address.toLowerCase() !== userAddress.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.json({ transaction: tx })
    }

    const result = await listCrossChainTransactions({
      userAddress,
      state: (searchParams.get("state") as any) ?? undefined,
      type: searchParams.get("type") ?? undefined,
      limit: Number(searchParams.get("limit") || "20"),
      offset: Number(searchParams.get("offset") || "0"),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("[API] GET /api/cross-chain error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/cross-chain
 * Create a new cross-chain transaction
 */
export async function POST(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      type, provider, sourceChain, sourceToken, sourceAmount,
      destChain, destToken, recipientAddress, slippageBps,
      routeData, idempotencyKey, estimatedTime,
    } = body

    if (!type || !provider || !sourceChain || !sourceToken || !sourceAmount || !destChain || !destToken) {
      return NextResponse.json(
        { error: "Missing required fields: type, provider, sourceChain, sourceToken, sourceAmount, destChain, destToken" },
        { status: 400 }
      )
    }

    const tx = await createCrossChainTransaction({
      userAddress,
      type,
      provider,
      sourceChain,
      sourceToken,
      sourceAmount,
      destChain,
      destToken,
      recipientAddress,
      slippageBps,
      routeData,
      idempotencyKey,
      estimatedTime,
    })

    return NextResponse.json({
      transaction: {
        ...tx,
        source_amount: tx.source_amount.toString(),
        dest_amount: tx.dest_amount?.toString() ?? null,
      },
    })
  } catch (error: unknown) {
    console.error("[API] POST /api/cross-chain error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/cross-chain
 * Transition a cross-chain transaction to a new state
 */
export async function PATCH(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { transactionId, newState, trigger, details } = body

    if (!transactionId || !newState || !trigger) {
      return NextResponse.json(
        { error: "Missing required fields: transactionId, newState, trigger" },
        { status: 400 }
      )
    }

    const tx = await transitionState(transactionId, newState, trigger, details)

    return NextResponse.json({
      transaction: {
        ...tx,
        source_amount: tx.source_amount.toString(),
        dest_amount: tx.dest_amount?.toString() ?? null,
      },
    })
  } catch (error: unknown) {
    console.error("[API] PATCH /api/cross-chain error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
