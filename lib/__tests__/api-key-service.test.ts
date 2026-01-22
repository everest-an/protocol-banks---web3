/**
 * API Key Service Tests
 * Property-based tests and unit tests for API Key management
 */

import * as fc from 'fast-check';
import {
  generateAPIKeySecret,
  hashAPIKeySecret,
  extractKeyPrefix,
  isValidAPIKeyFormat,
} from '../services/api-key-service';
import { isValidSHA256Hash } from '../test-utils';

// ============================================
// Property Tests
// ============================================

describe('API Key Service - Property Tests', () => {
  /**
   * Property 1: API Key Secret Hashing
   * For any valid API key secret, hashing it twice produces the same hash
   * and the hash is a valid SHA-256 format
   */
  describe('Property 1: API Key Secret Hashing', () => {
    it('should produce deterministic SHA-256 hashes for any API key', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          // Generate a random API key
          const secret = generateAPIKeySecret();
          
          // Hash it twice
          const hash1 = hashAPIKeySecret(secret);
          const hash2 = hashAPIKeySecret(secret);
          
          // Hashes should be identical (deterministic)
          expect(hash1).toBe(hash2);
          
          // Hash should be valid SHA-256 format (64 hex characters)
          expect(isValidSHA256Hash(hash1)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce different hashes for different secrets', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const secret1 = generateAPIKeySecret();
          const secret2 = generateAPIKeySecret();
          
          // Different secrets should produce different hashes
          // (collision probability is negligible for SHA-256)
          expect(hashAPIKeySecret(secret1)).not.toBe(hashAPIKeySecret(secret2));
        }),
        { numRuns: 100 }
      );
    });

    it('should hash arbitrary strings consistently', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1000 }), (input) => {
          const hash1 = hashAPIKeySecret(input);
          const hash2 = hashAPIKeySecret(input);
          
          expect(hash1).toBe(hash2);
          expect(isValidSHA256Hash(hash1)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: API Key CRUD Round-Trip
   * Generated API keys should have valid format and extractable prefix
   */
  describe('Property 2: API Key Format and Prefix', () => {
    it('should generate API keys with valid format', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const secret = generateAPIKeySecret();
          
          // Should have valid format
          expect(isValidAPIKeyFormat(secret)).toBe(true);
          
          // Should start with pb_
          expect(secret.startsWith('pb_')).toBe(true);
          
          // Should be correct length (pb_ + 64 hex chars = 67)
          expect(secret.length).toBe(67);
        }),
        { numRuns: 100 }
      );
    });

    it('should extract consistent prefix from API keys', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const secret = generateAPIKeySecret();
          const prefix = extractKeyPrefix(secret);
          
          // Prefix should be first 11 characters (pb_ + 8 hex chars)
          expect(prefix.length).toBe(11);
          expect(prefix.startsWith('pb_')).toBe(true);
          expect(secret.startsWith(prefix)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid API key formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Missing prefix
            fc.hexaString({ minLength: 64, maxLength: 64 }),
            // Wrong prefix
            fc.hexaString({ minLength: 64, maxLength: 64 }).map(h => `pk_${h}`),
            // Too short
            fc.hexaString({ minLength: 10, maxLength: 30 }).map(h => `pb_${h}`),
            // Too long
            fc.hexaString({ minLength: 70, maxLength: 100 }).map(h => `pb_${h}`),
            // Invalid characters
            fc.string({ minLength: 64, maxLength: 64 }).filter(s => !/^[a-f0-9]+$/i.test(s)).map(s => `pb_${s}`)
          ),
          (invalidKey) => {
            expect(isValidAPIKeyFormat(invalidKey)).toBe(false);
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

describe('API Key Service - Unit Tests', () => {
  describe('generateAPIKeySecret', () => {
    it('should generate unique keys on each call', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateAPIKeySecret());
      }
      expect(keys.size).toBe(100);
    });

    it('should generate keys with pb_ prefix', () => {
      const key = generateAPIKeySecret();
      expect(key.startsWith('pb_')).toBe(true);
    });

    it('should generate keys with 64 hex characters after prefix', () => {
      const key = generateAPIKeySecret();
      const hexPart = key.slice(3);
      expect(hexPart.length).toBe(64);
      expect(/^[a-f0-9]+$/i.test(hexPart)).toBe(true);
    });
  });

  describe('hashAPIKeySecret', () => {
    it('should produce 64-character hex hash', () => {
      const hash = hashAPIKeySecret('test-secret');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/i.test(hash)).toBe(true);
    });

    it('should produce known hash for known input', () => {
      // SHA-256 of 'test' is known
      const hash = hashAPIKeySecret('test');
      expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });
  });

  describe('extractKeyPrefix', () => {
    it('should extract first 11 characters', () => {
      const prefix = extractKeyPrefix('pb_abcdef12345678901234567890123456789012345678901234567890123456');
      expect(prefix).toBe('pb_abcdef12');
    });

    it('should throw for invalid format', () => {
      expect(() => extractKeyPrefix('invalid_key')).toThrow('Invalid API key format');
    });
  });

  describe('isValidAPIKeyFormat', () => {
    it('should accept valid API keys', () => {
      const validKey = 'pb_' + 'a'.repeat(64);
      expect(isValidAPIKeyFormat(validKey)).toBe(true);
    });

    it('should reject keys without pb_ prefix', () => {
      expect(isValidAPIKeyFormat('pk_' + 'a'.repeat(64))).toBe(false);
    });

    it('should reject keys with wrong length', () => {
      expect(isValidAPIKeyFormat('pb_' + 'a'.repeat(32))).toBe(false);
      expect(isValidAPIKeyFormat('pb_' + 'a'.repeat(128))).toBe(false);
    });

    it('should reject keys with non-hex characters', () => {
      expect(isValidAPIKeyFormat('pb_' + 'g'.repeat(64))).toBe(false);
    });
  });
});
