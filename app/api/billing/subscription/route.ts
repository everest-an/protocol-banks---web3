import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/lib/services/billing-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

/**
 * GET /api/billing/subscription
 * Get current user's subscription
 */
export async function GET(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Ensure subscription exists (creates Free plan if not)
    const subscription = await billingService.ensureSubscription(userAddress);

    // Get usage metrics
    const usage = await billingService.getUsageMetrics(userAddress);

    // Get plan limits
    const limits = await billingService.getPlanLimits(userAddress);

    return NextResponse.json({
      subscription,
      usage,
      limits,
    });
  } catch (error: any) {
    console.error('[API] Failed to get subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subscription' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/subscription
 * Change subscription plan
 */
export async function POST(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan_id, action } = body;

    if (action === 'cancel') {
      const subscription = await billingService.cancelSubscription(userAddress);
      return NextResponse.json({ subscription });
    }

    if (!plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await billingService.getPlan(plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const subscription = await billingService.changePlan(userAddress, plan_id);

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('[API] Failed to change subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to change subscription' },
      { status: 500 }
    );
  }
}
