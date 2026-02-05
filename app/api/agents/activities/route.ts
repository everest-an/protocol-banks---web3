/**
 * Agent Activities API Route
 * 
 * GET /api/agents/activities - Get all agent activities
 * 
 * @module app/api/agents/activities/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentActivityService } from '@/lib/services/agent-activity-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// GET /api/agents/activities - Get all agent activities
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
}
