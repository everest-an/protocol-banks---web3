/**
 * Analytics Monthly Endpoint
 * GET /api/analytics/monthly - Get monthly payment data for past 12 months
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

const analyticsService = new AnalyticsService();

export async function GET(request: NextRequest) {
  try {
    const ownerAddress = await getAuthenticatedAddress(request);

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
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
