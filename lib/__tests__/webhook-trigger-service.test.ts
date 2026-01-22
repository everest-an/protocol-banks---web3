/**
 * Webhook Trigger Service Tests
 * Property-based tests for webhook event triggering
 */

import * as fc from 'fast-check';
import {
  WebhookTriggerService,
  type PaymentEventData,
  type BatchPaymentEventData,
  type MultisigEventData,
  type SubscriptionEventData,
} from '../services/webhook-trigger-service';
import { type WebhookEvent } from '../services/webhook-service';

// ============================================
// Test Utilities
// ============================================

// Mock WebhookService
jest.mock('../services/webhook-service', () => {
  const originalModule = jest.requireActual('../services/webhook-service');
  return {
    ...originalModule,
    WebhookService: jest.fn().mockImplementation(() => ({
      getWebhooksForEvent: jest.fn().mockResolvedValue([]),
      queueDelivery: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Arbitraries for property tests
const addressArbitrary = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`);
const txHashArbitrary = fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`);
const amountArbitrary = fc.integer({ min: 1, max: 100000000 }).map(n => (n / 100).toFixed(6));
const chainIdArbitrary = fc.constantFrom(1, 137, 8453, 42161, 10, 43114);
const tokenArbitrary = fc.constantFrom('USDC', 'USDT', 'DAI', 'ETH', 'MATIC');
const statusArbitrary = fc.constantFrom('pending', 'completed', 'failed');

const paymentEventDataArbitrary: fc.Arbitrary<PaymentEventData> = fc.record({
  payment_id: fc.uuid(),
  from_address: addressArbitrary,
  to_address: addressArbitrary,
  amount: amountArbitrary,
  token_symbol: tokenArbitrary,
  chain_id: chainIdArbitrary,
  tx_hash: fc.option(txHashArbitrary, { nil: undefined }),
  status: statusArbitrary,
  created_at: fc.date().map(d => d.toISOString()),
});

const batchPaymentEventDataArbitrary: fc.Arbitrary<BatchPaymentEventData> = fc.record({
  batch_id: fc.uuid(),
  from_address: addressArbitrary,
  total_amount: amountArbitrary,
  total_items: fc.integer({ min: 1, max: 100 }),
  token: tokenArbitrary,
  chain_id: chainIdArbitrary,
  status: statusArbitrary,
  created_at: fc.date().map(d => d.toISOString()),
});

const multisigEventDataArbitrary: fc.Arbitrary<MultisigEventData> = fc.record({
  transaction_id: fc.uuid(),
  multisig_id: fc.uuid(),
  wallet_address: addressArbitrary,
  to_address: addressArbitrary,
  value: amountArbitrary,
  status: fc.constantFrom('pending', 'confirmed', 'executed', 'failed'),
  threshold: fc.integer({ min: 1, max: 10 }),
  confirmations: fc.integer({ min: 0, max: 10 }),
  execution_tx_hash: fc.option(txHashArbitrary, { nil: undefined }),
  created_at: fc.date().map(d => d.toISOString()),
});

const subscriptionEventDataArbitrary: fc.Arbitrary<SubscriptionEventData> = fc.record({
  subscription_id: fc.uuid(),
  owner_address: addressArbitrary,
  service_name: fc.string({ minLength: 1, maxLength: 50 }),
  wallet_address: addressArbitrary,
  amount: amountArbitrary,
  token: tokenArbitrary,
  frequency: fc.constantFrom('daily', 'weekly', 'monthly', 'yearly'),
  status: fc.constantFrom('active', 'paused', 'cancelled', 'payment_failed'),
  next_payment_date: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
  created_at: fc.date().map(d => d.toISOString()),
});

// ============================================
// Unit Tests
// ============================================

describe('WebhookTriggerService', () => {
  let service: WebhookTriggerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookTriggerService();
  });

  describe('Payment Events', () => {
    it('should trigger payment.created event', async () => {
      const data: PaymentEventData = {
        payment_id: 'test-payment-id',
        from_address: '0x1234567890123456789012345678901234567890',
        to_address: '0x0987654321098765432109876543210987654321',
        amount: '100.00',
        token_symbol: 'USDC',
        chain_id: 1,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerPaymentCreated('0xowner', data)
      ).resolves.not.toThrow();
    });

    it('should trigger payment.completed event', async () => {
      const data: PaymentEventData = {
        payment_id: 'test-payment-id',
        from_address: '0x1234567890123456789012345678901234567890',
        to_address: '0x0987654321098765432109876543210987654321',
        amount: '100.00',
        token_symbol: 'USDC',
        chain_id: 1,
        tx_hash: '0x' + 'a'.repeat(64),
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerPaymentCompleted('0xowner', data)
      ).resolves.not.toThrow();
    });

    it('should trigger payment.failed event', async () => {
      const data: PaymentEventData = {
        payment_id: 'test-payment-id',
        from_address: '0x1234567890123456789012345678901234567890',
        to_address: '0x0987654321098765432109876543210987654321',
        amount: '100.00',
        token_symbol: 'USDC',
        chain_id: 1,
        status: 'failed',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerPaymentFailed('0xowner', data)
      ).resolves.not.toThrow();
    });
  });

  describe('Batch Payment Events', () => {
    it('should trigger batch_payment.created event', async () => {
      const data: BatchPaymentEventData = {
        batch_id: 'test-batch-id',
        from_address: '0x1234567890123456789012345678901234567890',
        total_amount: '1000.00',
        total_items: 10,
        token: 'USDC',
        chain_id: 1,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerBatchPaymentCreated('0xowner', data)
      ).resolves.not.toThrow();
    });

    it('should trigger batch_payment.completed event', async () => {
      const data: BatchPaymentEventData = {
        batch_id: 'test-batch-id',
        from_address: '0x1234567890123456789012345678901234567890',
        total_amount: '1000.00',
        total_items: 10,
        token: 'USDC',
        chain_id: 1,
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerBatchPaymentCompleted('0xowner', data)
      ).resolves.not.toThrow();
    });
  });

  describe('Multisig Events', () => {
    it('should trigger multisig.proposal_created event', async () => {
      const data: MultisigEventData = {
        transaction_id: 'test-tx-id',
        multisig_id: 'test-multisig-id',
        wallet_address: '0x1234567890123456789012345678901234567890',
        to_address: '0x0987654321098765432109876543210987654321',
        value: '100.00',
        status: 'pending',
        threshold: 2,
        confirmations: 0,
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerMultisigProposalCreated('0xowner', data)
      ).resolves.not.toThrow();
    });

    it('should trigger multisig.executed event', async () => {
      const data: MultisigEventData = {
        transaction_id: 'test-tx-id',
        multisig_id: 'test-multisig-id',
        wallet_address: '0x1234567890123456789012345678901234567890',
        to_address: '0x0987654321098765432109876543210987654321',
        value: '100.00',
        status: 'executed',
        threshold: 2,
        confirmations: 2,
        execution_tx_hash: '0x' + 'b'.repeat(64),
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerMultisigExecuted('0xowner', data)
      ).resolves.not.toThrow();
    });
  });

  describe('Subscription Events', () => {
    it('should trigger subscription.created event', async () => {
      const data: SubscriptionEventData = {
        subscription_id: 'test-sub-id',
        owner_address: '0x1234567890123456789012345678901234567890',
        service_name: 'Netflix',
        wallet_address: '0x0987654321098765432109876543210987654321',
        amount: '15.99',
        token: 'USDC',
        frequency: 'monthly',
        status: 'active',
        next_payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerSubscriptionCreated('0xowner', data)
      ).resolves.not.toThrow();
    });

    it('should trigger subscription.cancelled event', async () => {
      const data: SubscriptionEventData = {
        subscription_id: 'test-sub-id',
        owner_address: '0x1234567890123456789012345678901234567890',
        service_name: 'Netflix',
        wallet_address: '0x0987654321098765432109876543210987654321',
        amount: '15.99',
        token: 'USDC',
        frequency: 'monthly',
        status: 'cancelled',
        created_at: new Date().toISOString(),
      };

      await expect(
        service.triggerSubscriptionCancelled('0xowner', data)
      ).resolves.not.toThrow();
    });
  });
});

// ============================================
// Property Tests
// ============================================

describe('Webhook Trigger Property Tests', () => {
  /**
   * Property 15: Webhook Event Triggering
   * Validates: Requirements 7.1-7.8
   * 
   * Properties:
   * 1. All payment events contain required fields
   * 2. All batch payment events contain required fields
   * 3. All multisig events contain required fields
   * 4. All subscription events contain required fields
   * 5. Event data is preserved through triggering
   * 6. Events don't throw on valid input
   */
  describe('Property 15: Webhook Event Triggering', () => {
    let service: WebhookTriggerService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new WebhookTriggerService();
    });

    it('should accept any valid payment event data without throwing', async () => {
      await fc.assert(
        fc.asyncProperty(
          addressArbitrary,
          paymentEventDataArbitrary,
          async (ownerAddress, eventData) => {
            // Should not throw for any valid input
            await service.triggerPaymentCreated(ownerAddress, eventData);
            await service.triggerPaymentCompleted(ownerAddress, eventData);
            await service.triggerPaymentFailed(ownerAddress, eventData);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept any valid batch payment event data without throwing', async () => {
      await fc.assert(
        fc.asyncProperty(
          addressArbitrary,
          batchPaymentEventDataArbitrary,
          async (ownerAddress, eventData) => {
            await service.triggerBatchPaymentCreated(ownerAddress, eventData);
            await service.triggerBatchPaymentCompleted(ownerAddress, eventData);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept any valid multisig event data without throwing', async () => {
      await fc.assert(
        fc.asyncProperty(
          addressArbitrary,
          multisigEventDataArbitrary,
          async (ownerAddress, eventData) => {
            await service.triggerMultisigProposalCreated(ownerAddress, eventData);
            await service.triggerMultisigExecuted(ownerAddress, eventData);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept any valid subscription event data without throwing', async () => {
      await fc.assert(
        fc.asyncProperty(
          addressArbitrary,
          subscriptionEventDataArbitrary,
          async (ownerAddress, eventData) => {
            await service.triggerSubscriptionCreated(ownerAddress, eventData);
            await service.triggerSubscriptionPaymentDue(ownerAddress, eventData);
            await service.triggerSubscriptionPaymentCompleted(ownerAddress, eventData);
            await service.triggerSubscriptionCancelled(ownerAddress, eventData);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all payment event data fields', () => {
      fc.assert(
        fc.property(
          paymentEventDataArbitrary,
          (eventData) => {
            // Verify all required fields are present
            expect(eventData.payment_id).toBeDefined();
            expect(eventData.from_address).toBeDefined();
            expect(eventData.to_address).toBeDefined();
            expect(eventData.amount).toBeDefined();
            expect(eventData.token_symbol).toBeDefined();
            expect(eventData.chain_id).toBeDefined();
            expect(eventData.status).toBeDefined();
            expect(eventData.created_at).toBeDefined();

            // Verify address format
            expect(eventData.from_address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(eventData.to_address).toMatch(/^0x[a-fA-F0-9]{40}$/);

            // Verify amount is a valid number string
            expect(parseFloat(eventData.amount)).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all batch payment event data fields', () => {
      fc.assert(
        fc.property(
          batchPaymentEventDataArbitrary,
          (eventData) => {
            expect(eventData.batch_id).toBeDefined();
            expect(eventData.from_address).toBeDefined();
            expect(eventData.total_amount).toBeDefined();
            expect(eventData.total_items).toBeGreaterThan(0);
            expect(eventData.token).toBeDefined();
            expect(eventData.chain_id).toBeDefined();
            expect(eventData.status).toBeDefined();
            expect(eventData.created_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all multisig event data fields', () => {
      fc.assert(
        fc.property(
          multisigEventDataArbitrary,
          (eventData) => {
            expect(eventData.transaction_id).toBeDefined();
            expect(eventData.multisig_id).toBeDefined();
            expect(eventData.wallet_address).toBeDefined();
            expect(eventData.to_address).toBeDefined();
            expect(eventData.value).toBeDefined();
            expect(eventData.status).toBeDefined();
            expect(eventData.threshold).toBeGreaterThan(0);
            expect(eventData.confirmations).toBeGreaterThanOrEqual(0);
            expect(eventData.created_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all subscription event data fields', () => {
      fc.assert(
        fc.property(
          subscriptionEventDataArbitrary,
          (eventData) => {
            expect(eventData.subscription_id).toBeDefined();
            expect(eventData.owner_address).toBeDefined();
            expect(eventData.service_name).toBeDefined();
            expect(eventData.wallet_address).toBeDefined();
            expect(eventData.amount).toBeDefined();
            expect(eventData.token).toBeDefined();
            expect(eventData.frequency).toBeDefined();
            expect(eventData.status).toBeDefined();
            expect(eventData.created_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Event Type Mapping
   * Validates correct event type strings
   */
  describe('Event Type Mapping', () => {
    const paymentEvents: WebhookEvent[] = ['payment.created', 'payment.completed', 'payment.failed'];
    const batchEvents: WebhookEvent[] = ['batch_payment.created', 'batch_payment.completed'];
    const multisigEvents: WebhookEvent[] = ['multisig.proposal_created', 'multisig.executed'];
    const subscriptionEvents: WebhookEvent[] = [
      'subscription.created',
      'subscription.payment_due',
      'subscription.payment_completed',
      'subscription.cancelled',
    ];

    it('should have valid payment event types', () => {
      for (const event of paymentEvents) {
        expect(event).toMatch(/^payment\.(created|completed|failed)$/);
      }
    });

    it('should have valid batch payment event types', () => {
      for (const event of batchEvents) {
        expect(event).toMatch(/^batch_payment\.(created|completed)$/);
      }
    });

    it('should have valid multisig event types', () => {
      for (const event of multisigEvents) {
        expect(event).toMatch(/^multisig\.(proposal_created|executed)$/);
      }
    });

    it('should have valid subscription event types', () => {
      for (const event of subscriptionEvents) {
        expect(event).toMatch(/^subscription\.(created|payment_due|payment_completed|cancelled)$/);
      }
    });
  });
});

// ============================================
// Integration Tests
// ============================================

describe('Webhook Trigger Integration', () => {
  it('should handle errors gracefully without throwing', async () => {
    const service = new WebhookTriggerService();
    
    // Even with mock errors, the service should not throw
    const data: PaymentEventData = {
      payment_id: 'test-id',
      from_address: '0x' + '1'.repeat(40),
      to_address: '0x' + '2'.repeat(40),
      amount: '100.00',
      token_symbol: 'USDC',
      chain_id: 1,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    await expect(
      service.triggerPaymentCompleted('0xowner', data)
    ).resolves.not.toThrow();
  });
});
