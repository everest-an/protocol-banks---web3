/**
 * Yield Recommendation API
 *
 * GET /api/yield/recommendation
 *
 * 返回当前收益最优的网络推荐
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { logger } from '@/lib/logger/structured-logger'
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
    logger.info('Fetching yield recommendation', {
      component: 'yield-api',
      action: 'get_recommendation'
    })

    const recommendation = await unifiedYieldService.getBestYieldNetwork()

    // 获取支持的网络列表
    const supportedNetworks = unifiedYieldService.getSupportedNetworks()

    logger.logApiRequest(
      'GET',
      '/api/yield/recommendation',
      200,
      Date.now() - startTime,
      {
        component: 'yield-api',
        metadata: {
          recommendedNetwork: recommendation.network,
          apy: recommendation.apy
        }
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        recommendation,
        supportedNetworks
      }
    })
  } catch (error) {
    logger.error('Yield recommendation API error', error instanceof Error ? error : new Error(String(error)), {
      component: 'yield-api',
      action: 'get_recommendation'
    })

    logger.logApiRequest(
      'GET',
      '/api/yield/recommendation',
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
