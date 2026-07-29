import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionsCron } from '@/lib/services/subscription-payment-executor'
import { verifyCronAuth } from '@/lib/cron-auth'

/**
 * Process every subscription whose next charge is due.
 *
 * Exposed on both GET and POST: Vercel Cron only issues GET requests, while
 * manual/external triggers conventionally POST. Both are behind verifyCronAuth.
 */
async function runSubscriptionCron(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  return runSubscriptionCron(request)
}

export async function POST(request: NextRequest) {
  return runSubscriptionCron(request)
}
