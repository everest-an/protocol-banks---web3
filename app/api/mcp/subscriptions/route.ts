/**
 * MCP Subscriptions API
 * 
 * GET /api/mcp/subscriptions - List user's subscriptions
 * POST /api/mcp/subscriptions - Create a new subscription
 * PATCH /api/mcp/subscriptions - Update subscription status
 * DELETE /api/mcp/subscriptions - Cancel a subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET - List subscriptions for a user
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const subscriptionId = searchParams.get('id');

    if (subscriptionId) {
      // Get specific subscription with plan details
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*), subscription_payments(*)')
        .eq('id', subscriptionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }
        throw error;
      }
      return NextResponse.json({ subscription: data });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // List user's subscriptions
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ subscriptions: data || [] });
  } catch (error) {
    console.error('[MCP Subscriptions API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}


// POST - Create a new subscription
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { planId, userId, autoRenew = true } = body;

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'planId and userId are required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    switch (plan.interval) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'one-time':
        endDate.setFullYear(endDate.getFullYear() + 100);
        break;
    }

    // Create subscription
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'pending',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: autoRenew,
      })
      .select('*, subscription_plans(*)')
      .single();

    if (error) throw error;

    return NextResponse.json({ subscription: data }, { status: 201 });
  } catch (error) {
    console.error('[MCP Subscriptions API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

// PATCH - Update subscription status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { subscriptionId, status, autoRenew } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (autoRenew !== undefined) updates.auto_renew = autoRenew;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select('*, subscription_plans(*)')
      .single();

    if (error) throw error;
    return NextResponse.json({ subscription: data });
  } catch (error) {
    console.error('[MCP Subscriptions API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

// DELETE - Cancel a subscription
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ subscription: data, message: 'Subscription cancelled' });
  } catch (error) {
    console.error('[MCP Subscriptions API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
