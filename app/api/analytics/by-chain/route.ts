/**
 * Analytics By Chain Endpoint
 * GET /api/analytics/by-chain - Get payment analytics grouped by blockchain
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { getSupabase } from '@/lib/supabase';

const analyticsService = new AnalyticsService();

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
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;

    const chainData = await analyticsService.getByChain(ownerAddress, { start_date, end_date });

    return NextResponse.json({
      success: true,
      data: chainData,
    });

  } catch (error: any) {
    console.error('[Analytics] By chain error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get chain analytics' },
      { status: 500 }
    );
  }
}
