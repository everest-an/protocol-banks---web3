/**
 * Subscription Management Endpoints
 * POST /api/subscriptions - Create a new subscription
 * GET /api/subscriptions - List all subscriptions for the authenticated user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { SubscriptionService, type SubscriptionFrequency } from '@/lib/services/subscription-service';
import { getSupabase } from '@/lib/supabase';

const subscriptionService = new SubscriptionService();

const VALID_FREQUENCIES: SubscriptionFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const VALID_TOKENS = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'WBTC'];

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { service_name, wallet_address, amount, token, frequency, chain_id, start_date, memo } = body;

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
        created_at: subscription.created_at,
      },
      message: 'Subscription created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Subscriptions] Create error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscriptions
 * List all subscriptions for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;

    const subscriptions = await subscriptionService.list(ownerAddress, { status });

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
        created_at: sub.created_at,
      })),
      count: subscriptions.length,
    });

  } catch (error: any) {
    console.error('[Subscriptions] List error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to list subscriptions' },
      { status: 500 }
    );
  }
}
