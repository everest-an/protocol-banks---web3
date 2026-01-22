/**
 * Tests for test utilities
 * Verifies that the testing infrastructure is working correctly
 */

import {
  fc,
  ethereumAddressArb,
  apiKeyNameArb,
  permissionsArb,
  webhookUrlArb,
  webhookEventsArb,
  frequencyArb,
  tokenAmountArb,
  createMockAPIKey,
  createMockWebhook,
  createMockSubscription,
  createMockPayment,
  createMockVendor,
  generateSeedData,
  isValidSHA256Hash,
  isValidEthereumAddress,
  isValidUUID,
  isDateInFuture,
  areDatesApproximatelyEqual,
} from '../test-utils';

describe('Test Utilities', () => {
  describe('Arbitrary Generators', () => {
    it('should generate valid Ethereum addresses', () => {
      fc.assert(
        fc.property(ethereumAddressArb, (address) => {
          expect(address).toMatch(/^0x[a-f0-9]{40}$/i);
          return isValidEthereumAddress(address);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate non-empty API key names', () => {
      fc.assert(
        fc.property(apiKeyNameArb, (name) => {
          expect(name.trim().length).toBeGreaterThan(0);
          return name.trim().length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid permissions arrays', () => {
      fc.assert(
        fc.property(permissionsArb, (permissions) => {
          expect(permissions.length).toBeGreaterThanOrEqual(1);
          expect(permissions.length).toBeLessThanOrEqual(5);
          const validPermissions = ['read', 'write', 'payments', 'webhooks', 'admin'];
          return permissions.every(p => validPermissions.includes(p));
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid webhook URLs', () => {
      fc.assert(
        fc.property(webhookUrlArb, (url) => {
          expect(url).toMatch(/^https?:\/\//);
          return url.startsWith('http://') || url.startsWith('https://');
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid webhook events', () => {
      fc.assert(
        fc.property(webhookEventsArb, (events) => {
          const validEvents = [
            'payment.created',
            'payment.completed',
            'payment.failed',
            'batch_payment.created',
            'batch_payment.completed',
            'multisig.proposal_created',
            'multisig.executed',
          ];
          return events.every(e => validEvents.includes(e));
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid frequencies', () => {
      fc.assert(
        fc.property(frequencyArb, (frequency) => {
          const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
          return validFrequencies.includes(frequency);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid token amounts', () => {
      fc.assert(
        fc.property(tokenAmountArb, (amount) => {
          const num = parseFloat(amount);
          expect(num).toBeGreaterThanOrEqual(0.01);
          expect(num).toBeLessThanOrEqual(1000000);
          return num >= 0.01 && num <= 1000000;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Mock Data Factories', () => {
    it('should create valid mock API key', () => {
      const apiKey = createMockAPIKey();
      
      expect(apiKey.id).toBeDefined();
      expect(apiKey.name).toBe('Test API Key');
      expect(apiKey.key_hash).toBeDefined();
      expect(apiKey.key_prefix).toBe('pb_test_');
      expect(isValidEthereumAddress(apiKey.owner_address)).toBe(true);
      expect(apiKey.permissions).toContain('read');
      expect(apiKey.is_active).toBe(true);
    });

    it('should create mock API key with overrides', () => {
      const apiKey = createMockAPIKey({
        name: 'Custom Key',
        permissions: ['read', 'write'],
        is_active: false,
      });
      
      expect(apiKey.name).toBe('Custom Key');
      expect(apiKey.permissions).toEqual(['read', 'write']);
      expect(apiKey.is_active).toBe(false);
    });

    it('should create valid mock webhook', () => {
      const webhook = createMockWebhook();
      
      expect(webhook.id).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain('payment.completed');
      expect(webhook.is_active).toBe(true);
      expect(webhook.retry_count).toBe(3);
    });

    it('should create valid mock subscription', () => {
      const subscription = createMockSubscription();
      
      expect(subscription.id).toBeDefined();
      expect(subscription.service_name).toBe('Test Service');
      expect(subscription.amount).toBe('100.00');
      expect(subscription.token).toBe('USDC');
      expect(subscription.frequency).toBe('monthly');
      expect(subscription.status).toBe('active');
    });

    it('should create valid mock payment', () => {
      const payment = createMockPayment();
      
      expect(payment.id).toBeDefined();
      expect(isValidEthereumAddress(payment.from_address)).toBe(true);
      expect(isValidEthereumAddress(payment.to_address)).toBe(true);
      expect(payment.status).toBe('completed');
    });

    it('should create valid mock vendor', () => {
      const vendor = createMockVendor();
      
      expect(vendor.id).toBeDefined();
      expect(vendor.name).toBe('Test Vendor');
      expect(isValidEthereumAddress(vendor.wallet_address)).toBe(true);
      expect(vendor.tier).toBe('vendor');
    });
  });

  describe('Seed Data Generation', () => {
    it('should generate seed data with specified counts', () => {
      const seedData = generateSeedData({
        apiKeys: 3,
        webhooks: 2,
        subscriptions: 5,
        payments: 10,
        vendors: 4,
      });
      
      expect(seedData.apiKeys).toHaveLength(3);
      expect(seedData.webhooks).toHaveLength(2);
      expect(seedData.subscriptions).toHaveLength(5);
      expect(seedData.payments).toHaveLength(10);
      expect(seedData.vendors).toHaveLength(4);
    });

    it('should generate empty arrays for unspecified counts', () => {
      const seedData = generateSeedData({});
      
      expect(seedData.apiKeys).toHaveLength(0);
      expect(seedData.webhooks).toHaveLength(0);
    });
  });

  describe('Assertion Helpers', () => {
    it('should validate SHA-256 hashes', () => {
      expect(isValidSHA256Hash('a'.repeat(64))).toBe(true);
      expect(isValidSHA256Hash('abcdef1234567890'.repeat(4))).toBe(true);
      expect(isValidSHA256Hash('invalid')).toBe(false);
      expect(isValidSHA256Hash('a'.repeat(63))).toBe(false);
      expect(isValidSHA256Hash('g'.repeat(64))).toBe(false);
    });

    it('should validate Ethereum addresses', () => {
      expect(isValidEthereumAddress('0x' + 'a'.repeat(40))).toBe(true);
      expect(isValidEthereumAddress('0x' + 'A'.repeat(40))).toBe(true);
      expect(isValidEthereumAddress('0x' + '1'.repeat(40))).toBe(true);
      expect(isValidEthereumAddress('invalid')).toBe(false);
      expect(isValidEthereumAddress('0x' + 'a'.repeat(39))).toBe(false);
    });

    it('should validate UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('invalid')).toBe(false);
    });

    it('should check if date is in future', () => {
      const futureDate = new Date(Date.now() + 1000000);
      const pastDate = new Date(Date.now() - 1000000);
      
      expect(isDateInFuture(futureDate)).toBe(true);
      expect(isDateInFuture(pastDate)).toBe(false);
    });

    it('should check if dates are approximately equal', () => {
      const date1 = new Date();
      const date2 = new Date(date1.getTime() + 500);
      const date3 = new Date(date1.getTime() + 5000);
      
      expect(areDatesApproximatelyEqual(date1, date2, 1000)).toBe(true);
      expect(areDatesApproximatelyEqual(date1, date3, 1000)).toBe(false);
    });
  });
});
