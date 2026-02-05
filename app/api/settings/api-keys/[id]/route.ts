/**
 * API Key Management Endpoints - Single Key Operations
 * GET /api/settings/api-keys/[id] - Get a specific API key
 * DELETE /api/settings/api-keys/[id] - Revoke (delete) an API key
 * PATCH /api/settings/api-keys/[id] - Deactivate an API key
 */

import { type NextRequest, NextResponse } from 'next/server';
import { APIKeyService } from '@/lib/services/api-key-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

const apiKeyService = new APIKeyService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/settings/api-keys/[id]
 * Get a specific API key by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get API key
    const key = await apiKeyService.getById(id, ownerAddress);

    if (!key) {
      return NextResponse.json(
        { error: 'Not Found', message: 'API key not found' },
        { status: 404 }
      );
    }

    // Return key without sensitive data
    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        permissions: key.permissions,
        rate_limit_per_minute: key.rate_limit_per_minute,
        rate_limit_per_day: key.rate_limit_per_day,
        allowed_ips: key.allowed_ips,
        allowed_origins: key.allowed_origins,
        expires_at: key.expires_at,
        last_used_at: key.last_used_at,
        usage_count: key.usage_count,
        is_active: key.is_active,
        created_at: key.created_at,
        updated_at: key.updated_at,
      },
    });

  } catch (error: any) {
    console.error('[API Keys] Get error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to get API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/api-keys/[id]
 * Revoke (permanently delete) an API key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if key exists
    const existingKey = await apiKeyService.getById(id, ownerAddress);
    if (!existingKey) {
      return NextResponse.json(
        { error: 'Not Found', message: 'API key not found' },
        { status: 404 }
      );
    }

    // Revoke (delete) the key
    await apiKeyService.revoke(id, ownerAddress);

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });

  } catch (error: any) {
    console.error('[API Keys] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/api-keys/[id]
 * Deactivate an API key (soft delete)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get authenticated user
    const ownerAddress = await getAuthenticatedAddress(request);

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action } = body;

    if (action !== 'deactivate') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid action. Supported actions: deactivate' },
        { status: 400 }
      );
    }

    // Check if key exists
    const existingKey = await apiKeyService.getById(id, ownerAddress);
    if (!existingKey) {
      return NextResponse.json(
        { error: 'Not Found', message: 'API key not found' },
        { status: 404 }
      );
    }

    if (!existingKey.is_active) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'API key is already inactive' },
        { status: 400 }
      );
    }

    // Deactivate the key
    await apiKeyService.deactivate(id, ownerAddress);

    return NextResponse.json({
      success: true,
      message: 'API key deactivated successfully',
    });

  } catch (error: any) {
    console.error('[API Keys] Patch error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to update API key' },
      { status: 500 }
    );
  }
}
