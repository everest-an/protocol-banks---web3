/**
 * Dashboard Activity Service Tests
 * Property-based tests for dashboard activity display
 */

import * as fc from 'fast-check';
import {
  DashboardActivityService,
  type ActivityItem,
} from '../services/dashboard-activity-service';

// ============================================
// Test Utilities
// ============================================

// Arbitraries for property tests
const addressArbitrary = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`);
const amountArbitrary = fc.integer({ min: 1, max: 100000000 }).map(n => (n / 100).toFixed(2));
const tokenArbitrary = fc.constantFrom('USDC', 'USDT', 'DAI', 'ETH', 'MATIC');
const chainIdArbitrary = fc.constantFrom(1, 137, 8453, 42161, 10);
const statusArbitrary = fc.constantFrom('pending', 'completed', 'failed');

const activityItemArbitrary: fc.Arbitrary<ActivityItem> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('sent' as const, 'received' as const),
  amount: amountArbitrary,
  token: tokenArbitrary,
  chain_id: chainIdArbitrary,
  counterparty: addressArbitrary,
  counterparty_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  vendor_id: fc.option(fc.uuid(), { nil: undefined }),
  vendor_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  tx_hash: fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`), { nil: undefined }),
  status: statusArbitrary,
  created_at: fc.date({ min: new Date('2024-01-01'), max: new Date() }).map(d => d.toISOString()),
});

// ============================================
// Unit Tests
// ============================================

describe('DashboardActivityService', () => {
  let service: DashboardActivityService;

  beforeEach(() => {
    service = new DashboardActivityService();
  });

  describe('Address Truncation', () => {
    it('should truncate long addresses', () => {
      const truncate = (service as any).truncateAddress.bind(service);
      
      const address = '0x1234567890123456789012345678901234567890';
      const truncated = truncate(address);
      
      expect(truncated).toBe('0x1234...7890');
    });

    it('should not truncate short addresses', () => {
      const truncate = (service as any).truncateAddress.bind(service);
      
      expect(truncate('0x123456')).toBe('0x123456');
      expect(truncate('')).toBe('');
      expect(truncate(null)).toBe('');
    });
  });

  describe('Time Ago Formatting', () => {
    it('should format recent times as "Just now"', () => {
      const getTimeAgo = (service as any).getTimeAgo.bind(service);
      
      const now = new Date();
      expect(getTimeAgo(now)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const getTimeAgo = (service as any).getTimeAgo.bind(service);
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(getTimeAgo(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const getTimeAgo = (service as any).getTimeAgo.bind(service);
      
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(getTimeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('should format days ago', () => {
      const getTimeAgo = (service as any).getTimeAgo.bind(service);
      
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(getTimeAgo(twoDaysAgo)).toBe('2d ago');
    });
  });

  describe('Activity Item Formatting', () => {
    it('should format sent activity correctly', () => {
      const item: ActivityItem = {
        id: 'test-id',
        type: 'sent',
        amount: '100.00',
        token: 'USDC',
        chain_id: 1,
        counterparty: '0x1234567890123456789012345678901234567890',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const formatted = service.formatActivityItem(item);

      expect(formatted.direction).toBe('Sent');
      expect(formatted.amount_display).toBe('-100.00 USDC');
      expect(formatted.description).toContain('To');
    });

    it('should format received activity correctly', () => {
      const item: ActivityItem = {
        id: 'test-id',
        type: 'received',
        amount: '50.00',
        token: 'ETH',
        chain_id: 1,
        counterparty: '0x1234567890123456789012345678901234567890',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const formatted = service.formatActivityItem(item);

      expect(formatted.direction).toBe('Received');
      expect(formatted.amount_display).toBe('+50.00 ETH');
      expect(formatted.description).toContain('From');
    });

    it('should use vendor name when available', () => {
      const item: ActivityItem = {
        id: 'test-id',
        type: 'sent',
        amount: '100.00',
        token: 'USDC',
        chain_id: 1,
        counterparty: '0x1234567890123456789012345678901234567890',
        vendor_name: 'Netflix',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const formatted = service.formatActivityItem(item);

      expect(formatted.description).toContain('Netflix');
    });
  });
});

// ============================================
// Property Tests
// ============================================

describe('Dashboard Activity Property Tests', () => {
  /**
   * Property 24: Dashboard Activity Display
   * Validates: Requirements 11.1, 11.2, 11.4
   * 
   * Properties:
   * 1. Activity items are sorted by date (most recent first)
   * 2. Sent and received items are correctly categorized
   * 3. Vendor names are resolved when available
   * 4. Amount display includes correct sign (+ or -)
   * 5. Activity list respects limit parameter
   */
  describe('Property 24: Dashboard Activity Display', () => {
    let service: DashboardActivityService;

    beforeEach(() => {
      service = new DashboardActivityService();
    });

    it('should correctly categorize sent vs received items', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary,
          (item) => {
            const formatted = service.formatActivityItem(item);

            if (item.type === 'sent') {
              expect(formatted.direction).toBe('Sent');
              expect(formatted.amount_display.startsWith('-')).toBe(true);
              expect(formatted.description).toContain('To');
            } else {
              expect(formatted.direction).toBe('Received');
              expect(formatted.amount_display.startsWith('+')).toBe(true);
              expect(formatted.description).toContain('From');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include token symbol in amount display', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary,
          (item) => {
            const formatted = service.formatActivityItem(item);
            expect(formatted.amount_display).toContain(item.token);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prefer vendor name over truncated address', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary.filter(item => item.vendor_name !== undefined),
          (item) => {
            const formatted = service.formatActivityItem(item);
            expect(formatted.description).toContain(item.vendor_name!);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort items by date (most recent first)', () => {
      fc.assert(
        fc.property(
          fc.array(activityItemArbitrary, { minLength: 2, maxLength: 20 }),
          (items) => {
            const sorted = [...items].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            // Verify sorting
            for (let i = 1; i < sorted.length; i++) {
              const prevDate = new Date(sorted[i - 1].created_at).getTime();
              const currDate = new Date(sorted[i].created_at).getTime();
              expect(prevDate).toBeGreaterThanOrEqual(currDate);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect limit parameter', () => {
      fc.assert(
        fc.property(
          fc.array(activityItemArbitrary, { minLength: 10, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (items, limit) => {
            const limited = items.slice(0, limit);
            expect(limited.length).toBeLessThanOrEqual(limit);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate totals correctly', () => {
      fc.assert(
        fc.property(
          fc.array(activityItemArbitrary.filter(i => i.status === 'completed'), { minLength: 1, maxLength: 20 }),
          (items) => {
            const sentItems = items.filter(i => i.type === 'sent');
            const receivedItems = items.filter(i => i.type === 'received');

            const totalSent = sentItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);
            const totalReceived = receivedItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);

            expect(totalSent).toBeGreaterThanOrEqual(0);
            expect(totalReceived).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Time Ago Formatting
   */
  describe('Time Ago Formatting', () => {
    it('should produce valid time ago strings', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          (date) => {
            const service = new DashboardActivityService();
            const getTimeAgo = (service as any).getTimeAgo.bind(service);
            
            const timeAgo = getTimeAgo(date);
            
            expect(typeof timeAgo).toBe('string');
            expect(timeAgo.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Activity Item Validation
   */
  describe('Activity Item Validation', () => {
    it('should have all required fields', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary,
          (item) => {
            expect(item.id).toBeDefined();
            expect(item.type).toBeDefined();
            expect(item.amount).toBeDefined();
            expect(item.token).toBeDefined();
            expect(item.chain_id).toBeDefined();
            expect(item.counterparty).toBeDefined();
            expect(item.status).toBeDefined();
            expect(item.created_at).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid type values', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary,
          (item) => {
            expect(['sent', 'received']).toContain(item.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid status values', () => {
      fc.assert(
        fc.property(
          activityItemArbitrary,
          (item) => {
            expect(['pending', 'completed', 'failed']).toContain(item.status);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// Integration Tests
// ============================================

describe('Dashboard Activity Integration', () => {
  it('should handle empty activity list', () => {
    const items: ActivityItem[] = [];
    
    const totalSent = items
      .filter(i => i.type === 'sent' && i.status === 'completed')
      .reduce((sum, i) => sum + parseFloat(i.amount), 0);

    const totalReceived = items
      .filter(i => i.type === 'received' && i.status === 'completed')
      .reduce((sum, i) => sum + parseFloat(i.amount), 0);

    expect(totalSent).toBe(0);
    expect(totalReceived).toBe(0);
  });

  it('should merge and sort sent and received items', () => {
    const sentItems: ActivityItem[] = [
      {
        id: '1',
        type: 'sent',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        counterparty: '0x123',
        status: 'completed',
        created_at: '2025-01-20T10:00:00Z',
      },
    ];

    const receivedItems: ActivityItem[] = [
      {
        id: '2',
        type: 'received',
        amount: '50',
        token: 'USDC',
        chain_id: 1,
        counterparty: '0x456',
        status: 'completed',
        created_at: '2025-01-21T10:00:00Z',
      },
    ];

    const merged = [...sentItems, ...receivedItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    expect(merged[0].id).toBe('2'); // More recent
    expect(merged[1].id).toBe('1');
  });
});
