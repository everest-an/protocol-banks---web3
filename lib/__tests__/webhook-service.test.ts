/**
 * Webhook Service Tests
 * Property-based tests and unit tests for Webhook management
 */

import * as fc from 'fast-check';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  generateWebhookSignature,
  verifyWebhookSignature,
  calculateNextRetryTime,
} from '../services/webhook-service';
import { isValidSHA256Hash, isValidHMACSHA256 } from '../test-utils';

// ============================================
// Property Tests
// ============================================

describe('Webhook Service - Property Tests', () => {
  /**
   * Property 5: Webhook CRUD Round-Trip
   * Webhook secrets should be properly generated and hashed
   */
  describe('Property 5: Webhook Secret Generation', () => {
    it('should generate unique webhook secrets', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const secret1 = generateWebhookSecret();
          const secret2 = generateWebhookSecret();
          
          // Secrets should be unique
          expect(secret1).not.toBe(secret2);
          
          // Secrets should have correct prefix
          expect(secret1.startsWith('whsec_')).toBe(true);
          expect(secret2.startsWith('whsec_')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce deterministic hashes for webhook secrets', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const secret = generateWebhookSecret();
          
          const hash1 = hashWebhookSecret(secret);
          const hash2 = hashWebhookSecret(secret);
          
          // Hashes should be identical
          expect(hash1).toBe(hash2);
          
          // Hash should be valid SHA-256
          expect(isValidSHA256Hash(hash1)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce different hashes for different secrets', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const secret1 = generateWebhookSecret();
          const secret2 = generateWebhookSecret();
          
          expect(hashWebhookSecret(secret1)).not.toBe(hashWebhookSecret(secret2));
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Webhook Signature Verification
   * Signatures should be verifiable with the correct secret
   */
  describe('Property 6: Webhook Signature Verification', () => {
    it('should verify signatures with correct secret', () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.integer({ min: 1, max: 100 }),
          (payload) => {
            const secret = generateWebhookSecret();
            const payloadStr = JSON.stringify(payload);
            
            const signature = generateWebhookSignature(payloadStr, secret);
            
            // Signature should be valid HMAC-SHA256
            expect(isValidHMACSHA256(signature)).toBe(true);
            
            // Verification should succeed with correct secret
            expect(verifyWebhookSignature(payloadStr, signature, secret)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures with wrong secret', () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.integer({ min: 1, max: 100 }),
          (payload) => {
            const secret1 = generateWebhookSecret();
            const secret2 = generateWebhookSecret();
            const payloadStr = JSON.stringify(payload);
            
            const signature = generateWebhookSignature(payloadStr, secret1);
            
            // Verification should fail with wrong secret
            expect(verifyWebhookSignature(payloadStr, signature, secret2)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures with modified payload', () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.string({ minLength: 1, maxLength: 10 }),
          (payload, modification) => {
            const secret = generateWebhookSecret();
            const payloadStr = JSON.stringify(payload);
            
            const signature = generateWebhookSignature(payloadStr, secret);
            
            // Modified payload should fail verification
            const modifiedPayload = payloadStr + modification;
            expect(verifyWebhookSignature(modifiedPayload, signature, secret)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different signatures for different payloads', () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.json().filter(p => JSON.stringify(p) !== '{}'),
          (payload1, payload2) => {
            const secret = generateWebhookSecret();
            const str1 = JSON.stringify(payload1);
            const str2 = JSON.stringify(payload2);
            
            if (str1 !== str2) {
              const sig1 = generateWebhookSignature(str1, secret);
              const sig2 = generateWebhookSignature(str2, secret);
              expect(sig1).not.toBe(sig2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Webhook Retry Behavior
   * Retry times should increase with each attempt
   */
  describe('Property 7: Webhook Retry Behavior', () => {
    it('should calculate increasing retry delays', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (attempt) => {
            const retryTime = calculateNextRetryTime(attempt);
            
            // Retry time should be in the future
            expect(retryTime.getTime()).toBeGreaterThan(Date.now());
            
            // Higher attempts should have longer delays (up to max)
            if (attempt > 0) {
              const prevRetryTime = calculateNextRetryTime(attempt - 1);
              // Allow for timing variations
              expect(retryTime.getTime()).toBeGreaterThanOrEqual(prevRetryTime.getTime() - 1000);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap retry delays at maximum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (attempt) => {
            const retryTime1 = calculateNextRetryTime(attempt);
            const retryTime2 = calculateNextRetryTime(attempt + 1);
            
            // After reaching max, delays should be the same
            const diff = Math.abs(retryTime1.getTime() - retryTime2.getTime());
            expect(diff).toBeLessThan(1000); // Allow 1 second variance
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

describe('Webhook Service - Unit Tests', () => {
  describe('generateWebhookSecret', () => {
    it('should generate secret with whsec_ prefix', () => {
      const secret = generateWebhookSecret();
      expect(secret.startsWith('whsec_')).toBe(true);
    });

    it('should generate 64 hex characters after prefix', () => {
      const secret = generateWebhookSecret();
      const hexPart = secret.slice(6);
      expect(hexPart.length).toBe(64);
      expect(/^[a-f0-9]+$/i.test(hexPart)).toBe(true);
    });

    it('should generate unique secrets', () => {
      const secrets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        secrets.add(generateWebhookSecret());
      }
      expect(secrets.size).toBe(100);
    });
  });

  describe('hashWebhookSecret', () => {
    it('should produce 64-character hex hash', () => {
      const hash = hashWebhookSecret('test-secret');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/i.test(hash)).toBe(true);
    });

    it('should be deterministic', () => {
      const hash1 = hashWebhookSecret('same-secret');
      const hash2 = hashWebhookSecret('same-secret');
      expect(hash1).toBe(hash2);
    });
  });

  describe('generateWebhookSignature', () => {
    it('should produce HMAC-SHA256 signature', () => {
      const signature = generateWebhookSignature('{"test": true}', 'secret');
      expect(signature.length).toBe(64);
      expect(/^[a-f0-9]+$/i.test(signature)).toBe(true);
    });

    it('should produce known signature for known inputs', () => {
      // HMAC-SHA256 of 'test' with key 'key'
      const signature = generateWebhookSignature('test', 'key');
      expect(signature).toBe('02afb56304902c656fcb737cdd03de6205bb6d401da2812efd9b2d36a08af159');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"event": "test"}';
      const secret = 'test-secret';
      const signature = generateWebhookSignature(payload, secret);
      
      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"event": "test"}';
      const secret = 'test-secret';
      const wrongSignature = 'a'.repeat(64);
      
      expect(verifyWebhookSignature(payload, wrongSignature, secret)).toBe(false);
    });

    it('should reject signature with wrong length', () => {
      const payload = '{"event": "test"}';
      const secret = 'test-secret';
      const shortSignature = 'abc123';
      
      expect(verifyWebhookSignature(payload, shortSignature, secret)).toBe(false);
    });
  });

  describe('calculateNextRetryTime', () => {
    it('should return future time for attempt 0', () => {
      const retryTime = calculateNextRetryTime(0);
      expect(retryTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return approximately 1 minute for attempt 0', () => {
      const before = Date.now();
      const retryTime = calculateNextRetryTime(0);
      const after = Date.now();
      
      const expectedMin = before + 60000;
      const expectedMax = after + 60000;
      
      expect(retryTime.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(retryTime.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });

    it('should return approximately 5 minutes for attempt 1', () => {
      const before = Date.now();
      const retryTime = calculateNextRetryTime(1);
      const after = Date.now();
      
      const expectedMin = before + 300000;
      const expectedMax = after + 300000;
      
      expect(retryTime.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(retryTime.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });

    it('should return approximately 15 minutes for attempt 2+', () => {
      const before = Date.now();
      const retryTime = calculateNextRetryTime(2);
      const after = Date.now();
      
      const expectedMin = before + 900000;
      const expectedMax = after + 900000;
      
      expect(retryTime.getTime()).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(retryTime.getTime()).toBeLessThanOrEqual(expectedMax + 100);
    });
  });
});
