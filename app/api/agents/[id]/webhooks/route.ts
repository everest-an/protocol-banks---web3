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
import { withAuth } from '@/lib/middleware/api-auth';

// ============================================
// GET /api/agents/[id]/webhooks - Get webhook deliveries
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

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');

      const deliveries = await agentWebhookService.getDeliveries(id, limit);

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
  }, { component: 'agents-id-webhooks' })(req);
}
