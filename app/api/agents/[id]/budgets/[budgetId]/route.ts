/**
 * Agent Budget Detail API Routes
 * 
 * GET /api/agents/[id]/budgets/[budgetId] - Get budget details
 * PUT /api/agents/[id]/budgets/[budgetId] - Update budget
 * DELETE /api/agents/[id]/budgets/[budgetId] - Delete budget
 * 
 * @module app/api/agents/[id]/budgets/[budgetId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { budgetService, BudgetPeriod } from '@/lib/services/budget-service';
import { getSupabase } from '@/lib/supabase';

// ============================================
// Helper Functions
// ============================================

async function getOwnerAddress(): Promise<string | null> {
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return user.user_metadata?.wallet_address || user.email || null;
}

// ============================================
// GET /api/agents/[id]/budgets/[budgetId] - Get budget
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; budgetId: string } }
) {
  try {
    const ownerAddress = await getOwnerAddress();
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify agent exists and belongs to owner
    const agent = await agentService.get(params.id, ownerAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const budget = await budgetService.get(params.budgetId);
    if (!budget || budget.agent_id !== params.id) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      budget,
    });

  } catch (error) {
    console.error('Error getting budget:', error);
    return NextResponse.json(
      { error: 'Failed to get budget' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/agents/[id]/budgets/[budgetId] - Update budget
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; budgetId: string } }
) {
  try {
    const ownerAddress = await getOwnerAddress();
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify agent exists and belongs to owner
    const agent = await agentService.get(params.id, ownerAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Verify budget exists and belongs to agent
    const existingBudget = await budgetService.get(params.budgetId);
    if (!existingBudget || existingBudget.agent_id !== params.id) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Validate period if provided
    if (body.period) {
      const validPeriods: BudgetPeriod[] = ['daily', 'weekly', 'monthly', 'total'];
      if (!validPeriods.includes(body.period)) {
        return NextResponse.json(
          { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate amount if provided
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive number' },
          { status: 400 }
        );
      }
    }

    const budget = await budgetService.update(params.budgetId, {
      amount: body.amount,
      token: body.token,
      chain_id: body.chain_id,
      period: body.period,
    });

    return NextResponse.json({
      success: true,
      budget,
      message: 'Budget updated successfully',
    });

  } catch (error) {
    console.error('Error updating budget:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update budget' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/agents/[id]/budgets/[budgetId] - Delete budget
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; budgetId: string } }
) {
  try {
    const ownerAddress = await getOwnerAddress();
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify agent exists and belongs to owner
    const agent = await agentService.get(params.id, ownerAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Verify budget exists and belongs to agent
    const existingBudget = await budgetService.get(params.budgetId);
    if (!existingBudget || existingBudget.agent_id !== params.id) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    await budgetService.delete(params.budgetId);

    return NextResponse.json({
      success: true,
      message: 'Budget deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget' },
      { status: 500 }
    );
  }
}
