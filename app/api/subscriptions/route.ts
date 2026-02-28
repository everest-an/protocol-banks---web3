/**
 * Subscription Management Endpoints
 * POST /api/subscriptions - Create a new subscription
 * GET /api/subscriptions - List all subscriptions for the authenticated user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { SubscriptionService, type SubscriptionFrequency } from '@/lib/services/subscription-service';
import { withAuth } from '@/lib/middleware/api-auth';

const subscriptionService = new SubscriptionService();

const VALID_FREQUENCIES: SubscriptionFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const VALID_TOKENS = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'WBTC'];

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
export const POST = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const body = await request.json();
    const {
      service_name, wallet_address, amount, token, frequency, chain_id, start_date, memo,
      // Auto Pay fields
      use_case, max_authorized_amount, authorization_expires_at,
      schedule_day, schedule_time, timezone, description, recipients,
    } = body;

    // Validate required fields
    if (!service_name || typeof service_name !== 'string' || service_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'service_name is required' },
        { status: 400 }
      );
    }

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Valid wallet_address is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Valid positive amount is required' },
        { status: 400 }
      );
    }

    if (!token || !VALID_TOKENS.includes(token)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid token. Valid tokens: ${VALID_TOKENS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Invalid frequency. Valid: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!chain_id || typeof chain_id !== 'number') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'chain_id is required' },
        { status: 400 }
      );
    }

    // Validate start_date if provided
    if (start_date) {
      const startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid start_date format' },
          { status: 400 }
        );
      }
    }

    const subscription = await subscriptionService.create({
      owner_address: ownerAddress,
      service_name: service_name.trim(),
      wallet_address,
      amount: parseFloat(amount).toFixed(2),
      token,
      frequency,
      chain_id,
      start_date,
      memo,
      // Auto Pay fields
      use_case: use_case || 'individual',
      max_authorized_amount: max_authorized_amount ? String(max_authorized_amount) : undefined,
      authorization_expires_at,
      schedule_day: schedule_day ? Number(schedule_day) : undefined,
      schedule_time,
      timezone: timezone || 'UTC',
      description,
      recipients,
    });

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
        chain_id: subscription.chain_id,
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
      },
      message: 'Subscription created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Subscriptions] Create error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}, { component: 'subscriptions' })

/**
 * GET /api/subscriptions
 * List all subscriptions for the authenticated user
 */
export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const use_case = searchParams.get('use_case') as any;

    const subscriptions = await subscriptionService.list(ownerAddress, { status, use_case });

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        service_name: sub.service_name,
        wallet_address: sub.wallet_address,
        amount: sub.amount,
        token: sub.token,
        frequency: sub.frequency,
        status: sub.status,
        next_payment_date: sub.next_payment_date,
        last_payment_date: sub.last_payment_date,
        total_paid: sub.total_paid,
        payment_count: sub.payment_count,
        chain_id: sub.chain_id,
        use_case: sub.use_case,
        max_authorized_amount: sub.max_authorized_amount,
        authorization_expires_at: sub.authorization_expires_at,
        schedule_day: sub.schedule_day,
        schedule_time: sub.schedule_time,
        timezone: sub.timezone,
        description: sub.description,
        recipients: sub.recipients,
        remaining_quota: sub.remaining_quota,
        authorization_valid: sub.authorization_valid,
        created_at: sub.created_at,
      })),
      count: subscriptions.length,
    });

  } catch (error: any) {
    console.error('[Subscriptions] List error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list subscriptions' },
      { status: 500 }
    );
  }
}, { component: 'subscriptions' })
