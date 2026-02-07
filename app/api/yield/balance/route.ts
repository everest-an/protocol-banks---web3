/**
 * Yield Balance API
 *
 * GET /api/yield/balance?merchant=0x...&network=base
 * GET /api/yield/balance?merchant=0x...&summary=true  (跨网络汇总)
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import { yieldBalanceQuerySchema, parseSearchParams, formatZodError } from '@/lib/validations/yield'
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
    const parsed = yieldBalanceQuerySchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { merchant, network, summary } = parsed.data

    // 情况 1: 跨网络汇总
    if (summary === 'true') {
      logger.info('Fetching yield summary', {
        component: 'yield-api',
        action: 'get_summary',
        metadata: { merchant }
      })

      const result = await unifiedYieldService.getCrossNetworkSummary(merchant)

      logger.logApiRequest(
        'GET',
        '/api/yield/balance',
        200,
        Date.now() - startTime,
        {
          component: 'yield-api',
          metadata: {
            merchant,
            summary: true,
            totalBalance: result.totalBalance
          }
        }
      )

      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // 情况 2: 单个网络余额 (network validated by Zod)
    if (!network) {
      return NextResponse.json(
        { error: 'Missing required parameter: network' },
        { status: 400 }
      )
    }

    logger.info('Fetching yield balance', {
      component: 'yield-api',
      action: 'get_balance',
      network,
      metadata: { merchant }
    })

    const balance = await unifiedYieldService.getBalance(network, merchant)

    logger.logApiRequest(
      'GET',
      '/api/yield/balance',
      200,
      Date.now() - startTime,
      {
        component: 'yield-api',
        network,
        metadata: {
          merchant,
          balance: balance.totalBalance
        }
      }
    )

    return NextResponse.json({
      success: true,
      data: balance
    })
  } catch (error) {
    logger.error('Yield balance API error', error instanceof Error ? error : new Error(String(error)), {
      component: 'yield-api',
      action: 'get_balance'
    })

    logger.logApiRequest(
      'GET',
      '/api/yield/balance',
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
