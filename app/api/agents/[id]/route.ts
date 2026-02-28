/**
 * Agent Detail API Routes
 *
 * GET /api/agents/[id] - Get agent details
 * PUT /api/agents/[id] - Update agent
 * DELETE /api/agents/[id] - Deactivate agent
 *
 * @module app/api/agents/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService, AgentType, UpdateAgentInput } from '@/lib/services/agent-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/[id] - Get agent details
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      const agent = await agentService.get(id, ownerAddress);

      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        agent,
      });

    } catch (error) {
      console.error('Error getting agent:', error);
      return NextResponse.json(
        { error: 'Failed to get agent' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id' })(req);
}

// ============================================
// PUT /api/agents/[id] - Update agent
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      const body = await request.json();

      // Validate type if provided
      const validTypes: AgentType[] = ['trading', 'payroll', 'expense', 'subscription', 'custom'];
      if (body.type && !validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate status if provided
      const validStatuses = ['active', 'paused', 'deactivated'];
      if (body.status && !validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate rate_limit_per_minute if provided
      if (body.rate_limit_per_minute !== undefined) {
        const rateLimit = Number(body.rate_limit_per_minute);
        if (isNaN(rateLimit) || rateLimit < 1 || rateLimit > 1000) {
          return NextResponse.json(
            { error: 'rate_limit_per_minute must be between 1 and 1000' },
            { status: 400 }
          );
        }
      }

      const input: UpdateAgentInput = {};
      if (body.name !== undefined) input.name = body.name;
      if (body.description !== undefined) input.description = body.description;
      if (body.type !== undefined) input.type = body.type;
      if (body.avatar_url !== undefined) input.avatar_url = body.avatar_url;
      if (body.webhook_url !== undefined) input.webhook_url = body.webhook_url;
      if (body.status !== undefined) input.status = body.status;
      if (body.auto_execute_enabled !== undefined) input.auto_execute_enabled = body.auto_execute_enabled;
      if (body.auto_execute_rules !== undefined) input.auto_execute_rules = body.auto_execute_rules;
      if (body.rate_limit_per_minute !== undefined) input.rate_limit_per_minute = body.rate_limit_per_minute;

      const agent = await agentService.update(id, ownerAddress, input);

      return NextResponse.json({
        success: true,
        agent,
        message: 'Agent updated successfully',
      });

    } catch (error) {
      console.error('Error updating agent:', error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }
        if (error.message.includes('is required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }

      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id' })(req);
}

// ============================================
// DELETE /api/agents/[id] - Deactivate agent
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, ownerAddress) => {
    try {
      const { id } = await params;

      await agentService.deactivate(id, ownerAddress);

      return NextResponse.json({
        success: true,
        message: 'Agent deactivated successfully',
      });

    } catch (error) {
      console.error('Error deactivating agent:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      return NextResponse.json(
        { error: 'Failed to deactivate agent' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id' })(req);
}
