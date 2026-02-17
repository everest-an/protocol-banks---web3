import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionsCron } from '@/lib/services/subscription-payment-executor'
import { verifyCronAuth } from '@/lib/cron-auth'

/**
 * POST /api/cron/subscriptions
 *
 * Cron endpoint to process due subscription payments.
 * Should be called periodically (e.g., every hour) by Vercel Cron or similar.
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  try {
    console.log('[SubscriptionCron] Starting subscription processing...')
    const startTime = Date.now()

    const result = await processSubscriptionsCron()

    const duration = Date.now() - startTime
    console.log(`[SubscriptionCron] Completed in ${duration}ms:`, result)

    return NextResponse.json({
      success: true,
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SubscriptionCron] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Subscription processing failed' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/subscriptions
 * 
 * Health check endpoint for the subscription cron job.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/cron/subscriptions',
    method: 'POST',
    description: 'Processes due subscription payments',
    schedule: 'Recommended: Every hour (0 * * * *)',
  })
}
