/**
 * Agent Proposals API Routes
 * 
 * POST /api/agents/proposals - Create proposal (agent auth)
 * GET /api/agents/proposals - List proposals (owner auth)
 * 
 * @module app/api/agents/proposals/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService, ProposalStatus } from '@/lib/services/proposal-service';
import { agentService } from '@/lib/services/agent-service';
import { getAgentContext, extractAgentApiKey, validateAgentAuth } from '@/lib/middleware/agent-auth';
import { getAuthenticatedAddress } from '@/lib/api-auth';

// ============================================
// POST /api/agents/proposals - Create proposal (agent auth)
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Check for agent authentication
    const apiKey = extractAgentApiKey(req);
    
    if (apiKey) {
      // Agent authentication
      const authResult = await validateAgentAuth(apiKey);
      if (!authResult.success || !authResult.context) {
        return NextResponse.json(
          { error: authResult.error || 'Invalid agent authentication' },
          { status: authResult.statusCode || 401 }
        );
      }

      const body = await req.json();

      // Validate required fields
      if (!body.recipient_address) {
        return NextResponse.json(
          { error: 'recipient_address is required' },
          { status: 400 }
        );
      }
      if (!body.amount) {
        return NextResponse.json(
          { error: 'amount is required' },
          { status: 400 }
        );
      }
      if (!body.token) {
        return NextResponse.json(
          { error: 'token is required' },
          { status: 400 }
        );
      }
      if (body.chain_id === undefined) {
        return NextResponse.json(
          { error: 'chain_id is required' },
          { status: 400 }
        );
      }
      if (!body.reason) {
        return NextResponse.json(
          { error: 'reason is required' },
          { status: 400 }
        );
      }

      const proposal = await proposalService.create({
        agent_id: authResult.context.agentId,
        owner_address: authResult.context.ownerAddress,
        recipient_address: body.recipient_address,
        amount: body.amount,
        token: body.token,
        chain_id: body.chain_id,
        reason: body.reason,
        metadata: body.metadata,
        budget_id: body.budget_id,
      });

      return NextResponse.json({
        success: true,
        proposal,
        message: 'Proposal created successfully',
      }, { status: 201 });
    }

    // Owner authentication - create proposal on behalf of agent
    const ownerAddress = await getAuthenticatedAddress(req);
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate agent_id for owner-created proposals
    if (!body.agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required when creating proposal as owner' },
        { status: 400 }
      );
    }

    // Verify agent belongs to owner
    const agent = await agentService.get(body.agent_id, ownerAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const proposal = await proposalService.create({
      agent_id: body.agent_id,
      owner_address: ownerAddress,
      recipient_address: body.recipient_address,
      amount: body.amount,
      token: body.token,
      chain_id: body.chain_id,
      reason: body.reason,
      metadata: body.metadata,
      budget_id: body.budget_id,
    });

    return NextResponse.json({
      success: true,
      proposal,
      message: 'Proposal created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating proposal:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/agents/proposals - List proposals (owner auth)
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
    const status = searchParams.get('status') as ProposalStatus | null;
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const proposals = await proposalService.list(ownerAddress, {
      status: status || undefined,
      agentId: agentId || undefined,
      limit,
      offset,
    });

    const pendingCount = await proposalService.getPendingCount(ownerAddress);

    return NextResponse.json({
      success: true,
      proposals,
      count: proposals.length,
      pending_count: pendingCount,
    });

  } catch (error) {
    console.error('Error listing proposals:', error);
    return NextResponse.json(
      { error: 'Failed to list proposals' },
      { status: 500 }
    );
  }
}
