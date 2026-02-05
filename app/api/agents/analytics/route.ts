/**
 * Agent Analytics API Route
 * 
 * GET /api/agents/analytics - Get agent analytics
 * 
 * @module app/api/agents/analytics/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentActivityService } from '@/lib/services/agent-activity-service';
import { agentService } from '@/lib/services/agent-service';
import { proposalService } from '@/lib/services/proposal-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// GET /api/agents/analytics - Get agent analytics
// ============================================

export async function GET(req: NextRequest) {
  try {
    const ownerAddress = await getAuthenticatedAddress(req);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get base analytics from activity service
    const analytics = await agentActivityService.getAnalytics(ownerAddress);

    // Enrich with agent counts
    const agentCounts = await agentService.getCount(ownerAddress);
    analytics.total_agents = agentCounts.total;
    analytics.active_agents = agentCounts.active;

    // Get pending proposals count
    analytics.pending_proposals = await proposalService.getPendingCount(ownerAddress);

    return NextResponse.json({
      success: true,
      analytics,
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}
