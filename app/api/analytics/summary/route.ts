/**
 * Analytics Summary Endpoint
 * GET /api/analytics/summary - Get payment analytics summary
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { withAuth } from '@/lib/middleware/api-auth';

const analyticsService = new AnalyticsService();

export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;

    const summary = await analyticsService.getSummary(ownerAddress, { start_date, end_date });

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('[Analytics] Summary error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get analytics' },
      { status: 500 }
    );
  }
}, { component: 'analytics-summary' });
