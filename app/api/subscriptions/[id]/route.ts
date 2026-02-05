/**
 * Subscription Management Endpoints - Single Subscription Operations
 * GET /api/subscriptions/[id] - Get a specific subscription
 * PUT /api/subscriptions/[id] - Update a subscription
 * DELETE /api/subscriptions/[id] - Cancel a subscription
 */

import { type NextRequest, NextResponse } from 'next/server';
import { SubscriptionService, type SubscriptionFrequency } from '@/lib/services/subscription-service';
import { getSupabase } from '@/lib/supabase';

const subscriptionService = new SubscriptionService();

const VALID_FREQUENCIES: SubscriptionFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/subscriptions/[id]
 * Get a specific subscription by ID
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

    const subscription = await subscriptionService.getById(id, ownerAddress);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        service_name: subscription.service_name,
        wallet_address: subscription.wallet_address,
        amount: subscription.amount,
        token: subscription.token,
        frequency: subscription.frequency,
        status: subscription.status,
        next_payment_date: subscription.next_payment_date,
        last_payment_date: subscription.last_payment_date,
        total_paid: subscription.total_paid,
        payment_count: subscription.payment_count,
        chain_id: subscription.chain_id,
        memo: subscription.memo,
        use_case: subscription.use_case,
        max_authorized_amount: subscription.max_authorized_amount,
        authorization_expires_at: subscription.authorization_expires_at,
        schedule_day: subscription.schedule_day,
        schedule_time: subscription.schedule_time,
        timezone: subscription.timezone,
        description: subscription.description,
        recipients: subscription.recipients,
        remaining_quota: subscription.remaining_quota,
        authorization_valid: subscription.authorization_valid,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
      },
    });

  } catch (error: any) {
    console.error('[Subscriptions] Get error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get subscription' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscriptions/[id]
 * Update a subscription
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

    const existingSubscription = await subscriptionService.getById(id, ownerAddress);
    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Subscription not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      service_name, amount, frequency, status, memo,
      // Auto Pay fields
      max_authorized_amount, authorization_expires_at,
      schedule_day, schedule_time, timezone, description, recipients,
    } = body;

    // Validate fields if provided
    if (service_name !== undefined && (typeof service_name !== 'string' || service_name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'service_name must be a non-empty string' },
        { status: 400 }
      );
    }

    if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    if (frequency !== undefined && !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid frequency. Valid: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (status !== undefined && !['active', 'paused'].includes(status)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'status can only be set to active or paused' },
        { status: 400 }
      );
    }

    const updatedSubscription = await subscriptionService.update(id, ownerAddress, {
      service_name: service_name?.trim(),
      amount: amount ? parseFloat(amount).toFixed(2) : undefined,
      frequency,
      status,
      memo,
      // Auto Pay fields
      max_authorized_amount: max_authorized_amount !== undefined ? String(max_authorized_amount) : undefined,
      authorization_expires_at,
      schedule_day: schedule_day !== undefined ? Number(schedule_day) : undefined,
      schedule_time,
      timezone,
      description,
      recipients,
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        service_name: updatedSubscription.service_name,
        wallet_address: updatedSubscription.wallet_address,
        amount: updatedSubscription.amount,
        token: updatedSubscription.token,
        frequency: updatedSubscription.frequency,
        status: updatedSubscription.status,
        next_payment_date: updatedSubscription.next_payment_date,
        chain_id: updatedSubscription.chain_id,
        use_case: updatedSubscription.use_case,
        max_authorized_amount: updatedSubscription.max_authorized_amount,
        authorization_expires_at: updatedSubscription.authorization_expires_at,
        remaining_quota: updatedSubscription.remaining_quota,
        authorization_valid: updatedSubscription.authorization_valid,
        updated_at: updatedSubscription.updated_at,
      },
      message: 'Subscription updated successfully',
    });

  } catch (error: any) {
    console.error('[Subscriptions] Update error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions/[id]
 * Cancel a subscription
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

    const existingSubscription = await subscriptionService.getById(id, ownerAddress);
    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (existingSubscription.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Subscription is already cancelled' },
        { status: 400 }
      );
    }

    await subscriptionService.cancel(id, ownerAddress);

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });

  } catch (error: any) {
    console.error('[Subscriptions] Cancel error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
