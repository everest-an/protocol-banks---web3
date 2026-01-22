/**
 * Vendor Payments Endpoint
 * GET /api/vendors/[id]/payments - Get payments for a vendor
 */

import { type NextRequest, NextResponse } from 'next/server';
import { VendorPaymentService } from '@/lib/services/vendor-payment-service';
import { getSupabase } from '@/lib/supabase';

const vendorPaymentService = new VendorPaymentService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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
}
