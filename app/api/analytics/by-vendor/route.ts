/**
 * Analytics By Vendor Endpoint
 * GET /api/analytics/by-vendor - Get payment analytics grouped by vendor
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

    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;

    const vendorData = await analyticsService.getByVendor(ownerAddress, { start_date, end_date });

    return NextResponse.json({
      success: true,
      data: vendorData,
    });

  } catch (error: any) {
    console.error('[Analytics] By vendor error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get vendor analytics' },
      { status: 500 }
    );
  }
}
