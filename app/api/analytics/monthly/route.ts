/**
 * Analytics Monthly Endpoint
 * GET /api/analytics/monthly - Get monthly payment data for past 12 months
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { withAuth } from '@/lib/middleware/api-auth';

const analyticsService = new AnalyticsService();

export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const monthlyData = await analyticsService.getMonthlyData(ownerAddress);

    return NextResponse.json({ success: true, data: monthlyData });
  } catch (error: any) {
    console.error('[Analytics] Monthly error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get monthly analytics' },
      { status: 500 }
    );
  }
}, { component: 'analytics-monthly' });
