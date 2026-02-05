/**
 * Webhook Deliveries Endpoint
 * GET /api/webhooks/[id]/deliveries - Get delivery history for a webhook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

const webhookService = new WebhookService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/webhooks/[id]/deliveries
 * Get delivery history for a webhook
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status') || undefined;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['pending', 'delivered', 'failed', 'retrying'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get deliveries
    const deliveries = await webhookService.getDeliveries(id, ownerAddress, { limit, status });

    // Sanitize deliveries (truncate large response bodies)
    const sanitizedDeliveries = deliveries.map(delivery => ({
      id: delivery.id,
      event_type: delivery.event_type,
      status: delivery.status,
      attempts: delivery.attempts,
      last_attempt_at: delivery.last_attempt_at,
      next_retry_at: delivery.next_retry_at,
      response_status: delivery.response_status,
      response_body: delivery.response_body?.slice(0, 1000), // Truncate to 1KB
      error_message: delivery.error_message,
      created_at: delivery.created_at,
      delivered_at: delivery.delivered_at,
    }));

    return NextResponse.json({
      success: true,
      deliveries: sanitizedDeliveries,
      count: sanitizedDeliveries.length,
    });

  } catch (error: any) {
    console.error('[Webhooks] Get deliveries error:', error);

    if (error.message === 'Webhook not found') {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get deliveries' },
      { status: 500 }
    );
  }
}
