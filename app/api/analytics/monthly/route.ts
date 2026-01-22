/**
 * Analytics Monthly Endpoint
 * GET /api/analytics/monthly - Get monthly payment data for past 12 months
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

    const monthlyData = await analyticsService.getMonthlyData(ownerAddress);

    return NextResponse.json({
      success: true,
      data: monthlyData,
    });

  } catch (error: any) {
    console.error('[Analytics] Monthly error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get monthly analytics' },
      { status: 500 }
    );
  }
}
