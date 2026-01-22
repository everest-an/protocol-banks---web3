/**
 * API Key Service
 * Manages programmatic access credentials with secure hashing and validation
 */

import { createHash, randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export type Permission = 'read' | 'write' | 'payments' | 'webhooks' | 'admin';

export interface APIKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  owner_address: string;
  permissions: Permission[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  allowed_ips?: string[];
  allowed_origins?: string[];
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAPIKeyInput {
  name: string;
  owner_address: string;
  permissions?: Permission[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  allowed_ips?: string[];
  allowed_origins?: string[];
  expires_at?: string;
}

export interface APIKeyValidationResult {
  valid: boolean;
  key?: APIKey;
  error?: string;
}

export interface APIKeyUsageLog {
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// Constants
// ============================================

const API_KEY_PREFIX = 'pb_';
const API_KEY_LENGTH = 32; // 32 bytes = 64 hex characters

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a cryptographically secure random API key
 */
export function generateAPIKeySecret(): string {
  const randomPart = randomBytes(API_KEY_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key secret using SHA-256
 */
export function hashAPIKeySecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Extract the prefix from an API key (first 8 characters after pb_)
 */
export function extractKeyPrefix(secret: string): string {
  if (!secret.startsWith(API_KEY_PREFIX)) {
    throw new Error('Invalid API key format');
  }
  return secret.slice(0, API_KEY_PREFIX.length + 8);
}

/**
 * Validate API key format
 */
export function isValidAPIKeyFormat(secret: string): boolean {
  // Format: pb_ followed by 64 hex characters
  const regex = new RegExp(`^${API_KEY_PREFIX}[a-f0-9]{64}$`, 'i');
  return regex.test(secret);
}

// ============================================
// API Key Service
// ============================================

export class APIKeyService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new API key
   * Returns the key object and the secret (shown only once)
   */
  async create(input: CreateAPIKeyInput): Promise<{ key: APIKey; secret: string }> {
    // Generate secret and hash
    const secret = generateAPIKeySecret();
    const keyHash = hashAPIKeySecret(secret);
    const keyPrefix = extractKeyPrefix(secret);

    // Prepare data for insertion
    const keyData = {
      name: input.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      owner_address: input.owner_address.toLowerCase(),
      permissions: input.permissions || ['read'],
      rate_limit_per_minute: input.rate_limit_per_minute || 60,
      rate_limit_per_day: input.rate_limit_per_day || 10000,
      allowed_ips: input.allowed_ips || null,
      allowed_origins: input.allowed_origins || null,
      expires_at: input.expires_at || null,
      is_active: true,
      usage_count: 0,
    };

    // Insert into database
    const { data, error } = await this.supabase
      .from('api_keys')
      .insert([keyData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    return {
      key: data as APIKey,
      secret,
    };
  }

  /**
   * List all API keys for an owner (without secrets)
   */
  async list(ownerAddress: string): Promise<APIKey[]> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('owner_address', ownerAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }

    return (data || []) as APIKey[];
  }

  /**
   * Get a single API key by ID
   */
  async getById(id: string, ownerAddress: string): Promise<APIKey | null> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get API key: ${error.message}`);
    }

    return data as APIKey;
  }

  /**
   * Revoke (delete) an API key
   */
  async revoke(id: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from('api_keys')
      .delete()
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  /**
   * Validate an API key secret
   * Checks format, hash match, expiration, and active status
   */
  async validate(secret: string): Promise<APIKeyValidationResult> {
    // Check format
    if (!isValidAPIKeyFormat(secret)) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash the secret
    const keyHash = hashAPIKeySecret(secret);

    // Look up by hash
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      return { valid: false, error: 'API key not found' };
    }

    const key = data as APIKey;

    // Check if active
    if (!key.is_active) {
      return { valid: false, error: 'API key is inactive' };
    }

    // Check expiration
    if (key.expires_at) {
      const expiresAt = new Date(key.expires_at);
      if (expiresAt < new Date()) {
        return { valid: false, error: 'API key has expired' };
      }
    }

    // Update last_used_at and usage_count
    await this.supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: key.usage_count + 1,
      })
      .eq('id', key.id);

    return { valid: true, key };
  }

  /**
   * Check if an API key has a specific permission
   */
  hasPermission(key: APIKey, permission: Permission): boolean {
    // Admin has all permissions
    if (key.permissions.includes('admin')) {
      return true;
    }
    return key.permissions.includes(permission);
  }

  /**
   * Log API key usage
   */
  async logUsage(log: APIKeyUsageLog): Promise<void> {
    const { error } = await this.supabase
      .from('api_key_usage_logs')
      .insert([{
        api_key_id: log.api_key_id,
        endpoint: log.endpoint,
        method: log.method,
        status_code: log.status_code,
        response_time_ms: log.response_time_ms,
        ip_address: log.ip_address || null,
        user_agent: log.user_agent || null,
      }]);

    if (error) {
      // Log error but don't throw - usage logging shouldn't break the request
      console.error('[APIKeyService] Failed to log usage:', error.message);
    }
  }

  /**
   * Deactivate an API key (soft delete)
   */
  async deactivate(id: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from('api_keys')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to deactivate API key: ${error.message}`);
    }
  }
}

// Export singleton instance
export const apiKeyService = new APIKeyService();
