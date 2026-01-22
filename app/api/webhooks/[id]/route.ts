/**
 * Webhook Management Endpoints - Single Webhook Operations
 * GET /api/webhooks/[id] - Get a specific webhook
 * PUT /api/webhooks/[id] - Update a webhook
 * DELETE /api/webhooks/[id] - Delete a webhook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { WebhookService, type WebhookEvent } from '@/lib/services/webhook-service';
import { getSupabase } from '@/lib/supabase';

const webhookService = new WebhookService();

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/webhooks/[id]
 * Get a specific webhook by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const ownerAddress = user.user_metadata?.wallet_address || user.email;
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No wallet address associated with account' },
        { status: 400 }
      );
    }

    const webhook = await webhookService.getById(id, ownerAddress);
    
    if (!webhook) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

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
        updated_at: webhook.updated_at,
      },
    });

  } catch (error: any) {
    console.error('[Webhooks] Get error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get webhook' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/webhooks/[id]
 * Update a webhook
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const ownerAddress = user.user_metadata?.wallet_address || user.email;
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No wallet address associated with account' },
        { status: 400 }
      );
    }

    // Check if webhook exists
    const existingWebhook = await webhookService.getById(id, ownerAddress);
    if (!existingWebhook) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, url, events, is_active, retry_count, timeout_ms } = body;

    // Validate fields if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Name must be a non-empty string' },
        { status: 400 }
      );
    }

    if (url !== undefined) {
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Events must be a non-empty array' },
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
    }

    if (retry_count !== undefined && (typeof retry_count !== 'number' || retry_count < 0 || retry_count > 10)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'retry_count must be between 0 and 10' },
        { status: 400 }
      );
    }

    if (timeout_ms !== undefined && (typeof timeout_ms !== 'number' || timeout_ms < 1000 || timeout_ms > 60000)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'timeout_ms must be between 1000 and 60000' },
        { status: 400 }
      );
    }

    // Update webhook
    const updatedWebhook = await webhookService.update(id, ownerAddress, {
      name: name?.trim(),
      url,
      events: events as WebhookEvent[],
      is_active,
      retry_count,
      timeout_ms,
    });

    return NextResponse.json({
      success: true,
      webhook: {
        id: updatedWebhook.id,
        name: updatedWebhook.name,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        is_active: updatedWebhook.is_active,
        retry_count: updatedWebhook.retry_count,
        timeout_ms: updatedWebhook.timeout_ms,
        created_at: updatedWebhook.created_at,
        updated_at: updatedWebhook.updated_at,
      },
      message: 'Webhook updated successfully',
    });

  } catch (error: any) {
    console.error('[Webhooks] Update error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const ownerAddress = user.user_metadata?.wallet_address || user.email;
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No wallet address associated with account' },
        { status: 400 }
      );
    }

    // Check if webhook exists
    const existingWebhook = await webhookService.getById(id, ownerAddress);
    if (!existingWebhook) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Delete webhook
    await webhookService.delete(id, ownerAddress);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });

  } catch (error: any) {
    console.error('[Webhooks] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
