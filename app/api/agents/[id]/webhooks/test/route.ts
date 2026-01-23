/**
 * Test Webhook API Route
 * 
 * POST /api/agents/[id]/webhooks/test - Send test webhook
 * 
 * @module app/api/agents/[id]/webhooks/test/route
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
// POST /api/agents/[id]/webhooks/test - Send test webhook
// ============================================

export async function POST(
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

    if (!agent.webhook_url) {
      return NextResponse.json(
        { error: 'Agent does not have a webhook URL configured' },
        { status: 400 }
      );
    }

    // Send test webhook
    const delivery = await agentWebhookService.trigger(
      params.id,
      agent.webhook_url,
      agent.webhook_secret_hash || 'test_secret',
      'proposal.created',
      {
        test: true,
        message: 'This is a test webhook from Protocol Banks',
        agent_id: agent.id,
        agent_name: agent.name,
        timestamp: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      delivery,
      message: delivery.status === 'delivered' 
        ? 'Test webhook delivered successfully' 
        : 'Test webhook delivery failed',
    });

  } catch (error) {
    console.error('Error sending test webhook:', error);
    return NextResponse.json(
      { error: 'Failed to send test webhook' },
      { status: 500 }
    );
  }
}
