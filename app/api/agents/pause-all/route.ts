/**
 * Pause All Agents API Route
 * 
 * POST /api/agents/pause-all - Emergency pause all agents
 * 
 * @module app/api/agents/pause-all/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// POST /api/agents/pause-all - Emergency pause all agents
// ============================================

export async function POST(req: NextRequest) {
  try {
    const ownerAddress = await getAuthenticatedAddress(req);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const pausedCount = await agentService.pauseAll(ownerAddress);

    return NextResponse.json({
      success: true,
      paused_count: pausedCount,
      message: `Successfully paused ${pausedCount} agent(s). All auto-execute has been disabled.`,
    });

  } catch (error) {
    console.error('Error pausing all agents:', error);
    return NextResponse.json(
      { error: 'Failed to pause agents' },
      { status: 500 }
    );
  }
}
