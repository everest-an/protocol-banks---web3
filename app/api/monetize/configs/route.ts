/**
 * Monetizer Configurations API
 * 
 * CRUD operations for API monetization configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface MonetizeConfigInput {
  name: string;
  description?: string;
  upstreamUrl: string;
  upstreamHeaders?: Record<string, string>;
  pricingModel: 'perRequest' | 'perToken' | 'dynamic' | 'tiered';
  pricingConfig: {
    perRequest?: string;
    perInputToken?: string;
    perOutputToken?: string;
    tiers?: { upTo: number; price: string }[];
    minPrice?: string;
    maxPrice?: string;
  };
  recipientAddress: string;
  network?: 'base' | 'ethereum' | 'polygon' | 'arbitrum';
  token?: 'USDC' | 'USDT';
  rateLimitConfig?: {
    maxPerMinute?: number;
    maxPerHour?: number;
    maxPerDay?: number;
  };
  allowlist?: string[];
  blocklist?: string[];
  isActive?: boolean;
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
// GET - List configurations
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    
    const vendorId = searchParams.get('vendorId');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    let query = supabase
      .from('monetizer_configs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch configurations', details: error.message },
        { status: 500 }
      );
    }
    
    // Transform snake_case to camelCase
    const configs = data.map(transformConfig);
    
    return NextResponse.json({ configs });
    
  } catch (error) {
    console.error('GET /api/monetize/configs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create configuration
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json() as MonetizeConfigInput & { vendorId?: string };
    
    // Validate required fields
    const validation = validateConfig(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }
    
    // Insert configuration
    const { data, error } = await supabase
      .from('monetizer_configs')
      .insert({
        vendor_id: body.vendorId,
        name: body.name,
        description: body.description,
        upstream_url: body.upstreamUrl,
        upstream_headers: body.upstreamHeaders,
        pricing_model: body.pricingModel,
        pricing_config: body.pricingConfig,
        recipient_address: body.recipientAddress,
        network: body.network ?? 'base',
        token: body.token ?? 'USDC',
        rate_limit_config: body.rateLimitConfig,
        allowlist: body.allowlist,
        blocklist: body.blocklist,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create configuration', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { config: transformConfig(data) },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('POST /api/monetize/configs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update configuration
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json() as Partial<MonetizeConfigInput> & { id: string };
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }
    
    // Build update object
    const updates: Record<string, unknown> = {};
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.upstreamUrl !== undefined) updates.upstream_url = body.upstreamUrl;
    if (body.upstreamHeaders !== undefined) updates.upstream_headers = body.upstreamHeaders;
    if (body.pricingModel !== undefined) updates.pricing_model = body.pricingModel;
    if (body.pricingConfig !== undefined) updates.pricing_config = body.pricingConfig;
    if (body.recipientAddress !== undefined) updates.recipient_address = body.recipientAddress;
    if (body.network !== undefined) updates.network = body.network;
    if (body.token !== undefined) updates.token = body.token;
    if (body.rateLimitConfig !== undefined) updates.rate_limit_config = body.rateLimitConfig;
    if (body.allowlist !== undefined) updates.allowlist = body.allowlist;
    if (body.blocklist !== undefined) updates.blocklist = body.blocklist;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    
    const { data, error } = await supabase
      .from('monetizer_configs')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to update configuration', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ config: transformConfig(data) });
    
  } catch (error) {
    console.error('PATCH /api/monetize/configs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete configuration
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('monetizer_configs')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete configuration', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('DELETE /api/monetize/configs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function validateConfig(config: MonetizeConfigInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.name?.trim()) {
    errors.push('Name is required');
  }
  
  if (!config.upstreamUrl?.trim()) {
    errors.push('Upstream URL is required');
  } else {
    try {
      new URL(config.upstreamUrl);
    } catch {
      errors.push('Invalid upstream URL');
    }
  }
  
  if (!config.pricingModel) {
    errors.push('Pricing model is required');
  } else if (!['perRequest', 'perToken', 'dynamic', 'tiered'].includes(config.pricingModel)) {
    errors.push('Invalid pricing model');
  }
  
  if (!config.pricingConfig) {
    errors.push('Pricing configuration is required');
  } else {
    if (config.pricingModel === 'perRequest' && !config.pricingConfig.perRequest) {
      errors.push('perRequest price is required for perRequest model');
    }
    if (config.pricingModel === 'perToken') {
      if (!config.pricingConfig.perInputToken) {
        errors.push('perInputToken is required for perToken model');
      }
      if (!config.pricingConfig.perOutputToken) {
        errors.push('perOutputToken is required for perToken model');
      }
    }
    if (config.pricingModel === 'tiered' && (!config.pricingConfig.tiers || config.pricingConfig.tiers.length === 0)) {
      errors.push('Tiers are required for tiered model');
    }
  }
  
  if (!config.recipientAddress?.trim()) {
    errors.push('Recipient address is required');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(config.recipientAddress)) {
    errors.push('Invalid recipient address');
  }
  
  return { valid: errors.length === 0, errors };
}

function transformConfig(data: Record<string, unknown>) {
  return {
    id: data.id,
    vendorId: data.vendor_id,
    name: data.name,
    description: data.description,
    upstreamUrl: data.upstream_url,
    upstreamHeaders: data.upstream_headers,
    pricingModel: data.pricing_model,
    pricingConfig: data.pricing_config,
    recipientAddress: data.recipient_address,
    network: data.network,
    token: data.token,
    rateLimitConfig: data.rate_limit_config,
    allowlist: data.allowlist,
    blocklist: data.blocklist,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
