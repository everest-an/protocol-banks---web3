/**
 * Agent Budget Utilization API Route
 * 
 * GET /api/agents/[id]/utilization - Get budget utilization
 * 
 * @module app/api/agents/[id]/utilization/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { budgetService } from '@/lib/services/budget-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// GET /api/agents/[id]/utilization - Get budget utilization
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

    // Verify agent exists and belongs to owner
    const agent = await agentService.get(id, ownerAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const utilization = await budgetService.getUtilization(id);

    return NextResponse.json({
      success: true,
      utilization,
    });

  } catch (error) {
    console.error('Error getting budget utilization:', error);
    return NextResponse.json(
      { error: 'Failed to get budget utilization' },
      { status: 500 }
    );
  }
}
