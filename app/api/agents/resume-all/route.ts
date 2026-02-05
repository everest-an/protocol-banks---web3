/**
 * Resume All Agents API Route
 * 
 * POST /api/agents/resume-all - Resume all paused agents
 * 
 * @module app/api/agents/resume-all/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// POST /api/agents/resume-all - Resume all paused agents
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

    const resumedCount = await agentService.resumeAll(ownerAddress);

    return NextResponse.json({
      success: true,
      resumed_count: resumedCount,
      message: `Successfully resumed ${resumedCount} agent(s).`,
    });

  } catch (error) {
    console.error('Error resuming all agents:', error);
    return NextResponse.json(
      { error: 'Failed to resume agents' },
      { status: 500 }
    );
  }
}
