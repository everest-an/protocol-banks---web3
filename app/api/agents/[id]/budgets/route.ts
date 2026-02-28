/**
 * Agent Budget API Routes
 *
 * POST /api/agents/[id]/budgets - Create budget for agent
 * GET /api/agents/[id]/budgets - List budgets for agent
 *
 * @module app/api/agents/[id]/budgets/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { budgetService, BudgetPeriod } from '@/lib/services/budget-service';
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// POST /api/agents/[id]/budgets - Create budget
// ============================================

export async function POST(
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

      const body = await request.json();

      // Validate required fields
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
      if (!body.period) {
        return NextResponse.json(
          { error: 'period is required' },
          { status: 400 }
        );
      }

      // Validate period
      const validPeriods: BudgetPeriod[] = ['daily', 'weekly', 'monthly', 'total'];
      if (!validPeriods.includes(body.period)) {
        return NextResponse.json(
          { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate amount
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive number' },
          { status: 400 }
        );
      }

      const budget = await budgetService.create({
        agent_id: id,
        owner_address: ownerAddress,
        amount: body.amount,
        token: body.token,
        chain_id: body.chain_id,
        period: body.period,
      });

      return NextResponse.json({
        success: true,
        budget,
        message: 'Budget created successfully',
      }, { status: 201 });

    } catch (error) {
      console.error('Error creating budget:', error);

      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: 'Failed to create budget' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id-budgets' })(req);
}

// ============================================
// GET /api/agents/[id]/budgets - List budgets
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

      const budgets = await budgetService.list(id);

      return NextResponse.json({
        success: true,
        budgets,
        count: budgets.length,
      });

    } catch (error) {
      console.error('Error listing budgets:', error);
      return NextResponse.json(
        { error: 'Failed to list budgets' },
        { status: 500 }
      );
    }
  }, { component: 'agents-id-budgets' })(req);
}
