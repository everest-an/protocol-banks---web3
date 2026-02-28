/**
 * Proposal Detail API Routes
 *
 * GET /api/agents/proposals/[id] - Get proposal details
 *
 * @module app/api/agents/proposals/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService } from '@/lib/services/proposal-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/proposals/[id] - Get proposal details
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      const proposal = await proposalService.get(id);

      if (!proposal) {
        return NextResponse.json(
          { error: 'Proposal not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (proposal.owner_address !== ownerAddress.toLowerCase()) {
        return NextResponse.json(
          { error: 'Proposal not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        proposal,
      });

    } catch (error) {
      console.error('Error getting proposal:', error);
      return NextResponse.json(
        { error: 'Failed to get proposal' },
        { status: 500 }
      );
    }
  }, { component: 'agents-proposals-id' })(req);
}
