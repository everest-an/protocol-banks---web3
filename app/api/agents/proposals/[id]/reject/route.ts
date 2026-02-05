/**
 * Reject Proposal API Route
 * 
 * PUT /api/agents/proposals/[id]/reject - Reject proposal
 * 
 * @module app/api/agents/proposals/[id]/reject/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService } from '@/lib/services/proposal-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// PUT /api/agents/proposals/[id]/reject - Reject proposal
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ownerAddress = await getAuthenticatedAddress(req);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    const proposal = await proposalService.reject(id, ownerAddress, reason);

    return NextResponse.json({
      success: true,
      proposal,
      message: 'Proposal rejected successfully',
    });

  } catch (error) {
    console.error('Error rejecting proposal:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Invalid state')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to reject proposal' },
      { status: 500 }
    );
  }
}
