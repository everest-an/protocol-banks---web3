/**
 * MCP Subscription Plans API
 * 
 * GET /api/mcp/plans - List all active subscription plans
 * GET /api/mcp/plans?id=xxx - Get a specific plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');

    if (planId) {
      // Get specific plan
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Plan not found' },
            { status: 404 }
          );
        }
        throw error;
      }

      return NextResponse.json({ plan: data });
    }

    // List all active plans
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ plans: data || [] });
  } catch (error) {
    console.error('[MCP Plans API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
