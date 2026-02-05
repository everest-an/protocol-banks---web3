/**
 * Webhook Management Endpoints
 * POST /api/webhooks - Create a new webhook
 * GET /api/webhooks - List all webhooks for the authenticated user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { WebhookService, type WebhookEvent } from '@/lib/services/webhook-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

const webhookService = new WebhookService();

// Valid webhook events
const VALID_EVENTS: WebhookEvent[] = [
  'payment.created',
  'payment.completed',
  'payment.failed',
  'batch_payment.created',
  'batch_payment.completed',
  'multisig.proposal_created',
  'multisig.executed',
  'subscription.created',
  'subscription.payment_due',
  'subscription.payment_completed',
  'subscription.cancelled',
];

/**
 * POST /api/webhooks
 * Create a new webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, url, events, retry_count, timeout_ms } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Name is required' },
        { status: 400 }
      );
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid URL format. Must be http or https.' },
        { status: 400 }
      );
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'At least one event is required' },
        { status: 400 }
      );
    }

    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid events: ${invalidEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (retry_count !== undefined && (typeof retry_count !== 'number' || retry_count < 0 || retry_count > 10)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'retry_count must be a number between 0 and 10' },
        { status: 400 }
      );
    }

    if (timeout_ms !== undefined && (typeof timeout_ms !== 'number' || timeout_ms < 1000 || timeout_ms > 60000)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'timeout_ms must be between 1000 and 60000' },
        { status: 400 }
      );
    }

    // Create webhook
    const { webhook, secret } = await webhookService.create({
      name: name.trim(),
      url,
      owner_address: ownerAddress,
      events: events as WebhookEvent[],
      retry_count,
      timeout_ms,
    });

    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        is_active: webhook.is_active,
        retry_count: webhook.retry_count,
        timeout_ms: webhook.timeout_ms,
        created_at: webhook.created_at,
      },
      secret, // Only returned on creation
      message: 'Webhook created successfully. Save the secret now - it will not be shown again.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Webhooks] Create error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks
 * List all webhooks for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // List webhooks
    const webhooks = await webhookService.list(ownerAddress);

    // Return webhooks without secrets
    const sanitizedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      is_active: webhook.is_active,
      retry_count: webhook.retry_count,
      timeout_ms: webhook.timeout_ms,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
    }));

    return NextResponse.json({
      success: true,
      webhooks: sanitizedWebhooks,
      count: sanitizedWebhooks.length,
    });

  } catch (error: any) {
    console.error('[Webhooks] List error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}
