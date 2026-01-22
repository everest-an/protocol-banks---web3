/**
 * API Key Authentication Middleware Tests
 * Property-based tests and unit tests for authentication
 */

import * as fc from 'fast-check';
import {
  extractAPIKeyFromHeader,
  checkPermissions,
  checkAllowedIP,
  checkAllowedOrigin,
} from '../middleware/api-key-auth';
import { generateAPIKeySecret, type APIKey, type Permission } from '../services/api-key-service';
import { createMockRequest, createAuthenticatedRequest } from '../test-utils';

// ============================================
// Mock API Key Factory
// ============================================

function createTestAPIKey(overrides: Partial<APIKey> = {}): APIKey {
  return {
    id: 'test-key-id',
    name: 'Test Key',
    key_hash: 'test-hash',
    key_prefix: 'pb_test123',
    owner_address: '0x' + '1'.repeat(40),
    permissions: ['read'] as Permission[],
    rate_limit_per_minute: 60,
    rate_limit_per_day: 10000,
    usage_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Property Tests
// ============================================

describe('API Key Auth Middleware - Property Tests', () => {
  /**
   * Property 3: Unauthenticated Request Rejection
   * Requests without valid API keys should be rejected
   */
  describe('Property 3: Unauthenticated Request Rejection', () => {
    it('should return null for requests without Authorization header', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (url, method) => {
            const request = createMockRequest({ url, method });
            const apiKey = extractAPIKeyFromHeader(request);
            expect(apiKey).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for requests with non-Bearer auth', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (token) => {
            const request = createMockRequest({
              headers: { 'Authorization': `Basic ${token}` },
            });
            const apiKey = extractAPIKeyFromHeader(request);
            expect(apiKey).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for Bearer tokens that are not API keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.startsWith('pb_')),
          (token) => {
            const request = createMockRequest({
              headers: { 'Authorization': `Bearer ${token}` },
            });
            const apiKey = extractAPIKeyFromHeader(request);
            expect(apiKey).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract valid API keys from Authorization header', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const secret = generateAPIKeySecret();
          const request = createAuthenticatedRequest({ apiKey: secret });
          const extracted = extractAPIKeyFromHeader(request);
          expect(extracted).toBe(secret);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: API Key Permission Enforcement
   * API keys should only allow operations within their permission scope
   */
  describe('Property 13: API Key Permission Enforcement', () => {
    const allPermissions: Permission[] = ['read', 'write', 'payments', 'webhooks', 'admin'];

    it('should grant all permissions to admin keys', () => {
      fc.assert(
        fc.property(
          fc.subarray(allPermissions, { minLength: 1 }),
          (requiredPermissions) => {
            const adminKey = createTestAPIKey({ permissions: ['admin'] });
            expect(checkPermissions(adminKey, requiredPermissions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deny permissions not in the key', () => {
      fc.assert(
        fc.property(
          fc.subarray(['read', 'write', 'payments', 'webhooks'] as Permission[], { minLength: 1, maxLength: 3 }),
          (grantedPermissions) => {
            const key = createTestAPIKey({ permissions: grantedPermissions });
            
            // Find a permission not granted
            const notGranted = allPermissions.filter(
              p => p !== 'admin' && !grantedPermissions.includes(p)
            );
            
            if (notGranted.length > 0) {
              expect(checkPermissions(key, [notGranted[0]])).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow permissions that are in the key', () => {
      fc.assert(
        fc.property(
          fc.subarray(['read', 'write', 'payments', 'webhooks'] as Permission[], { minLength: 1 }),
          (grantedPermissions) => {
            const key = createTestAPIKey({ permissions: grantedPermissions });
            
            // Check each granted permission individually
            grantedPermissions.forEach(permission => {
              expect(checkPermissions(key, [permission])).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require all permissions when multiple are required', () => {
      fc.assert(
        fc.property(
          fc.subarray(['read', 'write', 'payments', 'webhooks'] as Permission[], { minLength: 2 }),
          (requiredPermissions) => {
            // Key with only first permission
            const partialKey = createTestAPIKey({ permissions: [requiredPermissions[0]] });
            
            // Should fail because not all required permissions are present
            expect(checkPermissions(partialKey, requiredPermissions)).toBe(false);
            
            // Key with all permissions
            const fullKey = createTestAPIKey({ permissions: requiredPermissions });
            expect(checkPermissions(fullKey, requiredPermissions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Dual Authentication Support
   * System should support both API key and session authentication
   */
  describe('Property 14: Dual Authentication Support', () => {
    it('should extract API key when present regardless of other headers', () => {
      // Valid HTTP header names: alphanumeric and hyphens
      const validHeaderNameArb = fc.stringOf(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')),
        { minLength: 1, maxLength: 20 }
      ).filter(s => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s));

      fc.assert(
        fc.property(
          fc.dictionary(validHeaderNameArb, fc.string({ minLength: 1, maxLength: 50 })),
          (extraHeaders) => {
            const secret = generateAPIKeySecret();
            const headers = {
              ...extraHeaders,
              'Authorization': `Bearer ${secret}`,
            };
            
            const request = createMockRequest({ headers });
            const extracted = extractAPIKeyFromHeader(request);
            expect(extracted).toBe(secret);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// Unit Tests
// ============================================

describe('API Key Auth Middleware - Unit Tests', () => {
  describe('extractAPIKeyFromHeader', () => {
    it('should extract valid API key', () => {
      const request = createAuthenticatedRequest({ apiKey: 'pb_test123abc' });
      expect(extractAPIKeyFromHeader(request)).toBe('pb_test123abc');
    });

    it('should return null for missing header', () => {
      const request = createMockRequest({});
      expect(extractAPIKeyFromHeader(request)).toBeNull();
    });

    it('should return null for non-Bearer auth', () => {
      const request = createMockRequest({
        headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
      });
      expect(extractAPIKeyFromHeader(request)).toBeNull();
    });

    it('should return null for non-API key Bearer token', () => {
      const request = createMockRequest({
        headers: { 'Authorization': 'Bearer jwt_token_here' },
      });
      expect(extractAPIKeyFromHeader(request)).toBeNull();
    });
  });

  describe('checkPermissions', () => {
    it('should allow read permission for read key', () => {
      const key = createTestAPIKey({ permissions: ['read'] });
      expect(checkPermissions(key, ['read'])).toBe(true);
    });

    it('should deny write permission for read-only key', () => {
      const key = createTestAPIKey({ permissions: ['read'] });
      expect(checkPermissions(key, ['write'])).toBe(false);
    });

    it('should allow all permissions for admin key', () => {
      const key = createTestAPIKey({ permissions: ['admin'] });
      expect(checkPermissions(key, ['read', 'write', 'payments', 'webhooks'])).toBe(true);
    });

    it('should require all permissions when multiple specified', () => {
      const key = createTestAPIKey({ permissions: ['read', 'write'] });
      expect(checkPermissions(key, ['read', 'write'])).toBe(true);
      expect(checkPermissions(key, ['read', 'write', 'payments'])).toBe(false);
    });
  });

  describe('checkAllowedIP', () => {
    it('should allow any IP when no restrictions', () => {
      const key = createTestAPIKey({ allowed_ips: undefined });
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      expect(checkAllowedIP(key, request)).toBe(true);
    });

    it('should allow IP in whitelist', () => {
      const key = createTestAPIKey({ allowed_ips: ['192.168.1.1', '10.0.0.1'] });
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      expect(checkAllowedIP(key, request)).toBe(true);
    });

    it('should deny IP not in whitelist', () => {
      const key = createTestAPIKey({ allowed_ips: ['192.168.1.1'] });
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      expect(checkAllowedIP(key, request)).toBe(false);
    });
  });

  describe('checkAllowedOrigin', () => {
    it('should allow any origin when no restrictions', () => {
      const key = createTestAPIKey({ allowed_origins: undefined });
      const request = createMockRequest({
        headers: { 'origin': 'https://example.com' },
      });
      expect(checkAllowedOrigin(key, request)).toBe(true);
    });

    it('should allow origin in whitelist', () => {
      const key = createTestAPIKey({ allowed_origins: ['https://example.com', 'https://app.example.com'] });
      const request = createMockRequest({
        headers: { 'origin': 'https://example.com' },
      });
      expect(checkAllowedOrigin(key, request)).toBe(true);
    });

    it('should deny origin not in whitelist', () => {
      const key = createTestAPIKey({ allowed_origins: ['https://example.com'] });
      const request = createMockRequest({
        headers: { 'origin': 'https://malicious.com' },
      });
      expect(checkAllowedOrigin(key, request)).toBe(false);
    });

    it('should support wildcard origins', () => {
      const key = createTestAPIKey({ allowed_origins: ['https://*.example.com'] });
      const request = createMockRequest({
        headers: { 'origin': 'https://app.example.com' },
      });
      expect(checkAllowedOrigin(key, request)).toBe(true);
    });
  });
});
