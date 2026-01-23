/**
 * Batch Proposals API Route
 * 
 * POST /api/agents/proposals/batch - Create batch proposals
 * 
 * @module app/api/agents/proposals/batch/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalService } from '@/lib/services/proposal-service';
import { extractAgentApiKey, validateAgentAuth } from '@/lib/middleware/agent-auth';

// ============================================
// POST /api/agents/proposals/batch - Create batch proposals
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Agent authentication required
    const apiKey = extractAgentApiKey(req);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Agent authentication required for batch proposals' },
        { status: 401 }
      );
    }

    const authResult = await validateAgentAuth(apiKey);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json(
        { error: authResult.error || 'Invalid agent authentication' },
        { status: authResult.statusCode || 401 }
      );
    }

    const body = await req.json();

    if (!body.proposals || !Array.isArray(body.proposals)) {
      return NextResponse.json(
        { error: 'proposals array is required' },
        { status: 400 }
      );
    }

    if (body.proposals.length === 0) {
      return NextResponse.json(
        { error: 'At least one proposal is required' },
        { status: 400 }
      );
    }

    if (body.proposals.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 proposals per batch' },
        { status: 400 }
      );
    }

    // Validate each proposal
    for (let i = 0; i < body.proposals.length; i++) {
      const p = body.proposals[i];
      if (!p.recipient_address) {
        return NextResponse.json(
          { error: `Proposal ${i + 1}: recipient_address is required` },
          { status: 400 }
        );
      }
      if (!p.amount) {
        return NextResponse.json(
          { error: `Proposal ${i + 1}: amount is required` },
          { status: 400 }
        );
      }
      if (!p.token) {
        return NextResponse.json(
          { error: `Proposal ${i + 1}: token is required` },
          { status: 400 }
        );
      }
      if (p.chain_id === undefined) {
        return NextResponse.json(
          { error: `Proposal ${i + 1}: chain_id is required` },
          { status: 400 }
        );
      }
      if (!p.reason) {
        return NextResponse.json(
          { error: `Proposal ${i + 1}: reason is required` },
          { status: 400 }
        );
      }
    }

    const inputs = body.proposals.map((p: any) => ({
      agent_id: authResult.context!.agentId,
      owner_address: authResult.context!.ownerAddress,
      recipient_address: p.recipient_address,
      amount: p.amount,
      token: p.token,
      chain_id: p.chain_id,
      reason: p.reason,
      metadata: p.metadata,
      budget_id: p.budget_id,
    }));

    const proposals = await proposalService.createBatch(inputs);

    return NextResponse.json({
      success: true,
      proposals,
      count: proposals.length,
      message: `${proposals.length} proposals created successfully`,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating batch proposals:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create batch proposals' },
      { status: 500 }
    );
  }
}
