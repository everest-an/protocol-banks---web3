/**
 * Agent Activities API Route
 *
 * GET /api/agents/activities - Get all agent activities
 *
 * @module app/api/agents/activities/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentActivityService } from '@/lib/services/agent-activity-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/activities - Get all agent activities
// ============================================

export const GET = withAuth(async (req: NextRequest, ownerAddress: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const activities = await agentActivityService.getOwnerActivities(ownerAddress, limit);

    return NextResponse.json({
      success: true,
      activities,
      count: activities.length,
    });

  } catch (error) {
    console.error('Error getting activities:', error);
    return NextResponse.json(
      { error: 'Failed to get activities' },
      { status: 500 }
    );
  }
}, { component: 'agents-activities' });
