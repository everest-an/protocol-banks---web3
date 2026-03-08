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
import { yativoClient } from '@/lib/services/yativo-client.service'

export async function GET(request: NextRequest) {
  return withAuth(async (req) => {
    const { searchParams } = new URL(req.url)
    const token = (searchParams.get('token') ?? 'USDC') as 'USDC' | 'USDT'

    try {
      const [depositInfo, balance] = await Promise.all([
        yativoClient.getDepositAddress(token),
        yativoClient.getPlatformBalance(),
      ])

      return NextResponse.json({
        depositAddress: depositInfo.address,
        network: depositInfo.network,
        token: depositInfo.token,
        memo: depositInfo.memo,
        platformBalance: balance,
        note: 'Send USDC/USDT to this address to fund your card balance. Funds are available within 1-3 minutes.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get deposit info'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-deposit' })(request)
}
