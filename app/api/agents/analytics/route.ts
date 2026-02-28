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
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/analytics - Get agent analytics
// ============================================

export const GET = withAuth(async (req: NextRequest, ownerAddress: string) => {
  try {
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
}, { component: 'agents-analytics' });
