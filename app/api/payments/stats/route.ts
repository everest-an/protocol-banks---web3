/**
 * Payment Statistics API
 * Provides aggregated statistics for payments across networks
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

/**
 * GET /api/payments/stats
 * Get aggregated payment statistics
 *
 * Query parameters:
 * - network: filter by specific network (optional)
 * - network_type: filter by "EVM" | "TRON" (optional)
 * - start_date: filter payments after this date (ISO format)
 * - end_date: filter payments before this date (ISO format)
 */
export const GET = withAuth(async (request: NextRequest, authAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const network = searchParams.get("network")
    const networkType = searchParams.get("network_type")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Build base filter
    const baseFilter: Record<string, any> = {
      OR: [
        { from_address: authAddress },
        { to_address: authAddress }
      ]
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
      totalPayments,
      byNetwork,
      byNetworkType,
      byStatus,
      byToken,
      sentStats,
      receivedStats,
      recentActivity
    ] = await Promise.all([
      // Total payment count
      prisma.payment.count({ where: baseFilter }),

      // Group by network (chain)
      prisma.payment.groupBy({
        by: ['chain'],
        where: baseFilter,
        _count: { id: true },
        _sum: { amount_usd: true },
      }),

      // Group by network type (EVM/TRON)
      prisma.payment.groupBy({
        by: ['network_type'],
        where: baseFilter,
        _count: { id: true },
        _sum: { amount_usd: true },
      }),

      // Group by status
      prisma.payment.groupBy({
        by: ['status'],
        where: baseFilter,
        _count: { id: true },
      }),

      // Group by token
      prisma.payment.groupBy({
        by: ['token_symbol', 'chain'],
        where: baseFilter,
        _count: { id: true },
        _sum: { amount_usd: true },
      }),

      // Sent payments stats
      prisma.payment.aggregate({
        where: { ...baseFilter, from_address: authAddress },
        _count: { id: true },
        _sum: { amount_usd: true },
      }),

      // Received payments stats
      prisma.payment.aggregate({
        where: { ...baseFilter, to_address: authAddress },
        _count: { id: true },
        _sum: { amount_usd: true },
      }),

      // Recent activity (last 7 days)
      prisma.payment.count({
        where: {
          ...baseFilter,
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    // Calculate total volume (USD)
    const totalVolumeUSD = byNetwork.reduce((sum, item) =>
      sum + (item._sum.amount_usd || 0), 0
    )

    // Format network statistics
    const networkStats = byNetwork.map(item => ({
      network: item.chain,
      count: item._count.id,
      volumeUSD: item._sum.amount_usd || 0,
    }))

    // Format network type statistics
    const networkTypeStats = byNetworkType.map(item => ({
      networkType: item.network_type,
      count: item._count.id,
      volumeUSD: item._sum.amount_usd || 0,
    }))

    // Format status statistics
    const statusStats = byStatus.map(item => ({
      status: item.status,
      count: item._count.id,
    }))

    // Format token statistics
    const tokenStats = byToken.map(item => ({
      token: item.token_symbol,
      network: item.chain,
      count: item._count.id,
      volumeUSD: item._sum.amount_usd || 0,
    }))

    return NextResponse.json({
      summary: {
        totalPayments,
        totalVolumeUSD,
        sentCount: sentStats._count.id,
        sentVolumeUSD: sentStats._sum.amount_usd || 0,
        receivedCount: receivedStats._count.id,
        receivedVolumeUSD: receivedStats._sum.amount_usd || 0,
        recentActivity, // Last 7 days
      },
      byNetwork: networkStats,
      byNetworkType: networkTypeStats,
      byStatus: statusStats,
      byToken: tokenStats,
    })
  } catch (error: unknown) {
    console.error("[API] GET /api/payments/stats error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'payments-stats' })
