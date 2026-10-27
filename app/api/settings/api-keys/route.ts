/**
 * API Key Management Endpoints
 * POST /api/settings/api-keys - Create a new API key
 * GET /api/settings/api-keys - List all API keys for the authenticated user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { APIKeyService, type Permission } from '@/lib/services/api-key-service';
import { withAuth } from '@/lib/middleware/api-auth';
import { resolveAgentPolicy } from '@/lib/agent/policy';
import { recordEvent } from '@/lib/analytics/events';

const apiKeyService = new APIKeyService();

// Valid permissions
const VALID_PERMISSIONS: Permission[] = ['read', 'write', 'payments', 'webhooks', 'admin'];

/**
 * POST /api/settings/api-keys
 * Create a new API key
 */
export const POST = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    // Parse request body
    const body = await request.json();
    const { name, permissions, policy, rate_limit_per_minute, rate_limit_per_day, allowed_ips, allowed_origins, expires_at } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Validate permissions if provided
    if (permissions) {
      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Permissions must be an array' },
          { status: 400 }
        );
      }

      const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: `Invalid permissions: ${invalidPermissions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Resolve the agent policy. A key created without one starts read-only
    // under the strict defaults, never under the legacy all-ops policy.
    const resolvedPolicy = resolveAgentPolicy(policy ?? {});
    if (!resolvedPolicy.ok) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid policy', details: resolvedPolicy.errors },
        { status: 400 }
      );
    }

    // Validate rate limits if provided
    if (rate_limit_per_minute !== undefined && (typeof rate_limit_per_minute !== 'number' || rate_limit_per_minute < 1)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'rate_limit_per_minute must be a positive number' },
        { status: 400 }
      );
    }

    if (rate_limit_per_day !== undefined && (typeof rate_limit_per_day !== 'number' || rate_limit_per_day < 1)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'rate_limit_per_day must be a positive number' },
        { status: 400 }
      );
    }

    // Validate expires_at if provided
    if (expires_at) {
      const expiresDate = new Date(expires_at);
      if (isNaN(expiresDate.getTime())) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'expires_at must be a valid date' },
          { status: 400 }
        );
      }
      if (expiresDate <= new Date()) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'expires_at must be in the future' },
          { status: 400 }
        );
      }
    }

    // Create API key
    const { key, secret } = await apiKeyService.create({
      name: name.trim(),
      owner_address: ownerAddress,
      permissions: permissions || ['read'],
      policy: resolvedPolicy.policy,
      rate_limit_per_minute,
      rate_limit_per_day,
      allowed_ips,
      allowed_origins,
      expires_at,
    });

    // Acquisition funnel: a key was created, with the policy it was born with.
    void recordEvent({
      name: 'api_key_created',
      wallet: ownerAddress,
      props: {
        permissions: key.permissions,
        allowedOps: resolvedPolicy.policy.allowedOps,
        maxNotionalUsd: resolvedPolicy.policy.maxNotionalUsd,
        dailyCapUsd: resolvedPolicy.policy.dailyCapUsd,
      },
    });

    // Return key info with secret (shown only once)
    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        permissions: key.permissions,
        policy: resolvedPolicy.policy,
        rate_limit_per_minute: key.rate_limit_per_minute,
        rate_limit_per_day: key.rate_limit_per_day,
        expires_at: key.expires_at,
        created_at: key.created_at,
      },
      secret, // Only returned on creation
      message: 'API key created successfully. Save the secret now - it will not be shown again.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[API Keys] Create error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to create API key' },
      { status: 500 }
    );
  }
}, { component: 'settings-api-keys' })

/**
 * GET /api/settings/api-keys
 * List all API keys for the authenticated user
 */
export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    // List API keys (without secrets)
    const keys = await apiKeyService.list(ownerAddress);

    // Return keys without sensitive data
    const sanitizedKeys = keys.map(key => ({
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      permissions: key.permissions,
      policy: key.policy ?? null,
      rate_limit_per_minute: key.rate_limit_per_minute,
      rate_limit_per_day: key.rate_limit_per_day,
      allowed_ips: key.allowed_ips,
      allowed_origins: key.allowed_origins,
      expires_at: key.expires_at,
      last_used_at: key.last_used_at,
      usage_count: key.usage_count,
      is_active: key.is_active,
      created_at: key.created_at,
    }));

    return NextResponse.json({
      success: true,
      keys: sanitizedKeys,
      count: sanitizedKeys.length,
    });

  } catch (error: any) {
    console.error('[API Keys] List error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Failed to list API keys' },
      { status: 500 }
    );
  }
}, { component: 'settings-api-keys' })
