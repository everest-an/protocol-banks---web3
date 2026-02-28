/**
 * x402 Authorization Detail API
 * GET /api/authorizations/[id] - Get a specific authorization
 * PATCH /api/authorizations/[id] - Cancel an authorization
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get specific authorization
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req, walletAddress) => {
    try {
      const { id } = await params

      // Fetch authorization
      const authorization = await prisma.x402Authorization.findFirst({
        where: {
          id,
          from_address: walletAddress.toLowerCase(),
        },
      })

      if (!authorization) {
        return NextResponse.json({ success: false, error: "Authorization not found" }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        authorization,
      })
    } catch (error) {
      console.error("[Authorizations] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }, { component: 'authorizations-id' })(request)
}

// PATCH - Cancel authorization
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req, walletAddress) => {
    try {
      const { id } = await params

      // Parse request body
      const body = await req.json()

      // Only allow cancellation of pending authorizations
      if (body.status === "cancelled") {
        // Use updateMany to atomically check ownership + status
        const result = await prisma.x402Authorization.updateMany({
          where: {
            id,
            from_address: walletAddress.toLowerCase(),
            status: "pending", // Can only cancel pending
          },
          data: {
            status: "cancelled",
            // Note: no cancelled_at field in schema; updated_at auto-updates
          },
        })

        if (result.count === 0) {
          return NextResponse.json(
            { success: false, error: "Authorization not found or cannot be cancelled" },
            { status: 404 }
          )
        }

        // Fetch the updated record to return
        const authorization = await prisma.x402Authorization.findUnique({
          where: { id },
        })

        return NextResponse.json({
          success: true,
          authorization,
        })
      }

      return NextResponse.json({ success: false, error: "Invalid operation" }, { status: 400 })
    } catch (error) {
      console.error("[Authorizations] Error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }, { component: 'authorizations-id' })(request)
}
