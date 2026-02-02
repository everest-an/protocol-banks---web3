/**
 * Payment Service Tests
 * Unit tests and property-based tests for payment processing
 */

import * as fc from 'fast-check';
import { jest } from '@jest/globals';
import {
  validateRecipients,
  createPaymentBatch,
  getPaymentEstimate,
} from '../services/payment-service';
import type { Recipient } from '@/types';

// ============================================
// Mock Dependencies
// ============================================

jest.mock('@/lib/web3', () => ({
  sendToken: jest.fn().mockResolvedValue('0xmocktxhash'),
  signERC3009Authorization: jest.fn().mockResolvedValue({
    v: 27,
    r: '0x' + '1'.repeat(64),
    s: '0x' + '2'.repeat(64),
  }),
  executeERC3009Transfer: jest.fn().mockResolvedValue('0xmocktxhash'),
  getTokenAddress: jest.fn((chainId: number, token: string) => {
    const addresses: Record<string, Record<number, string>> = {
      USDC: { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      USDT: { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    };
    return addresses[token]?.[chainId];
  }),
  RPC_URLS: { 1: 'https://mainnet.infura.io/v3/test' },
  ERC20_ABI: [],
}));

jest.mock('@/lib/supabase-client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

jest.mock('../services/webhook-trigger-service', () => ({
  webhookTriggerService: {
    triggerPaymentCreated: jest.fn().mockResolvedValue(undefined),
    triggerPaymentCompleted: jest.fn().mockResolvedValue(undefined),
    triggerPaymentFailed: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/vendor-payment-service', () => ({
  vendorPaymentService: {
    autoLinkPayment: jest.fn().mockResolvedValue(null),
  },
}));

// ============================================
// Test Utilities
// ============================================

function createMockRecipient(overrides: Partial<Recipient> = {}): Recipient {
  return {
    address: '0x' + '1'.repeat(40),
    amount: '100.00',
    token: 'USDC',
    label: 'Test Recipient',
    ...overrides,
  };
}

// ============================================
// Property Tests
// ============================================

describe('Payment Service - Property Tests', () => {
  /**
   * Property: Valid recipient addresses should pass validation
   */
  describe('Recipient Address Validation', () => {
    it('should accept valid Ethereum addresses', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 40, maxLength: 40 }),
          (hex) => {
            const address = '0x' + hex;
            const recipient = createMockRecipient({ address });
            
            // Should not throw for valid format
            expect(() => validateRecipients([recipient])).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '',
        '0x',
        '0x123', // Too short
        '0x' + '1'.repeat(41), // Too long
        'not-an-address',
        '1234567890',
      ];

      for (const address of invalidAddresses) {
        const recipient = createMockRecipient({ address });
        expect(() => validateRecipients([recipient])).toThrow();
      }
    });
  });

  /**
   * Property: Amount validation
   */
  describe('Amount Validation', () => {
    it('should accept valid positive amounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.01, max: 1000000, noNaN: true }).map(n => n.toFixed(2)),
          (amount) => {
            const recipient = createMockRecipient({ amount });
            expect(() => validateRecipients([recipient])).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject zero or negative amounts', () => {
      const invalidAmounts = ['0', '-1', '-100.50', '0.00'];

      for (const amount of invalidAmounts) {
        const recipient = createMockRecipient({ amount });
        expect(() => validateRecipients([recipient])).toThrow();
      }
    });

    it('should reject non-numeric amounts', () => {
      const invalidAmounts = ['abc', '', 'NaN', 'Infinity', '1e10'];

      for (const amount of invalidAmounts) {
        const recipient = createMockRecipient({ amount });
        expect(() => validateRecipients([recipient])).toThrow();
      }
    });
  });

  /**
   * Property: Token validation
   */
  describe('Token Validation', () => {
    it('should accept supported tokens', () => {
      const supportedTokens = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH'];

      for (const token of supportedTokens) {
        const recipient = createMockRecipient({ token });
        expect(() => validateRecipients([recipient])).not.toThrow();
      }
    });
  });

  /**
   * Property: Batch size limits
   */
  describe('Batch Size Validation', () => {
    it('should reject empty recipient list', () => {
      expect(() => validateRecipients([])).toThrow('Recipients list cannot be empty');
    });

    it('should accept batches up to limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (count) => {
            const recipients = Array.from({ length: count }, (_, i) =>
              createMockRecipient({ 
                address: '0x' + i.toString().padStart(40, '0'),
                label: `Recipient ${i}` 
              })
            );
            expect(() => validateRecipients(recipients)).not.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ============================================
// Unit Tests
// ============================================

describe('Payment Service - Unit Tests', () => {
  describe('validateRecipients', () => {
    it('should pass for valid single recipient', () => {
      const recipient = createMockRecipient();
      expect(() => validateRecipients([recipient])).not.toThrow();
    });

    it('should pass for valid multiple recipients', () => {
      const recipients = [
        createMockRecipient({ address: '0x' + '1'.repeat(40) }),
        createMockRecipient({ address: '0x' + '2'.repeat(40) }),
        createMockRecipient({ address: '0x' + '3'.repeat(40) }),
      ];
      expect(() => validateRecipients(recipients)).not.toThrow();
    });

    it('should throw for empty recipients', () => {
      expect(() => validateRecipients([])).toThrow('Recipients list cannot be empty');
    });

    it('should throw for missing address', () => {
      const recipient = createMockRecipient({ address: '' });
      expect(() => validateRecipients([recipient])).toThrow('Invalid address');
    });

    it('should throw for invalid address format', () => {
      const recipient = createMockRecipient({ address: 'invalid' });
      expect(() => validateRecipients([recipient])).toThrow('Invalid address');
    });

    it('should throw for zero amount', () => {
      const recipient = createMockRecipient({ amount: '0' });
      expect(() => validateRecipients([recipient])).toThrow('Amount must be greater than 0');
    });

    it('should throw for negative amount', () => {
      const recipient = createMockRecipient({ amount: '-10' });
      expect(() => validateRecipients([recipient])).toThrow('Amount must be greater than 0');
    });

    it('should throw for non-numeric amount', () => {
      const recipient = createMockRecipient({ amount: 'abc' });
      expect(() => validateRecipients([recipient])).toThrow('Invalid amount');
    });
  });

  describe('createPaymentBatch', () => {
    it('should create a batch with correct total', () => {
      const recipients = [
        createMockRecipient({ amount: '100.00' }),
        createMockRecipient({ amount: '200.50', address: '0x' + '2'.repeat(40) }),
        createMockRecipient({ amount: '50.25', address: '0x' + '3'.repeat(40) }),
      ];

      const batch = createPaymentBatch(recipients, 'USDC');
      
      expect(batch.recipients).toHaveLength(3);
      expect(batch.token).toBe('USDC');
      expect(parseFloat(batch.totalAmount)).toBeCloseTo(350.75, 2);
    });

    it('should handle single recipient batch', () => {
      const recipients = [createMockRecipient({ amount: '100.00' })];
      const batch = createPaymentBatch(recipients, 'USDC');

      expect(batch.recipients).toHaveLength(1);
      expect(parseFloat(batch.totalAmount)).toBe(100);
    });

    it('should deduplicate recipients by address', () => {
      const sameAddress = '0x' + '1'.repeat(40);
      const recipients = [
        createMockRecipient({ address: sameAddress, amount: '100.00' }),
        createMockRecipient({ address: sameAddress, amount: '50.00' }),
      ];

      const batch = createPaymentBatch(recipients, 'USDC');
      
      // Should merge into single recipient with combined amount
      expect(batch.recipients).toHaveLength(1);
      expect(parseFloat(batch.totalAmount)).toBeCloseTo(150, 2);
    });
  });

  describe('getPaymentEstimate', () => {
    it('should estimate gas for single payment', () => {
      const estimate = getPaymentEstimate(1, 'USDC', 1);
      
      expect(estimate.gasEstimate).toBeGreaterThan(0);
      expect(estimate.estimatedFeeUSD).toBeGreaterThan(0);
    });

    it('should scale gas estimate with recipient count', () => {
      const singleEstimate = getPaymentEstimate(1, 'USDC', 1);
      const multiEstimate = getPaymentEstimate(10, 'USDC', 1);

      expect(multiEstimate.gasEstimate).toBeGreaterThan(singleEstimate.gasEstimate);
    });

    it('should provide different estimates per chain', () => {
      const mainnetEstimate = getPaymentEstimate(1, 'USDC', 1);
      const polygonEstimate = getPaymentEstimate(1, 'USDC', 137);

      // Polygon should be cheaper
      expect(polygonEstimate.estimatedFeeUSD).toBeLessThan(mainnetEstimate.estimatedFeeUSD);
    });
  });
});

// ============================================
// Integration Tests (with mocks)
// ============================================

describe('Payment Service - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Flow', () => {
    it('should complete single payment flow', async () => {
      // This test would require more complex mocking of the blockchain
      // For now, we test the validation and batch creation flow
      const recipient = createMockRecipient();
      
      validateRecipients([recipient]);
      const batch = createPaymentBatch([recipient], 'USDC');
      const estimate = getPaymentEstimate(1, 'USDC', 1);

      expect(batch.recipients).toHaveLength(1);
      expect(estimate.gasEstimate).toBeGreaterThan(0);
    });

    it('should handle batch payment preparation', async () => {
      const recipients = [
        createMockRecipient({ address: '0x' + '1'.repeat(40), amount: '100' }),
        createMockRecipient({ address: '0x' + '2'.repeat(40), amount: '200' }),
        createMockRecipient({ address: '0x' + '3'.repeat(40), amount: '300' }),
      ];

      validateRecipients(recipients);
      const batch = createPaymentBatch(recipients, 'USDC');
      const estimate = getPaymentEstimate(recipients.length, 'USDC', 1);

      expect(batch.recipients).toHaveLength(3);
      expect(parseFloat(batch.totalAmount)).toBe(600);
      expect(estimate.gasEstimate).toBeGreaterThan(0);
    });
  });
});
