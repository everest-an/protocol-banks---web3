/**
 * Yield Statistics API
 *
 * GET /api/yield/stats?network=base
 * GET /api/yield/stats  (所有网络)
 */

import { NextRequest, NextResponse } from 'next/server'
import { AllNetworks } from '@/lib/services/yield/unified-yield.service'
import { yieldAggregatorService } from '@/lib/services/yield/yield-aggregator.service'
import { tronYieldService, tronYieldServiceNile } from '@/lib/services/yield/tron-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import { yieldStatsQuerySchema, parseSearchParams, formatZodError } from '@/lib/validations/yield'
import { requireAuth } from '@/lib/middleware/api-auth'
import { yieldApiLimiter } from '@/lib/middleware/rate-limit'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 速率限制
    const rateLimit = yieldApiLimiter.check(request)
    if (rateLimit.error) return rateLimit.error

    // 认证验证
    const auth = await requireAuth(request, { component: 'yield-api' })
    if (auth.error) return auth.error

    // Zod 输入验证
    const params = parseSearchParams(request.nextUrl.searchParams)
    const parsed = yieldStatsQuerySchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { network } = parsed.data

    // 情况 1: 单个网络统计
    if (network) {
      logger.info('Fetching yield stats for network', {
        component: 'yield-api',
        action: 'get_stats',
        network
      })

      let stats

      try {
        if (network === 'ethereum' || network === 'base' || network === 'arbitrum') {
          // EVM 网络
          stats = await yieldAggregatorService.getContractStats(network)
        } else if (network === 'tron') {
          // TRON 主网
          stats = await tronYieldService.getJustLendStats()
        } else if (network === 'tron-nile') {
          // TRON 测试网
          stats = await tronYieldServiceNile.getJustLendStats()
        } // Network validated by Zod enum
      } catch (error) {
        logger.warn(`Failed to fetch stats for ${network}, returning empty`, {
          component: 'yield-api',
          network,
          metadata: { error: String(error) }
        })
        stats = {
          network,
          totalBalance: '0.000000',
          totalInterest: '0.000000',
          apy: 0,
          message: `Stats unavailable for ${network} - contracts not deployed`
        }
      }

      logger.logApiRequest(
        'GET',
        '/api/yield/stats',
        200,
        Date.now() - startTime,
        {
          component: 'yield-api',
          network
        }
      )

      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    // 情况 2: 所有网络统计
    logger.info('Fetching yield stats for all networks', {
      component: 'yield-api',
      action: 'get_stats'
    })

    const networks: AllNetworks[] = ['ethereum', 'base', 'arbitrum', 'tron']

    const allStats = await Promise.all(
      networks.map(async (net) => {
        try {
          if (net === 'ethereum' || net === 'base' || net === 'arbitrum') {
            const stats = await yieldAggregatorService.getContractStats(net)
            return { ...stats, network: net }
          } else {
            const stats = await tronYieldService.getJustLendStats()
            return { ...stats, network: net }
          }
        } catch (error) {
          logger.warn(`Failed to fetch stats for ${net}`, {
            component: 'yield-api',
            network: net,
            metadata: { error: String(error) }
          })
          return null
        }
      })
    )

    const validStats = allStats.filter((s) => s !== null)

    // 计算总计 (safely handle missing or non-numeric values)
    const totalBalance = validStats.reduce(
      (sum, s) => {
        const val = parseFloat(String((s as Record<string, unknown>)?.totalBalance ?? '0'))
        return sum + (isNaN(val) ? 0 : val)
      },
      0
    )
    const totalInterest = validStats.reduce(
      (sum, s) => {
        const val = parseFloat(String((s as Record<string, unknown>)?.totalInterest ?? '0'))
        return sum + (isNaN(val) ? 0 : val)
      },
      0
    )

    logger.logApiRequest(
      'GET',
      '/api/yield/stats',
      200,
      Date.now() - startTime,
      {
        component: 'yield-api'
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        networks: validStats,
        totals: {
          totalBalance: totalBalance.toFixed(6),
          totalInterest: totalInterest.toFixed(6)
        }
      }
    })
  } catch (error) {
    logger.error('Yield stats API error', error instanceof Error ? error : new Error(String(error)), {
      component: 'yield-api',
      action: 'get_stats'
    })

    logger.logApiRequest(
      'GET',
      '/api/yield/stats',
      500,
      Date.now() - startTime,
      {
        component: 'yield-api'
      }
    )

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
