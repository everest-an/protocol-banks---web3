/**
 * Agent Budget Utilization API Route
 * 
 * GET /api/agents/[id]/utilization - Get budget utilization
 * 
 * @module app/api/agents/[id]/utilization/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { budgetService } from '@/lib/services/budget-service';
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
// GET /api/agents/[id]/utilization - Get budget utilization
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const utilization = await budgetService.getUtilization(params.id);

    return NextResponse.json({
      success: true,
      utilization,
    });

  } catch (error) {
    console.error('Error getting budget utilization:', error);
    return NextResponse.json(
      { error: 'Failed to get budget utilization' },
      { status: 500 }
    );
  }
}
