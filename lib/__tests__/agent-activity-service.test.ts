/**
 * Agent Activity Service Tests
 * 
 * Property-based tests for Activity Logging and Analytics.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-activity-service.test.ts
 */

import * as fc from 'fast-check';
import { 
  agentActivityService, 
  AgentAction,
  setUseDatabaseStorage 
} from '../services/agent-activity-service';

// ============================================
// Test Helpers
// ============================================

const validActions: AgentAction[] = [
  'proposal_created',
  'proposal_approved',
  'proposal_rejected',
  'payment_executed',
  'payment_failed',
  'budget_checked',
  'webhook_received',
  'api_error',
];

// ============================================
// Unit Tests
// ============================================

describe('Agent Activity Service', () => {
  beforeEach(() => {
    setUseDatabaseStorage(false);
    agentActivityService._clearAll();
  });

  describe('log', () => {
    it('should create activity record', async () => {
      const activity = await agentActivityService.log(
        'agent-123',
        '0x1234567890123456789012345678901234567890',
        'proposal_created',
        { proposal_id: 'prop-123', amount: '100' }
      );

      expect(activity.id).toBeDefined();
      expect(activity.agent_id).toBe('agent-123');
      expect(activity.owner_address).toBe('0x1234567890123456789012345678901234567890');
      expect(activity.action).toBe('proposal_created');
      expect(activity.details).toEqual({ proposal_id: 'prop-123', amount: '100' });
      expect(activity.created_at).toBeInstanceOf(Date);
    });

    it('should normalize owner address to lowercase', async () => {
      const activity = await agentActivityService.log(
        'agent-123',
        '0xABCDEF1234567890123456789012345678901234',
        'proposal_created',
        {}
      );

      expect(activity.owner_address).toBe('0xabcdef1234567890123456789012345678901234');
    });

    it('should include optional metadata', async () => {
      const activity = await agentActivityService.log(
        'agent-123',
        '0x1234567890123456789012345678901234567890',
        'api_error',
        { error: 'test error' },
        { ip_address: '192.168.1.1', user_agent: 'TestAgent/1.0' }
      );

      expect(activity.ip_address).toBe('192.168.1.1');
      expect(activity.user_agent).toBe('TestAgent/1.0');
    });
  });

  describe('getActivities', () => {
    it('should return activities for agent', async () => {
      await agentActivityService.log('agent-123', '0x1234', 'proposal_created', {});
      await agentActivityService.log('agent-123', '0x1234', 'payment_executed', {});
      await agentActivityService.log('agent-456', '0x1234', 'proposal_created', {});

      const activities = await agentActivityService.getActivities('agent-123');
      
      expect(activities).toHaveLength(2);
      expect(activities.every(a => a.agent_id === 'agent-123')).toBe(true);
    });

    it('should return activities sorted by created_at desc', async () => {
      await agentActivityService.log('agent-123', '0x1234', 'proposal_created', {});
      await new Promise(r => setTimeout(r, 10));
      await agentActivityService.log('agent-123', '0x1234', 'payment_executed', {});

      const activities = await agentActivityService.getActivities('agent-123');
      
      expect(activities[0].action).toBe('payment_executed');
      expect(activities[1].action).toBe('proposal_created');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await agentActivityService.log('agent-123', '0x1234', 'proposal_created', { index: i });
      }

      const activities = await agentActivityService.getActivities('agent-123', 5);
      
      expect(activities).toHaveLength(5);
    });
  });

  describe('getOwnerActivities', () => {
    it('should return activities for owner across all agents', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      
      await agentActivityService.log('agent-1', owner, 'proposal_created', {});
      await agentActivityService.log('agent-2', owner, 'payment_executed', {});
      await agentActivityService.log('agent-3', '0xother', 'proposal_created', {});

      const activities = await agentActivityService.getOwnerActivities(owner);
      
      expect(activities).toHaveLength(2);
    });
  });

  describe('getAnalytics', () => {
    it('should calculate spending totals', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '100',
        recipient_address: '0xrecipient1',
        agent_name: 'Agent 1',
      });
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '200',
        recipient_address: '0xrecipient2',
        agent_name: 'Agent 1',
      });

      const analytics = await agentActivityService.getAnalytics(owner);
      
      expect(parseFloat(analytics.total_spent_today)).toBe(300);
      expect(parseFloat(analytics.total_spent_this_month)).toBe(300);
    });

    it('should track spending by agent', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '100',
        agent_name: 'Agent 1',
      });
      await agentActivityService.log('agent-2', owner, 'payment_executed', {
        amount: '200',
        agent_name: 'Agent 2',
      });

      const analytics = await agentActivityService.getAnalytics(owner);
      
      expect(analytics.spending_by_agent).toHaveLength(2);
      expect(analytics.spending_by_agent.find(s => s.agent_id === 'agent-2')?.amount).toBe('200');
    });

    it('should track top recipients', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '100',
        recipient_address: '0xrecipient1',
      });
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '200',
        recipient_address: '0xrecipient1',
      });
      await agentActivityService.log('agent-1', owner, 'payment_executed', {
        amount: '50',
        recipient_address: '0xrecipient2',
      });

      const analytics = await agentActivityService.getAnalytics(owner);
      
      expect(analytics.top_recipients).toHaveLength(2);
      expect(analytics.top_recipients[0].address).toBe('0xrecipient1');
      expect(analytics.top_recipients[0].count).toBe(2);
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 18: Activity Logging', () => {
    /**
     * Feature: agent-link-api, Property 18: Activity Logging
     * 
     * For any agent action, the activity service SHALL log the action
     * with all required fields and make it retrievable.
     * 
     * Validates: Requirements 1.7, 3.5, 6.4, 6.5
     */
    it('should log all agent actions with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.constantFrom(...validActions),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 100 })),
          async (agentId, ownerAddress, action, details) => {
            agentActivityService._clearAll();

            const activity = await agentActivityService.log(
              agentId,
              ownerAddress,
              action,
              details
            );

            // Verify required fields
            expect(activity.id).toBeDefined();
            expect(activity.agent_id).toBe(agentId);
            expect(activity.owner_address).toBe(ownerAddress.toLowerCase());
            expect(activity.action).toBe(action);
            expect(activity.details).toEqual(details);
            expect(activity.created_at).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should make activities retrievable by agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.integer({ min: 1, max: 10 }),
          async (agentId, ownerAddress, count) => {
            agentActivityService._clearAll();

            // Log multiple activities
            for (let i = 0; i < count; i++) {
              await agentActivityService.log(
                agentId,
                ownerAddress,
                validActions[i % validActions.length],
                { index: i }
              );
            }

            // Retrieve activities
            const activities = await agentActivityService.getActivities(agentId);
            
            expect(activities).toHaveLength(count);
            expect(activities.every(a => a.agent_id === agentId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should make activities retrievable by owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 3 }),
          async (ownerAddress, agentCount, activitiesPerAgent) => {
            agentActivityService._clearAll();

            // Log activities for multiple agents
            for (let i = 0; i < agentCount; i++) {
              for (let j = 0; j < activitiesPerAgent; j++) {
                await agentActivityService.log(
                  `agent-${i}`,
                  ownerAddress,
                  validActions[j % validActions.length],
                  {}
                );
              }
            }

            // Retrieve activities
            const activities = await agentActivityService.getOwnerActivities(ownerAddress);
            
            expect(activities).toHaveLength(agentCount * activitiesPerAgent);
            expect(activities.every(a => a.owner_address === ownerAddress.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique activity IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 20 }),
          async (count) => {
            agentActivityService._clearAll();

            const ids = new Set<string>();
            for (let i = 0; i < count; i++) {
              const activity = await agentActivityService.log(
                'agent-123',
                '0x1234567890123456789012345678901234567890',
                'proposal_created',
                { index: i }
              );
              ids.add(activity.id);
            }

            expect(ids.size).toBe(count);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19: Analytics Accuracy', () => {
    /**
     * Feature: agent-link-api, Property 19: Analytics Accuracy
     * 
     * For any set of payment activities, the analytics SHALL accurately
     * calculate spending totals, agent breakdowns, and recipient rankings.
     * 
     * Validates: Requirements 6.2, 6.6
     */
    it('should accurately calculate total spending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 10 }),
          async (ownerAddress, amounts) => {
            agentActivityService._clearAll();

            // Log payment activities
            for (const amount of amounts) {
              await agentActivityService.log(
                'agent-123',
                ownerAddress,
                'payment_executed',
                { amount: amount.toString(), recipient_address: '0xrecipient' }
              );
            }

            const analytics = await agentActivityService.getAnalytics(ownerAddress);
            const expectedTotal = amounts.reduce((sum, a) => sum + a, 0);
            
            expect(parseFloat(analytics.total_spent_today)).toBe(expectedTotal);
            expect(parseFloat(analytics.total_spent_this_month)).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accurately track spending by agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 10, max: 100 }),
          async (ownerAddress, agentCount, amountPerAgent) => {
            agentActivityService._clearAll();

            // Log payments for multiple agents
            for (let i = 0; i < agentCount; i++) {
              await agentActivityService.log(
                `agent-${i}`,
                ownerAddress,
                'payment_executed',
                { amount: amountPerAgent.toString(), agent_name: `Agent ${i}` }
              );
            }

            const analytics = await agentActivityService.getAnalytics(ownerAddress);
            
            expect(analytics.spending_by_agent).toHaveLength(agentCount);
            for (const agentSpending of analytics.spending_by_agent) {
              expect(parseFloat(agentSpending.amount)).toBe(amountPerAgent);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accurately rank top recipients', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.array(
            fc.record({
              recipient: fc.stringMatching(/^0x[a-f0-9]{40}$/),
              amount: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (ownerAddress, payments) => {
            agentActivityService._clearAll();

            // Log payments
            for (const payment of payments) {
              await agentActivityService.log(
                'agent-123',
                ownerAddress,
                'payment_executed',
                { 
                  amount: payment.amount.toString(), 
                  recipient_address: payment.recipient 
                }
              );
            }

            const analytics = await agentActivityService.getAnalytics(ownerAddress);
            
            // Verify recipients are sorted by amount descending
            for (let i = 1; i < analytics.top_recipients.length; i++) {
              const prev = parseFloat(analytics.top_recipients[i - 1].amount);
              const curr = parseFloat(analytics.top_recipients[i].amount);
              expect(prev).toBeGreaterThanOrEqual(curr);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should count recipient transactions correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          fc.integer({ min: 1, max: 10 }),
          async (ownerAddress, recipientAddress, paymentCount) => {
            agentActivityService._clearAll();

            // Log multiple payments to same recipient
            for (let i = 0; i < paymentCount; i++) {
              await agentActivityService.log(
                'agent-123',
                ownerAddress,
                'payment_executed',
                { amount: '100', recipient_address: recipientAddress }
              );
            }

            const analytics = await agentActivityService.getAnalytics(ownerAddress);
            const recipientData = analytics.top_recipients.find(
              r => r.address === recipientAddress.toLowerCase()
            );
            
            expect(recipientData).toBeDefined();
            expect(recipientData?.count).toBe(paymentCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
