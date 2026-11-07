/**
 * /api/cards/deposit
 *
 * GET - Get the Yativo USDC deposit address for funding the platform balance.
 *       Users send USDC to this address; Yativo converts 1:1 to USD which
 *       can then be used to issue and fund virtual cards.
 *
 * @module app/api/cards/deposit
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { yativoClient, isYativoConfigError } from '@/lib/services/yativo-client.service'

export async function GET(request: NextRequest) {
  return withAuth(async (req) => {
    const { searchParams } = new URL(req.url)
    const token = (searchParams.get('token') ?? 'USDC') as 'USDC' | 'USDT'

    try {
      const [depositInfo, balance] = await Promise.all([
        yativoClient.getDepositAddress(token),
        yativoClient.getWalletBalance(),
      ])

      const info = depositInfo.data
      return NextResponse.json({
        depositAddress: info.address,
        network: info.network,
        token: info.token,
        memo: info.memo,
        platformBalance: balance,
        note: 'Send USDC/USDT to this address to fund your card balance. Funds are available within 1-3 minutes.',
      })
    } catch (err) {
      console.error('[cards] deposit address lookup failed:', err)
      const status = isYativoConfigError(err) ? 503 : 502
      return NextResponse.json(
        {
          error: status === 503
            ? 'Card funding is unavailable: the provider credentials are missing or rejected.'
            : 'Card funding is temporarily unavailable',
        },
        { status },
      )
    }
  }, { component: 'cards-deposit' })(request)
}
