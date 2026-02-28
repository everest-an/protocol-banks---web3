import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/lib/services/billing-service';
import { withAuth } from '@/lib/middleware/api-auth';

/**
 * GET /api/billing/history
 * Get user's billing history
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const history = await billingService.getBillingHistory(userAddress, limit);

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('[API] Failed to get billing history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get billing history' },
      { status: 500 }
    );
  }
}, { component: 'billing-history' });
