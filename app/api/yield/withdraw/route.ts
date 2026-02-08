/**
 * Yield Withdraw API
 *
 * POST /api/yield/withdraw
 *
 * 从收益协议 (Aave V3 / JustLend) 提现
 *
 * 注意: 链上交易由客户端签名执行。
 * 此 API 负责验证参数、更新数据库状态。
 * amount = "0" 表示全额提现。
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import { yieldWithdrawSchema, formatZodError } from '@/lib/validations/yield'
import { requireAuth } from '@/lib/middleware/api-auth'
import { yieldApiLimiter } from '@/lib/middleware/rate-limit'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 速率限制
    const rateLimit = yieldApiLimiter.check(request)
    if (rateLimit.error) return rateLimit.error

    // 认证验证
    const auth = await requireAuth(request, { component: 'yield-api' })
    if (auth.error) return auth.error

    // 解析请求体
    const body = await request.json()

    // Zod 输入验证
    const parsed = yieldWithdrawSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { merchant, network, amount } = parsed.data
    const isFullWithdraw = parseFloat(amount) === 0

    logger.info('Yield withdrawal request', {
      component: 'yield-api',
      network,
      action: 'withdraw',
      metadata: { merchant, amount, isFullWithdraw }
    })

    // 检查是否有活跃存款
    const activeDeposits = await prisma.yieldDeposit.findMany({
      where: {
        merchant_id: merchant,
        status: 'active'
      }
    })

    if (activeDeposits.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active deposits found for this merchant' },
        { status: 404 }
      )
    }

    const totalPrincipal = activeDeposits.reduce(
      (sum, d) => sum + parseFloat(d.principal.toString()),
      0
    )

    // 验证提现金额不超过本金 (非全额提现时)
    if (!isFullWithdraw && parseFloat(amount) > totalPrincipal) {
      return NextResponse.json(
        {
          success: false,
          error: `Withdrawal amount ${amount} exceeds total principal ${totalPrincipal.toFixed(6)}`
        },
        { status: 400 }
      )
    }

    // 更新数据库记录
    await prisma.yieldDeposit.updateMany({
      where: {
        merchant_id: merchant,
        status: 'active'
      },
      data: {
        status: 'withdrawn',
        withdrawn_at: new Date()
      }
    })

    const withdrawAmount = isFullWithdraw ? totalPrincipal.toFixed(6) : amount

    // 获取网络信息
    const networkInfo = unifiedYieldService.getSupportedNetworks()
      .find(n => n.network === network)

    logger.logApiRequest(
      'POST',
      '/api/yield/withdraw',
      200,
      Date.now() - startTime,
      {
        component: 'yield-api',
        network,
        metadata: { merchant, amount: withdrawAmount, depositsUpdated: activeDeposits.length }
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        merchant,
        network,
        networkType: networkInfo?.type || 'EVM',
        protocol: networkInfo?.protocol || 'Unknown',
        amount: withdrawAmount,
        token: 'USDT',
        principal: totalPrincipal.toFixed(6),
        depositsWithdrawn: activeDeposits.length,
        status: 'withdrawn',
        message: `Withdrawal of ${withdrawAmount} USDT recorded. Client should execute on-chain transaction.`
      }
    }, { status: 200 })
  } catch (error) {
    logger.error('Yield withdrawal API error', error instanceof Error ? error : new Error(String(error)), {
      component: 'yield-api',
      action: 'withdraw'
    })

    logger.logApiRequest(
      'POST',
      '/api/yield/withdraw',
      500,
      Date.now() - startTime,
      { component: 'yield-api' }
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
