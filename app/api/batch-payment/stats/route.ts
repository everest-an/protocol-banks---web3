/**
 * Batch Payment Statistics API
 * Provides aggregated statistics for batch payments across networks
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"

/**
 * GET /api/batch-payment/stats
 * Get aggregated batch payment statistics
 *
 * Query parameters:
 * - network: filter by specific network (optional)
 * - network_type: filter by "EVM" | "TRON" (optional)
 * - start_date: filter batches after this date (ISO format)
 * - end_date: filter batches before this date (ISO format)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const network = searchParams.get("network")
    const networkType = searchParams.get("network_type")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Security: Enforce authentication
    const authAddress = await getAuthenticatedAddress(request)
    if (!authAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Build base filter
    const baseFilter: Record<string, unknown> = {
      from_address: authAddress.toLowerCase()
    }

    // Add network filters
    if (network) {
      baseFilter.chain = network.toLowerCase()
    }

    if (networkType) {
      baseFilter.network_type = networkType
    }

    // Add date range filter
    if (startDate || endDate) {
      baseFilter.created_at = {}
      if (startDate) {
        baseFilter.created_at.gte = new Date(startDate)
      }
      if (endDate) {
        baseFilter.created_at.lte = new Date(endDate)
      }
    }

    // Execute aggregation queries in parallel
    const [
      totalBatches,
      byNetwork,
      byNetworkType,
      byStatus,
      totalStats,
      recentActivity
    ] = await Promise.all([
      // Total batch count
      prisma.batchPayment.count({ where: baseFilter }),

      // Group by network (chain)
      prisma.batchPayment.groupBy({
        by: ['chain'],
        where: baseFilter,
        _count: { id: true },
        _sum: {
          total_amount: true,
          total_items: true,
        },
      }),

      // Group by network type (EVM/TRON)
      prisma.batchPayment.groupBy({
        by: ['network_type'],
        where: baseFilter,
        _count: { id: true },
        _sum: {
          total_amount: true,
          total_items: true,
        },
      }),

      // Group by status
      prisma.batchPayment.groupBy({
        by: ['status'],
        where: baseFilter,
        _count: { id: true },
        _sum: {
          total_amount: true,
          total_items: true,
        },
      }),

      // Total aggregated stats
      prisma.batchPayment.aggregate({
        where: baseFilter,
        _sum: {
          total_amount: true,
          total_items: true,
          fee: true,
        },
        _avg: {
          total_amount: true,
          total_items: true,
        },
      }),

      // Recent activity (last 7 days)
      prisma.batchPayment.count({
        where: {
          ...baseFilter,
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    // Format network statistics
    const networkStats = byNetwork.map(item => ({
      network: item.chain,
      batchCount: item._count.id,
      totalAmount: item._sum.total_amount || 0,
      totalItems: item._sum.total_items || 0,
    }))

    // Format network type statistics
    const networkTypeStats = byNetworkType.map(item => ({
      networkType: item.network_type,
      batchCount: item._count.id,
      totalAmount: item._sum.total_amount || 0,
      totalItems: item._sum.total_items || 0,
    }))

    // Format status statistics
    const statusStats = byStatus.map(item => ({
      status: item.status,
      batchCount: item._count.id,
      totalAmount: item._sum.total_amount || 0,
      totalItems: item._sum.total_items || 0,
    }))

    return NextResponse.json({
      summary: {
        totalBatches,
        totalAmount: totalStats._sum.total_amount || 0,
        totalItems: totalStats._sum.total_items || 0,
        totalFees: totalStats._sum.fee || 0,
        avgBatchAmount: totalStats._avg.total_amount || 0,
        avgItemsPerBatch: totalStats._avg.total_items || 0,
        recentActivity, // Last 7 days
      },
      byNetwork: networkStats,
      byNetworkType: networkTypeStats,
      byStatus: statusStats,
    })
  } catch (error: unknown) {
    console.error("[API] GET /api/batch-payment/stats error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
