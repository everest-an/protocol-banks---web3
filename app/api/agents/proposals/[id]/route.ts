/**
 * Proposal Detail API Routes
 * 
 * GET /api/agents/proposals/[id] - Get proposal details
 * 
 * @module app/api/agents/proposals/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService } from '@/lib/services/proposal-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// GET /api/agents/proposals/[id] - Get proposal details
// ============================================

export async function GET(
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
}
