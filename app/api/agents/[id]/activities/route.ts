/**
 * Agent Activities API Route
 *
 * GET /api/agents/[id]/activities - Get agent activities
 *
 * @module app/api/agents/[id]/activities/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { agentActivityService } from '@/lib/services/agent-activity-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/[id]/activities - Get agent activities
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      // Verify agent exists and belongs to owner
      const agent = await agentService.get(id, ownerAddress);
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');

      const activities = await agentActivityService.getActivities(id, limit);

      return NextResponse.json({
        success: true,
        activities,
        count: activities.length,
      });

    } catch (error) {
      console.error('Error getting agent activities:', error);
      return NextResponse.json(
        { error: 'Failed to get agent activities' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id-activities' })(req);
}
