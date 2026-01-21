/**
 * Usage Statistics API
 * 
 * Get usage statistics for monetized APIs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// GET - Get usage statistics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') ?? 'summary';
    const walletAddress = searchParams.get('wallet');
    const endpoint = searchParams.get('endpoint');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendorId = searchParams.get('vendorId');
    
    switch (type) {
      case 'summary':
        return getSummaryStats(supabase, { startDate, endDate, vendorId });
        
      case 'revenue':
        return getRevenueStats(supabase);
        
      case 'wallet':
        if (!walletAddress) {
          return NextResponse.json(
            { error: 'Wallet address is required for wallet stats' },
            { status: 400 }
          );
        }
        return getWalletStats(supabase, walletAddress);
        
      case 'endpoints':
        return getEndpointStats(supabase, { vendorId });
        
      case 'recent':
        return getRecentUsage(supabase, { endpoint, walletAddress, limit: 100 });
        
      default:
        return NextResponse.json(
          { error: 'Invalid stats type' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('GET /api/monetize/usage error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Summary Statistics
// ============================================================================

async function getSummaryStats(
  supabase: ReturnType<typeof createClient>,
  options: { startDate?: string | null; endDate?: string | null; vendorId?: string | null }
) {
  let query = supabase
    .from('api_usage')
    .select('wallet_address, amount_charged, latency_ms, response_status');
  
  if (options.startDate) {
    query = query.gte('request_timestamp', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('request_timestamp', options.endDate);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch usage stats', details: error.message },
      { status: 500 }
    );
  }
  
  const totalRequests = data?.length ?? 0;
  const totalRevenue = (data ?? []).reduce(
    (sum, r) => sum + parseFloat(r.amount_charged || '0'),
    0
  ).toFixed(6);
  
  const uniqueWallets = new Set((data ?? []).map(r => r.wallet_address?.toLowerCase())).size;
  
  const latencies = (data ?? []).filter(r => r.latency_ms).map(r => r.latency_ms);
  const averageLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
    : 0;
  
  const successCount = (data ?? []).filter(
    r => r.response_status && r.response_status >= 200 && r.response_status < 300
  ).length;
  const successRate = totalRequests > 0 ? (successCount / totalRequests * 100).toFixed(1) : '0';
  
  return NextResponse.json({
    stats: {
      totalRequests,
      totalRevenue,
      uniqueWallets,
      averageLatency,
      successRate: `${successRate}%`,
    },
  });
}

// ============================================================================
// Revenue Statistics
// ============================================================================

async function getRevenueStats(supabase: ReturnType<typeof createClient>) {
  // Daily revenue (last 30 days)
  const { data: dailyData, error: dailyError } = await supabase.rpc('get_daily_revenue', {
    days_back: 30,
  });
  
  // Weekly revenue (last 12 weeks)
  const { data: weeklyData, error: weeklyError } = await supabase.rpc('get_weekly_revenue', {
    weeks_back: 12,
  });
  
  // Monthly revenue (last 12 months)
  const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_monthly_revenue', {
    months_back: 12,
  });
  
  if (dailyError || weeklyError || monthlyError) {
    // Fallback to manual calculation if functions don't exist
    return getRevenueStatsFallback(supabase);
  }
  
  return NextResponse.json({
    revenue: {
      daily: dailyData ?? [],
      weekly: weeklyData ?? [],
      monthly: monthlyData ?? [],
    },
  });
}

async function getRevenueStatsFallback(supabase: ReturnType<typeof createClient>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('api_usage')
    .select('amount_charged, request_timestamp')
    .gte('request_timestamp', thirtyDaysAgo);
  
  // Group by day
  const dailyMap = new Map<string, { revenue: number; requests: number }>();
  
  for (const record of data ?? []) {
    const date = new Date(record.request_timestamp).toISOString().split('T')[0];
    const existing = dailyMap.get(date) ?? { revenue: 0, requests: 0 };
    existing.revenue += parseFloat(record.amount_charged || '0');
    existing.requests += 1;
    dailyMap.set(date, existing);
  }
  
  const daily = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      revenue: stats.revenue.toFixed(6),
      requests: stats.requests,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  
  return NextResponse.json({
    revenue: {
      daily,
      weekly: [],
      monthly: [],
    },
  });
}

// ============================================================================
// Wallet Statistics
// ============================================================================

async function getWalletStats(
  supabase: ReturnType<typeof createClient>,
  walletAddress: string
) {
  const { data, error } = await supabase
    .from('api_usage')
    .select('endpoint, amount_charged, request_timestamp, response_status, latency_ms')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('request_timestamp', { ascending: false })
    .limit(1000);
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch wallet stats', details: error.message },
      { status: 500 }
    );
  }
  
  const totalRequests = data?.length ?? 0;
  const totalSpent = (data ?? []).reduce(
    (sum, r) => sum + parseFloat(r.amount_charged || '0'),
    0
  ).toFixed(6);
  
  const lastRequest = data?.[0]?.request_timestamp ?? null;
  
  // Group by endpoint
  const endpointMap = new Map<string, number>();
  for (const record of data ?? []) {
    const count = endpointMap.get(record.endpoint) ?? 0;
    endpointMap.set(record.endpoint, count + 1);
  }
  
  const topEndpoints = Array.from(endpointMap.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return NextResponse.json({
    wallet: {
      address: walletAddress,
      totalRequests,
      totalSpent,
      lastRequest,
      topEndpoints,
    },
  });
}

// ============================================================================
// Endpoint Statistics
// ============================================================================

async function getEndpointStats(
  supabase: ReturnType<typeof createClient>,
  options: { vendorId?: string | null }
) {
  const { data, error } = await supabase
    .from('api_usage')
    .select('endpoint, amount_charged, latency_ms, response_status');
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch endpoint stats', details: error.message },
      { status: 500 }
    );
  }
  
  // Group by endpoint
  const endpointMap = new Map<string, {
    requests: number;
    revenue: number;
    latencies: number[];
    successes: number;
  }>();
  
  for (const record of data ?? []) {
    const existing = endpointMap.get(record.endpoint) ?? {
      requests: 0,
      revenue: 0,
      latencies: [],
      successes: 0,
    };
    
    existing.requests += 1;
    existing.revenue += parseFloat(record.amount_charged || '0');
    if (record.latency_ms) existing.latencies.push(record.latency_ms);
    if (record.response_status >= 200 && record.response_status < 300) {
      existing.successes += 1;
    }
    
    endpointMap.set(record.endpoint, existing);
  }
  
  const endpoints = Array.from(endpointMap.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      totalRequests: stats.requests,
      totalRevenue: stats.revenue.toFixed(6),
      averageLatency: stats.latencies.length > 0
        ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
        : 0,
      successRate: stats.requests > 0
        ? `${(stats.successes / stats.requests * 100).toFixed(1)}%`
        : '0%',
    }))
    .sort((a, b) => b.totalRequests - a.totalRequests);
  
  return NextResponse.json({ endpoints });
}

// ============================================================================
// Recent Usage
// ============================================================================

async function getRecentUsage(
  supabase: ReturnType<typeof createClient>,
  options: { endpoint?: string | null; walletAddress?: string | null; limit: number }
) {
  let query = supabase
    .from('api_usage')
    .select('*')
    .order('request_timestamp', { ascending: false })
    .limit(options.limit);
  
  if (options.endpoint) {
    query = query.eq('endpoint', options.endpoint);
  }
  if (options.walletAddress) {
    query = query.eq('wallet_address', options.walletAddress.toLowerCase());
  }
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch recent usage', details: error.message },
      { status: 500 }
    );
  }
  
  const records = (data ?? []).map(r => ({
    id: r.id,
    walletAddress: r.wallet_address,
    endpoint: r.endpoint,
    method: r.method,
    amountCharged: r.amount_charged,
    paymentTxHash: r.payment_tx_hash,
    timestamp: r.request_timestamp,
    responseStatus: r.response_status,
    latencyMs: r.latency_ms,
    tokensInput: r.tokens_input,
    tokensOutput: r.tokens_output,
  }));
  
  return NextResponse.json({ records });
}
