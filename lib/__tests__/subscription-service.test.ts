/**
 * Subscription Service Tests
 * Property-based tests and unit tests for Subscription management
 */

import * as fc from 'fast-check';
import {
  calculateNextPaymentDate,
  isSubscriptionDue,
  type SubscriptionFrequency,
  type Subscription,
} from '../services/subscription-service';
import { createMockSubscription } from '../test-utils';

// ============================================
// Property Tests
// ============================================

describe('Subscription Service - Property Tests', () => {
  /**
   * Property 8: Subscription CRUD Round-Trip
   * Subscription data should be preserved through operations
   */
  describe('Property 8: Subscription Data Integrity', () => {
    it('should preserve subscription data in mock factory', () => {
      fc.assert(
        fc.property(
          fc.record({
            service_name: fc.string({ minLength: 1, maxLength: 100 }),
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }).map(n => n.toFixed(2)),
            token: fc.constantFrom('USDC', 'USDT', 'DAI', 'ETH'),
            frequency: fc.constantFrom('daily', 'weekly', 'monthly', 'yearly') as fc.Arbitrary<SubscriptionFrequency>,
          }),
          (input) => {
            const subscription = createMockSubscription({
              service_name: input.service_name,
              amount: input.amount,
              token: input.token,
              frequency: input.frequency,
            });

            expect(subscription.service_name).toBe(input.service_name);
            expect(subscription.amount).toBe(input.amount);
            expect(subscription.token).toBe(input.token);
            expect(subscription.frequency).toBe(input.frequency);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Subscription Next Payment Date Calculation
   * Next payment date should always be in the future relative to the input date
   */
  describe('Property 9: Next Payment Date Calculation', () => {
    it('should always return a future date', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom('daily', 'weekly', 'monthly', 'yearly') as fc.Arbitrary<SubscriptionFrequency>,
          (fromDate, frequency) => {
            const nextDate = calculateNextPaymentDate(fromDate, frequency);
            expect(nextDate.getTime()).toBeGreaterThan(fromDate.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add exactly 1 day for daily frequency', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (fromDate) => {
            const nextDate = calculateNextPaymentDate(fromDate, 'daily');
            const diffMs = nextDate.getTime() - fromDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            expect(Math.round(diffDays)).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add exactly 7 days for weekly frequency', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (fromDate) => {
            const nextDate = calculateNextPaymentDate(fromDate, 'weekly');
            const diffMs = nextDate.getTime() - fromDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            expect(Math.round(diffDays)).toBe(7);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle month-end edge cases for monthly frequency', () => {
      // Test Jan 31 -> Feb 28/29
      const jan31 = new Date('2024-01-31');
      const nextFromJan31 = calculateNextPaymentDate(jan31, 'monthly');
      
      // Should be Feb 29 (2024 is leap year) or last day of Feb
      expect(nextFromJan31.getMonth()).toBe(1); // February
      expect(nextFromJan31.getDate()).toBeLessThanOrEqual(29);

      // Test Jan 30 -> Feb 28/29
      const jan30 = new Date('2024-01-30');
      const nextFromJan30 = calculateNextPaymentDate(jan30, 'monthly');
      expect(nextFromJan30.getMonth()).toBe(1);
    });

    it('should handle leap year edge cases for yearly frequency', () => {
      // Test Feb 29 2024 -> Feb 28 2025 (non-leap year)
      const feb29 = new Date('2024-02-29');
      const nextFromFeb29 = calculateNextPaymentDate(feb29, 'yearly');
      
      expect(nextFromFeb29.getFullYear()).toBe(2025);
      expect(nextFromFeb29.getMonth()).toBe(1); // February
      expect(nextFromFeb29.getDate()).toBe(28); // Feb 28 in non-leap year
    });

    it('should maintain same day of month when possible for monthly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }), // Days 1-28 exist in all months
          fc.integer({ min: 0, max: 11 }), // Month
          fc.integer({ min: 2020, max: 2030 }), // Year
          (day, month, year) => {
            const fromDate = new Date(year, month, day);
            const nextDate = calculateNextPaymentDate(fromDate, 'monthly');
            
            // For days 1-28, the day should be preserved
            expect(nextDate.getDate()).toBe(day);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Paused Subscription Non-Execution
   * Paused subscriptions should not be considered due
   */
  describe('Property 10: Paused Subscription Non-Execution', () => {
    it('should not consider paused subscriptions as due', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (pastDate) => {
            const subscription = createMockSubscription({
              status: 'paused',
              next_payment_date: pastDate.toISOString(),
            });

            expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not consider cancelled subscriptions as due', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (pastDate) => {
            const subscription = createMockSubscription({
              status: 'cancelled',
              next_payment_date: pastDate.toISOString(),
            });

            expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not consider payment_failed subscriptions as due', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (pastDate) => {
            const subscription = createMockSubscription({
              status: 'payment_failed',
              next_payment_date: pastDate.toISOString(),
            });

            expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should consider active subscriptions with past due date as due', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const subscription = createMockSubscription({
        status: 'active',
        next_payment_date: pastDate.toISOString(),
      });

      expect(isSubscriptionDue(subscription as Subscription)).toBe(true);
    });

    it('should not consider active subscriptions with future due date as due', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const subscription = createMockSubscription({
        status: 'active',
        next_payment_date: futureDate.toISOString(),
      });

      expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
    });
  });
});

// ============================================
// Unit Tests
// ============================================

describe('Subscription Service - Unit Tests', () => {
  describe('calculateNextPaymentDate', () => {
    it('should add 1 day for daily frequency', () => {
      const from = new Date('2024-01-15T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'daily');
      expect(next.toISOString().slice(0, 10)).toBe('2024-01-16');
    });

    it('should add 7 days for weekly frequency', () => {
      const from = new Date('2024-01-15T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'weekly');
      expect(next.toISOString().slice(0, 10)).toBe('2024-01-22');
    });

    it('should add 1 month for monthly frequency', () => {
      const from = new Date('2024-01-15T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'monthly');
      expect(next.toISOString().slice(0, 10)).toBe('2024-02-15');
    });

    it('should add 1 year for yearly frequency', () => {
      const from = new Date('2024-01-15T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'yearly');
      expect(next.toISOString().slice(0, 10)).toBe('2025-01-15');
    });

    it('should handle Jan 31 -> Feb 28 for monthly', () => {
      const from = new Date('2023-01-31T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'monthly');
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(28); // Last day of Feb 2023
    });

    it('should handle Jan 31 -> Feb 29 for leap year', () => {
      const from = new Date('2024-01-31T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'monthly');
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(29); // Leap year
    });

    it('should handle Feb 29 -> Feb 28 for yearly (non-leap)', () => {
      const from = new Date('2024-02-29T10:00:00Z');
      const next = calculateNextPaymentDate(from, 'yearly');
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1);
      expect(next.getDate()).toBe(28);
    });
  });

  describe('isSubscriptionDue', () => {
    it('should return true for active subscription with past due date', () => {
      const subscription = createMockSubscription({
        status: 'active',
        next_payment_date: new Date(Date.now() - 1000).toISOString(),
      });
      expect(isSubscriptionDue(subscription as Subscription)).toBe(true);
    });

    it('should return false for active subscription with future due date', () => {
      const subscription = createMockSubscription({
        status: 'active',
        next_payment_date: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
    });

    it('should return false for paused subscription', () => {
      const subscription = createMockSubscription({
        status: 'paused',
        next_payment_date: new Date(Date.now() - 1000).toISOString(),
      });
      expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
    });

    it('should return false for subscription with null next_payment_date', () => {
      const subscription = createMockSubscription({
        status: 'active',
        next_payment_date: null,
      });
      expect(isSubscriptionDue(subscription as Subscription)).toBe(false);
    });
  });
});
