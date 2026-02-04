/**
 * API Key Service
 * Manages programmatic access credentials with secure hashing and validation
 */

import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

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
  constructor() {}

  /**
   * Create a new API key
   * Returns the key object and the secret (shown only once)
   */
  async create(input: CreateAPIKeyInput): Promise<{ key: APIKey; secret: string }> {
    // Generate secret and hash
    const secret = generateAPIKeySecret();
    const keyHash = hashAPIKeySecret(secret);
    const keyPrefix = extractKeyPrefix(secret);

    try {
      // Insert into database
      const apiKey = await prisma.apiKey.create({
        data: {
          name: input.name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          owner_address: input.owner_address.toLowerCase(),
          permissions: (input.permissions || ['read']) as string[],
          rate_limit_per_minute: input.rate_limit_per_minute || 60,
          rate_limit_per_day: input.rate_limit_per_day || 10000,
          allowed_ips: input.allowed_ips || [],
          allowed_origins: input.allowed_origins || [],
          expires_at: input.expires_at ? new Date(input.expires_at) : null,
          is_active: true,
          usage_count: 0,
        }
      });

      return {
        key: this.mapToType(apiKey),
        secret,
      };
    } catch (error: any) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }
  }

  private mapToType(record: any): APIKey {
    return {
      ...record,
      permissions: record.permissions as Permission[],
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
      expires_at: record.expires_at?.toISOString(),
      last_used_at: record.last_used_at?.toISOString()
    };
  }

  /**
   * List all API keys for an owner (without secrets)
   */
  async list(ownerAddress: string): Promise<APIKey[]> {
    try {
      const keys = await prisma.apiKey.findMany({
        where: {
          owner_address: ownerAddress.toLowerCase()
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return keys.map(k => this.mapToType(k));
    } catch (error: any) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }
  }

  /**
   * Get a single API key by ID
   */
  async getById(id: string, ownerAddress: string): Promise<APIKey | null> {
    try {
      const key = await prisma.apiKey.findFirst({
        where: {
          id,
          owner_address: ownerAddress.toLowerCase()
        }
      });

      if (!key) return null;

      return this.mapToType(key);
    } catch (error: any) {
      throw new Error(`Failed to get API key: ${error.message}`);
    }
  }

  /**
   * Revoke (delete) an API key
   */
  async revoke(id: string, ownerAddress: string): Promise<void> {
    try {
      // Check ownership first
      const count = await prisma.apiKey.count({
        where: { id, owner_address: ownerAddress.toLowerCase() }
      });
      
      if (count === 0) {
        throw new Error('API key not found or access denied');
      }

      await prisma.apiKey.delete({
        where: { id }
      });
    } catch (error: any) {
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

    try {
      // Look up by hash
      const key = await prisma.apiKey.findUnique({
        where: { key_hash: keyHash }
      });

      if (!key) {
        return { valid: false, error: 'API key not found' };
      }

      // Check if active
      if (!key.is_active) {
        return { valid: false, error: 'API key is inactive' };
      }

      // Check expiration
      if (key.expires_at) {
        if (key.expires_at < new Date()) {
          return { valid: false, error: 'API key has expired' };
        }
      }

      // Update last_used_at and usage_count
      await prisma.apiKey.update({
        where: { id: key.id },
        data: {
          last_used_at: new Date(),
          usage_count: { increment: 1 }
        }
      });

      return { valid: true, key: this.mapToType(key) };
    } catch (error) {
       return { valid: false, error: 'Validation error' };
    }
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
    try {
      await prisma.apiKeyUsageLog.create({
        data: {
          api_key_id: log.api_key_id,
          endpoint: log.endpoint,
          method: log.method,
          status_code: log.status_code,
          response_time_ms: log.response_time_ms,
          ip_address: log.ip_address || null,
          user_agent: log.user_agent || null,
        }
      });
    } catch (error: any) {
      // Log error but don't throw - usage logging shouldn't break the request
      console.error('[APIKeyService] Failed to log usage:', error.message);
    }
  }

  /**
   * Deactivate an API key (soft delete)
   */
  async deactivate(id: string, ownerAddress: string): Promise<void> {
    try {
      // Check ownership
      const key = await prisma.apiKey.findFirst({
        where: { id, owner_address: ownerAddress.toLowerCase() }
      });

      if (!key) throw new Error("Key not found");

      await prisma.apiKey.update({
        where: { id },
        data: { is_active: false } 
      });
    } catch (error: any) {
         throw new Error(`Failed to deactivate: ${error.message}`);
    }
  }
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
