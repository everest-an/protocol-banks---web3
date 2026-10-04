/**
 * Yield Deposit API
 *
 * POST /api/yield/deposit
 *
 * 将 USDT 存入收益协议 (Aave V3 / JustLend)
 *
 * 注意: 链上交易由客户端签名执行。
 * 此 API 负责记录存款意图、验证参数、更新数据库。
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import { yieldDepositSchema, formatZodError } from '@/lib/validations/yield'
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
    const parsed = yieldDepositSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { merchant, network, amount } = parsed.data

    logger.info('Yield deposit request', {
      component: 'yield-api',
      network,
      action: 'deposit',
      metadata: { merchant, amount }
    })

    // 记录存款意图到数据库
    const deposit = await prisma.yieldDeposit.create({
      data: {
        merchant_id: merchant,
        amount: parseFloat(amount),
        token: 'USDT',
        principal: parseFloat(amount),
        interest: 0,
        apy: 0,
        status: 'active',
        deposited_at: new Date()
      }
    })

    // 获取当前余额和网络信息
    const networkInfo = unifiedYieldService.getSupportedNetworks()
      .find(n => n.network === network)

    logger.logApiRequest(
      'POST',
      '/api/yield/deposit',
      201,
      Date.now() - startTime,
      {
        component: 'yield-api',
        network,
        metadata: { merchant, amount, depositId: deposit.id }
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        depositId: deposit.id,
        merchant,
        network,
        networkType: networkInfo?.type || 'EVM',
        protocol: networkInfo?.protocol || 'Unknown',
        amount,
        token: 'USDT',
        status: 'active',
        message: `Deposit of ${amount} USDT recorded for ${network}. Client should execute on-chain transaction.`
      }
    }, { status: 201 })
  } catch (error) {
    logger.error('Yield deposit API error', error instanceof Error ? error : new Error(String(error)), {
      component: 'yield-api',
      action: 'deposit'
    })

    // A missing deployment is a configuration gap, not a server fault.
    const message = error instanceof Error ? error.message : 'Unknown error'
    const notProvisioned = /not initialized|deployment not found|no deployment/i.test(message)
    const status = notProvisioned ? 503 : 500

    logger.logApiRequest(
      'POST',
      '/api/yield/deposit',
      status,
      Date.now() - startTime,
      { component: 'yield-api' }
    )

    return NextResponse.json(
      {
        success: false,
        error: notProvisioned ? 'Yield is not deployed on this network yet.' : message
      },
      { status }
    )
  }
}
