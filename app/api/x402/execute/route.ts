import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { relayerService, isRelayerConfigured } from "@/lib/services/relayer-service"
import { withAuth } from "@/lib/middleware/api-auth"
import type { Hex, Address } from "viem"

/**
 * x402 Protocol - Payment Execution Endpoint
 *
 * Executes a pre-authorized payment. This endpoint is called by:
 * 1. Relayer services for gasless execution
 * 2. Backend services for automated payments (subscriptions, scheduled)
 *
 * The actual on-chain transaction is handled by the configured relayer.
 */

export interface X402ExecuteRequest {
  transferId: string
  signature: string
  relayerOverride?: string
}

export interface X402ExecuteResponse {
  success: boolean
  txHash?: string
  status?: string
  error?: string
}

// Chain RPC configurations
const CHAIN_RPCS: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_RPC_ETHEREUM || "https://eth.llamarpc.com",
  137: process.env.NEXT_PUBLIC_RPC_POLYGON || "https://polygon.llamarpc.com",
  42161: process.env.NEXT_PUBLIC_RPC_ARBITRUM || "https://arbitrum.llamarpc.com",
  8453: process.env.NEXT_PUBLIC_RPC_BASE || "https://base.llamarpc.com",
  10: process.env.NEXT_PUBLIC_RPC_OPTIMISM || "https://optimism.llamarpc.com",
}

export const POST = withAuth(async (request: NextRequest, callerAddress: string): Promise<NextResponse<X402ExecuteResponse>> => {
  try {
    const body = await request.json() as X402ExecuteRequest
    const { transferId, signature } = body

    if (!transferId) {
      return NextResponse.json(
        { success: false, error: "Missing transferId" },
        { status: 400 }
      )
    }

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 400 }
      )
    }

    // Get the authorization
    const auth = await prisma.x402Authorization.findFirst({
        where: { transfer_id: transferId }
    });

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authorization not found" },
        { status: 404 }
      )
    }

    // Check if already executed
    if (auth.status === "completed" || auth.status === "settled") {
      return NextResponse.json({
        success: true,
        txHash: auth.tx_hash ?? undefined,
        status: auth.status,
      })
    }

    // Check if expired
    const now = new Date()
    // Prisma returns Date objects, so we can use them directly
    const validBefore = auth.valid_before;

    if (now > validBefore) {
      await prisma.x402Authorization.update({
        where: { id: auth.id },
        data: { status: "expired" }
      });

      return NextResponse.json(
        { success: false, error: "Authorization has expired", status: "expired" },
        { status: 400 }
      )
    }

    // Update status to executing
    await prisma.x402Authorization.update({
        where: { id: auth.id },
        data: { status: "executing", signature }
    });

    // Execute the payment
    let txHash: string

    if (isRelayerConfigured()) {
      // Use relayer service for gasless execution
      const result = await relayerService.executeERC3009Transfer({
        chainId: auth.chain_id,
        token: auth.token || "USDC",
        from: auth.from_address as Address,
        to: auth.payment_address as Address,
        value: auth.amount,
        validAfter: Math.floor(auth.valid_after.getTime() / 1000),
        validBefore: Math.floor(auth.valid_before.getTime() / 1000),
        nonce: auth.nonce as Hex,
        signature: signature as Hex,
      })

      if (result.status === "failed") {
        throw new Error(result.error || "Relayer execution failed")
      }

      txHash = result.transactionHash || result.taskId
    } else {
      // Development mode: simulate execution
      console.warn("[x402] No relayer configured, simulating execution")
      txHash = generateMockTxHash()

      // Simulate some delay
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Update authorization with transaction hash
    await prisma.x402Authorization.update({
        where: { id: auth.id },
        data: {
            tx_hash: txHash,
            status: "completed",
            // completed_at removed as it is not in Prisma schema, updated_at will auto-update
        }
    });

    return NextResponse.json({
      success: true,
      txHash,
      status: "completed",
    })

  } catch (error) {
    console.error("[x402] Execution error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    )
  }
}, { component: 'x402-execute' })

/**
 * Generate mock transaction hash for development
 */
function generateMockTxHash(): string {
  return "0x" + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")
}

/**
 * GET endpoint to check execution status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const transferId = searchParams.get("transferId")

  if (!transferId) {
    return NextResponse.json(
      { error: "Missing transferId parameter" },
      { status: 400 }
    )
  }

  // Refactored to use Prisma
  try {
    const data = await prisma.x402Authorization.findFirst({
        where: { transfer_id: transferId }
    });

    if (!data) {
        return NextResponse.json(
        { error: "Authorization not found" },
        { status: 404 }
        )
    }

    return NextResponse.json({
        transferId: data.transfer_id,
        status: data.status,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    })
  } catch (error) {
     return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    )
  }
}
