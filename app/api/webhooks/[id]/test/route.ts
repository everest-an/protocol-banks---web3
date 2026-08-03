/**
 * POST /api/webhooks/[id]/test — Send a test event to a webhook endpoint.
 *
 * The settings page has had a "Test" button since webhooks shipped, and
 * hooks/use-webhooks.ts has always called this path — but the route did not
 * exist, so the button returned 404 every time.
 *
 * The delivery is signed exactly like a real event, so a successful test proves
 * the receiver validates the signature correctly rather than only that the URL
 * is reachable.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { WebhookService, generateWebhookSignature } from '@/lib/services/webhook-service'
import { withAuth } from '@/lib/middleware/api-auth'

const webhookService = new WebhookService()

/** Used when the webhook has no timeout of its own configured. */
const DEFAULT_TIMEOUT_MS = 10_000

export const POST = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    const segments = request.nextUrl.pathname.split('/')
    // .../webhooks/[id]/test
    const id = segments[segments.length - 2] || ''

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing webhook ID' }, { status: 400 })
    }

    try {
      // getById filters by owner, so another user's webhook is simply not found
      // — a caller cannot use this to probe endpoints they do not own.
      const webhook = await webhookService.getById(id, ownerAddress)
      if (!webhook) {
        return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 })
      }

      const payload = JSON.stringify({
        id: `test_${Date.now()}`,
        event: 'webhook.test',
        created_at: new Date().toISOString(),
        data: {
          webhook_id: webhook.id,
          message: 'Test delivery from Protocol Banks. No payment was made.',
        },
      })

      // Signed exactly as webhook-trigger-service signs real deliveries:
      // HMAC over `${timestamp}.${payload}`, keyed by secret_hash, with the
      // timestamp sent alongside. Any divergence here would make a passing test
      // meaningless — the receiver would accept this and reject real events.
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signature = generateWebhookSignature(`${timestamp}.${payload}`, webhook.secret_hash)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event': 'webhook.test',
      }

      // Use the webhook's own timeout so the test reflects how real deliveries
      // to this endpoint actually behave.
      const timeoutMs = webhook.timeout_ms || DEFAULT_TIMEOUT_MS
      const startedAt = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
          redirect: 'manual', // a redirect would hide where the payload landed
        })

        const elapsed = Date.now() - startedAt

        return NextResponse.json({
          success: response.ok,
          status_code: response.status,
          response_time_ms: elapsed,
          ...(response.ok
            ? {}
            : { error: `Endpoint responded ${response.status} ${response.statusText}` }),
        })
      } catch (error) {
        const elapsed = Date.now() - startedAt
        const aborted = error instanceof Error && error.name === 'AbortError'

        // A receiver that is down or unreachable is a normal outcome for a test,
        // not a server fault — report it as a failed delivery.
        return NextResponse.json({
          success: false,
          response_time_ms: elapsed,
          error: aborted
            ? `No response within ${timeoutMs / 1000}s`
            : error instanceof Error
              ? error.message
              : 'Could not reach the endpoint',
        })
      } finally {
        clearTimeout(timer)
      }
    } catch (error) {
      console.error('[Webhooks] Test delivery failed:', error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Test failed' },
        { status: 500 }
      )
    }
  },
  { component: 'webhook-test' }
)
