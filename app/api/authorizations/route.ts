/**
 * x402 Authorizations API
 * GET /api/authorizations - List x402 payment authorizations for the user
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"

// GET - List authorizations
export async function GET(request: NextRequest) {
  try {
    const walletAddress = await getAuthenticatedAddress(request)
    if (!walletAddress) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // pending, used, cancelled, expired
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build where clause
    const where: Record<string, any> = {
      from_address: walletAddress.toLowerCase(),
    }
    if (status) {
      where.status = status
    }

    // Fetch authorizations and count in parallel
    const [authorizations, total] = await Promise.all([
      prisma.x402Authorization.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.x402Authorization.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      authorizations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    })
  } catch (error) {
    console.error("[Authorizations] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
