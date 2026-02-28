/**
 * Vendor Payments Endpoint
 * GET /api/vendors/[id]/payments - Get payments for a vendor
 */

import { type NextRequest, NextResponse } from 'next/server';
import { VendorPaymentService } from '@/lib/services/vendor-payment-service';
import { withAuth } from '@/lib/middleware/api-auth';

const vendorPaymentService = new VendorPaymentService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, ownerAddress) => {
    try {
      const { id } = await params;

      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const status = searchParams.get('status') || undefined;

      const { payments, total } = await vendorPaymentService.getVendorPayments(
        id,
        ownerAddress,
        { limit, offset, status }
      );

      return NextResponse.json({
        success: true,
        payments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + payments.length < total,
        },
      });

    } catch (error: any) {
      console.error('[Vendors] Get payments error:', error);

      if (error.message?.includes('not found') || error.message?.includes('access denied')) {
        return NextResponse.json(
          { error: 'Not Found', message: 'Vendor not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Internal Server Error', message: error.message || 'Failed to get vendor payments' },
        { status: 500 }
      );
    }
  }, { component: 'vendors-id-payments' })(request);
}
