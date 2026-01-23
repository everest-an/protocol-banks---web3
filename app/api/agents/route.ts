/**
 * Agent API Routes
 * 
 * POST /api/agents - Create new agent
 * GET /api/agents - List all agents for owner
 * 
 * @module app/api/agents/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService, CreateAgentInput, AgentType } from '@/lib/services/agent-service';
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
// POST /api/agents - Create new agent
// ============================================

export async function POST(req: NextRequest) {
  try {
    const ownerAddress = await getOwnerAddress();
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'name is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate type if provided
    const validTypes: AgentType[] = ['trading', 'payroll', 'expense', 'subscription', 'custom'];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
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

    const input: CreateAgentInput = {
      owner_address: ownerAddress,
      name: body.name,
      description: body.description,
      type: body.type || 'custom',
      avatar_url: body.avatar_url,
      webhook_url: body.webhook_url,
      auto_execute_enabled: body.auto_execute_enabled || false,
      auto_execute_rules: body.auto_execute_rules,
      rate_limit_per_minute: body.rate_limit_per_minute || 60,
    };

    const result = await agentService.create(input);

    return NextResponse.json({
      success: true,
      agent: result.agent,
      api_key: result.apiKey,
      webhook_secret: result.webhookSecret,
      message: 'Agent created successfully. Save the API key - it will not be shown again.',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating agent:', error);
    
    if (error instanceof Error && error.message.includes('is required')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/agents - List all agents
// ============================================

export async function GET(req: NextRequest) {
  try {
    const ownerAddress = await getOwnerAddress();
    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const agents = await agentService.list(ownerAddress);

    return NextResponse.json({
      success: true,
      agents,
      count: agents.length,
    });

  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: 'Failed to list agents' },
      { status: 500 }
    );
  }
}
