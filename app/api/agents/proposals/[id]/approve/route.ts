/**
 * Approve Proposal API Route
 *
 * PUT /api/agents/proposals/[id]/approve - Approve proposal
 *
 * @module app/api/agents/proposals/[id]/approve/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService } from '@/lib/services/proposal-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// PUT /api/agents/proposals/[id]/approve - Approve proposal
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      const proposal = await proposalService.approve(id, ownerAddress);

      return NextResponse.json({
        success: true,
        proposal,
        message: 'Proposal approved successfully',
      });

    } catch (error) {
      console.error('Error approving proposal:', error);

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
        { error: 'Failed to approve proposal' },
        { status: 500 }
      );
    }
  }, { component: 'agents-proposals-approve' })(req);
}
