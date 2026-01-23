/**
 * Agent Webhooks API Route
 * 
 * GET /api/agents/[id]/webhooks - Get webhook deliveries
 * 
 * @module app/api/agents/[id]/webhooks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';
import { agentWebhookService } from '@/lib/services/agent-webhook-service';
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
// GET /api/agents/[id]/webhooks - Get webhook deliveries
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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const deliveries = await agentWebhookService.getDeliveries(params.id, limit);

    return NextResponse.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });

  } catch (error) {
    console.error('Error getting webhook deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook deliveries' },
      { status: 500 }
    );
  }
}
