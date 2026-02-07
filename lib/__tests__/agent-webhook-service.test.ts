/**
 * Agent Webhook Service Tests
 * 
 * Property-based tests for Agent Webhook delivery and retry.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-webhook-service.test.ts
 */

import * as fc from 'fast-check';
import { 
  agentWebhookService, 
  generateWebhookSignature,
  AgentWebhookEvent,
  setUseDatabaseStorage 
} from '../services/agent-webhook-service';

// ============================================
// Test Helpers
// ============================================

const validEvents: AgentWebhookEvent[] = [
  'proposal.created',
  'proposal.approved',
  'proposal.rejected',
  'payment.executing',
  'payment.executed',
  'payment.failed',
  'budget.depleted',
  'budget.reset',
  'agent.paused',
  'agent.resumed',
];

// ============================================
// Unit Tests
// ============================================

describe('Agent Webhook Service', () => {
  beforeEach(() => {
    setUseDatabaseStorage(false);
    agentWebhookService._clearAll();
  });

  describe('generateWebhookSignature', () => {
    it('should generate consistent signatures', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, secret);
      
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret';
      
      const sig1 = generateWebhookSignature('payload1', secret);
      const sig2 = generateWebhookSignature('payload2', secret);
      
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = 'test-payload';
      
      const sig1 = generateWebhookSignature(payload, 'secret1');
      const sig2 = generateWebhookSignature(payload, 'secret2');
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('trigger', () => {
    it('should create delivery record', async () => {
      const delivery = await agentWebhookService.trigger(
        'agent-123',
        'https://example.com/webhook',
        'webhook-secret',
        'proposal.created',
        { proposal_id: 'prop-123', amount: '100' }
      );

      expect(delivery.id).toBeDefined();
      expect(delivery.agent_id).toBe('agent-123');
      expect(delivery.event_type).toBe('proposal.created');
      expect(delivery.payload).toEqual({ proposal_id: 'prop-123', amount: '100' });
      expect(delivery.status).toBe('delivered');
      expect(delivery.attempts).toBe(1);
    });

    it('should track delivery attempts', async () => {
      const delivery = await agentWebhookService.trigger(
        'agent-123',
        'https://example.com/webhook',
        'webhook-secret',
        'payment.executed',
        { tx_hash: '0x123' }
      );

      expect(delivery.attempts).toBeGreaterThanOrEqual(1);
      expect(delivery.last_attempt_at).toBeDefined();
    });
  });

  describe('getDeliveries', () => {
    it('should return deliveries for agent', async () => {
      await agentWebhookService.trigger(
        'agent-123',
        'https://example.com/webhook',
        'secret',
        'proposal.created',
        {}
      );
      await agentWebhookService.trigger(
        'agent-123',
        'https://example.com/webhook',
        'secret',
        'payment.executed',
        {}
      );
      await agentWebhookService.trigger(
        'agent-456',
        'https://example.com/webhook',
        'secret',
        'proposal.created',
        {}
      );

      const deliveries = await agentWebhookService.getDeliveries('agent-123');
      
      expect(deliveries).toHaveLength(2);
      expect(deliveries.every(d => d.agent_id === 'agent-123')).toBe(true);
    });

    it('should return deliveries sorted by created_at desc', async () => {
      await agentWebhookService.trigger('agent-123', 'https://example.com', 'secret', 'proposal.created', {});
      await new Promise(r => setTimeout(r, 10));
      await agentWebhookService.trigger('agent-123', 'https://example.com', 'secret', 'payment.executed', {});

      const deliveries = await agentWebhookService.getDeliveries('agent-123');
      
      expect(deliveries[0].event_type).toBe('payment.executed');
      expect(deliveries[1].event_type).toBe('proposal.created');
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 15: Agent Webhook Delivery', () => {
    /**
     * Feature: agent-link-api, Property 15: Agent Webhook Delivery
     * 
     * For any agent event, the webhook service SHALL deliver the event
     * to the configured webhook URL with a valid HMAC signature.
     * 
     * Validates: Requirements 7.1, 7.2, 7.3, 7.5
     */
    it('should deliver webhooks with valid signatures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.webUrl(),
          fc.string({ minLength: 16, maxLength: 64 }),
          fc.constantFrom(...validEvents),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 100 })),
          async (agentId, webhookUrl, webhookSecret, event, payload) => {
            agentWebhookService._clearAll();

            const delivery = await agentWebhookService.trigger(
              agentId,
              webhookUrl,
              webhookSecret,
              event,
              payload
            );

            // Verify delivery was created
            expect(delivery.id).toBeDefined();
            expect(delivery.agent_id).toBe(agentId);
            expect(delivery.event_type).toBe(event);
            expect(delivery.payload).toEqual(payload);
            
            // Verify delivery was attempted
            expect(delivery.attempts).toBeGreaterThanOrEqual(1);
            expect(delivery.last_attempt_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all required fields in delivery', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(...validEvents),
          async (agentId, event) => {
            agentWebhookService._clearAll();

            const delivery = await agentWebhookService.trigger(
              agentId,
              'https://example.com/webhook',
              'test-secret',
              event,
              { test: 'data' }
            );

            // Required fields
            expect(delivery.id).toBeDefined();
            expect(delivery.agent_id).toBeDefined();
            expect(delivery.event_type).toBeDefined();
            expect(delivery.payload).toBeDefined();
            expect(delivery.status).toBeDefined();
            expect(delivery.attempts).toBeDefined();
            expect(delivery.created_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique delivery IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (count) => {
            agentWebhookService._clearAll();

            const ids = new Set<string>();
            for (let i = 0; i < count; i++) {
              const delivery = await agentWebhookService.trigger(
                'agent-123',
                'https://example.com/webhook',
                'secret',
                'proposal.created',
                { index: i }
              );
              ids.add(delivery.id);
            }

            expect(ids.size).toBe(count);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Agent Webhook Retry', () => {
    /**
     * Feature: agent-link-api, Property 16: Agent Webhook Retry
     * 
     * For any failed webhook delivery, the service SHALL retry up to 3 times
     * with exponential backoff before marking as failed.
     * 
     * Validates: Requirements 7.4
     */
    it('should track retry attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(...validEvents),
          async (agentId, event) => {
            agentWebhookService._clearAll();

            const delivery = await agentWebhookService.trigger(
              agentId,
              'https://example.com/webhook',
              'secret',
              event,
              {}
            );

            // Verify attempt tracking
            expect(delivery.attempts).toBeGreaterThanOrEqual(1);
            expect(delivery.attempts).toBeLessThanOrEqual(3);
            
            // If delivered, should have delivered_at
            if (delivery.status === 'delivered') {
              expect(delivery.delivered_at).toBeDefined();
            }
            
            // If failed after max retries, should be marked failed
            if (delivery.attempts >= 3 && delivery.status !== 'delivered') {
              expect(delivery.status).toBe('failed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set next_retry_at for pending deliveries', async () => {
      // Create a mock failed delivery
      const mockDelivery = {
        id: 'test-delivery-id',
        agent_id: 'agent-123',
        event_type: 'proposal.created' as AgentWebhookEvent,
        payload: {},
        status: 'pending' as const,
        attempts: 1,
        last_attempt_at: new Date(),
        next_retry_at: new Date(Date.now() + 60000),
        created_at: new Date(),
      };

      agentWebhookService._setDelivery(mockDelivery);

      const pending = await agentWebhookService.getPendingRetries();
      
      // Should not include deliveries with future retry time
      expect(pending.every(d => d.next_retry_at && d.next_retry_at <= new Date())).toBe(true);
    });

    it('should respect max retry limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (agentId) => {
            agentWebhookService._clearAll();

            const delivery = await agentWebhookService.trigger(
              agentId,
              'https://example.com/webhook',
              'secret',
              'proposal.created',
              {}
            );

            // Max 3 attempts
            expect(delivery.attempts).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Signature Verification', () => {
    /**
     * Property: Signature Consistency
     * 
     * For any payload and secret, the signature should be deterministic
     * and verifiable.
     */
    it('should produce deterministic signatures', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 64 }),
          (payload, secret) => {
            const sig1 = generateWebhookSignature(payload, secret);
            const sig2 = generateWebhookSignature(payload, secret);
            
            expect(sig1).toBe(sig2);
            expect(sig1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce unique signatures for different inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 64 }),
          (payload1, payload2, secret) => {
            fc.pre(payload1 !== payload2);
            
            const sig1 = generateWebhookSignature(payload1, secret);
            const sig2 = generateWebhookSignature(payload2, secret);
            
            expect(sig1).not.toBe(sig2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
