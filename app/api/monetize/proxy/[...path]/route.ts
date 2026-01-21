/**
 * Dynamic Monetized API Proxy
 * 
 * Proxies requests to upstream APIs with payment verification.
 * Uses configuration from monetizer_configs table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  APIMonetizer, 
  type MonetizeConfig,
  type PricingConfig,
} from '@/packages/sdk/src/modules/monetizer';
import { getUsageTracker } from '@/services/usage-tracker.service';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

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
// Configuration Cache
// ============================================================================

const configCache = new Map<string, { config: MonetizeConfig; expiry: number }>();
const CACHE_TTL = 60000; // 1 minute

async function getMonetizeConfig(configId: string): Promise<MonetizeConfig | null> {
  // Check cache
  const cached = configCache.get(configId);
  if (cached && cached.expiry > Date.now()) {
    return cached.config;
  }
  
  // Fetch from database
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('monetizer_configs')
    .select('*')
    .eq('id', configId)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Transform to MonetizeConfig
  const config: MonetizeConfig = {
    upstream: {
      url: data.upstream_url,
      headers: data.upstream_headers ?? undefined,
    },
    pricing: data.pricing_config as PricingConfig,
    recipient: data.recipient_address,
    network: data.network ?? 'base',
    token: data.token ?? 'USDC',
    rateLimit: data.rate_limit_config ?? undefined,
    analytics: true,
    allowlist: data.allowlist ?? undefined,
    blocklist: data.blocklist ?? undefined,
  };
  
  // Cache
  configCache.set(configId, { config, expiry: Date.now() + CACHE_TTL });
  
  return config;
}

// ============================================================================
// Monetizer Cache
// ============================================================================

const monetizerCache = new Map<string, APIMonetizer>();

function getMonetizer(configId: string, config: MonetizeConfig): APIMonetizer {
  let monetizer = monetizerCache.get(configId);
  
  if (!monetizer) {
    monetizer = new APIMonetizer(config);
    monetizer.setUsageTracker(getUsageTracker());
    monetizerCache.set(configId, monetizer);
  }
  
  return monetizer;
}

// ============================================================================
// Request Handler
// ============================================================================

async function handleRequest(
  request: NextRequest,
  params: RouteParams
): Promise<NextResponse> {
  try {
    const resolvedParams = await params.params;
    const pathSegments = resolvedParams.path;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }
    
    // First segment is config ID, rest is the path
    const configId = pathSegments[0];
    const apiPath = '/' + pathSegments.slice(1).join('/');
    
    // Get configuration
    const config = await getMonetizeConfig(configId);
    
    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found or inactive' },
        { status: 404 }
      );
    }
    
    // Get or create monetizer
    const monetizer = getMonetizer(configId, config);
    
    // Create a new request with the correct path
    const url = new URL(request.url);
    url.pathname = apiPath;
    
    const proxyRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // Handle request through monetizer
    const response = await monetizer.handleRequest(proxyRequest);
    
    // Convert to NextResponse
    const body = await response.text();
    
    return new NextResponse(body, {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

export async function GET(request: NextRequest, params: RouteParams) {
  return handleRequest(request, params);
}

export async function POST(request: NextRequest, params: RouteParams) {
  return handleRequest(request, params);
}

export async function PUT(request: NextRequest, params: RouteParams) {
  return handleRequest(request, params);
}

export async function PATCH(request: NextRequest, params: RouteParams) {
  return handleRequest(request, params);
}

export async function DELETE(request: NextRequest, params: RouteParams) {
  return handleRequest(request, params);
}

export async function OPTIONS(request: NextRequest, params: RouteParams) {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment, X-Payment-Request',
      'Access-Control-Max-Age': '86400',
    },
  });
}
