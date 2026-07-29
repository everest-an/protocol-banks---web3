/**
 * POST /api/subscriptions/[id]/pay — Charge a single subscription on demand.
 *
 * This is the "Pay Now" path. It is deliberately separate from
 * /api/cron/subscriptions (which sweeps every due subscription and is guarded by
 * CRON_SECRET): this one is wallet-authenticated and charges exactly the one
 * subscription named in the URL, after verifying the caller owns it.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { subscriptionService } from '@/lib/services/subscription-service'
import { subscriptionPaymentExecutor } from '@/lib/services/subscription-payment-executor'

export const POST = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    const segments = request.nextUrl.pathname.split('/')
    // .../subscriptions/[id]/pay
    const id = segments[segments.length - 2]

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing subscription ID' }, { status: 400 })
    }

    try {
      const subscription = await subscriptionService.getById(id, ownerAddress)
      if (!subscription) {
        return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 })
      }

      if (subscription.status !== 'active') {
        return NextResponse.json(
          { success: false, error: `Cannot charge a ${subscription.status} subscription` },
          { status: 409 }
        )
      }

      const result = await subscriptionPaymentExecutor.executePayment(subscription)

      if (!result.success) {
        // Skipped (expired authorization / cap exceeded) is a client-actionable
        // state, not a server fault.
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Payment failed',
            skipped: result.skipped,
            skipReason: result.skipReason,
          },
          { status: result.skipped ? 409 : 502 }
        )
      }

      return NextResponse.json({
        success: true,
        txHash: result.txHash,
        method: result.method,
        subscriptionId: result.subscriptionId,
      })
    } catch (error) {
      console.error('[Subscriptions] Pay Now failed:', error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Payment failed' },
        { status: 500 }
      )
    }
  },
  { component: 'subscription-pay' }
)
