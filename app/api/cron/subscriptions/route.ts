import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionsCron } from '@/lib/services/subscription-payment-executor'

/**
 * POST /api/cron/subscriptions
 * 
 * Cron endpoint to process due subscription payments.
 * Should be called periodically (e.g., every hour) by Vercel Cron or similar.
 * 
 * Security: Requires CRON_SECRET header in production.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret — required in ALL environments to prevent unauthorized triggering
  const cronSecret = request.headers.get('x-cron-secret') || 
                     request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

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
