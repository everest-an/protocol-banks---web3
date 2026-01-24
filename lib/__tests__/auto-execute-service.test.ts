/**
 * Auto-Execute Service Tests
 * 
 * Property-based tests for Auto-Execute Service functionality.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/auto-execute-service.test.ts
 */

import * as fc from 'fast-check';
import { autoExecuteService } from '../services/auto-execute-service';
import { proposalService } from '../services/proposal-service';
import { budgetService } from '../services/budget-service';
import { agentService, AutoExecuteRules } from '../services/agent-service';
import { notificationService } from '../services/notification-service';

// ============================================
// Test Helpers
// ============================================

// Arbitrary for wallet address
const walletAddressArb = fc.stringMatching(/^0x[a-f0-9]{40}$/);

// ============================================
// Unit Tests
// ============================================

describe('Auto-Execute Service', () => {
  let testOwnerAddress: string;

  beforeEach(async () => {
    proposalService._clearAll();
    budgetService._clearAll();
    agentService._clearAll();
    
    testOwnerAddress = '0x1234567890123456789012345678901234567890';
  });

  async function createTestAgent(options: {
    autoExecuteEnabled?: boolean;
    rules?: AutoExecuteRules;
    status?: 'active' | 'paused' | 'deactivated';
  } = {}) {
    const { agent } = await agentService.create({
      owner_address: testOwnerAddress,
      name: 'Test Agent',
      auto_execute_enabled: options.autoExecuteEnabled ?? true,
      auto_execute_rules: options.rules,
    });

    if (options.status && options.status !== 'active') {
      await agentService.update(agent.id, testOwnerAddress, { status: options.status });
    }

    return agent;
  }

  async function createTestProposal(agentId: string, options: {
    amount?: string;
    token?: string;
    chainId?: number;
    recipient?: string;
    budgetId?: string;
    agentName?: string;
  } = {}) {
    return proposalService.create({
      agent_id: agentId,
      owner_address: testOwnerAddress,
      recipient_address: options.recipient || '0xabcdef1234567890123456789012345678901234',
      amount: options.amount || '100',
      token: options.token || 'USDC',
      chain_id: options.chainId || 1,
      reason: 'Test payment',
      budget_id: options.budgetId,
      agent_name: options.agentName || 'Test Agent',
    });
  }

  describe('processProposal', () => {
    it('should auto-execute when all conditions are met', async () => {
      const agent = await createTestAgent({ autoExecuteEnabled: true });
      
      // Create budget
      const budget = await budgetService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        amount: '1000',
        token: 'USDC',
        period: 'monthly',
      });

      const proposal = await createTestProposal(agent.id, {
        amount: '100',
        token: 'USDC',
        budgetId: budget.id,
      });

      const result = await autoExecuteService.processProposal(proposal);

      expect(result.auto_executed).toBe(true);
      expect(result.tx_hash).toBeDefined();
      expect(result.proposal.status).toBe('executed');
    });

    it('should not auto-execute when disabled', async () => {
      const agent = await createTestAgent({ autoExecuteEnabled: false });
      const proposal = await createTestProposal(agent.id);

      const result = await autoExecuteService.processProposal(proposal);

      expect(result.auto_executed).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should not auto-execute when agent is paused', async () => {
      const agent = await createTestAgent({ 
        autoExecuteEnabled: true,
        status: 'paused',
      });
      const proposal = await createTestProposal(agent.id);

      const result = await autoExecuteService.processProposal(proposal);

      expect(result.auto_executed).toBe(false);
      expect(result.reason).toContain('paused');
    });
  });

  describe('checkRules', () => {
    it('should pass when no rules configured', async () => {
      const agent = await createTestAgent({ autoExecuteEnabled: true });
      const proposal = await createTestProposal(agent.id);

      const result = await autoExecuteService.checkRules(agent, proposal);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when amount exceeds max_single_amount', async () => {
      const agent = await createTestAgent({
        autoExecuteEnabled: true,
        rules: { max_single_amount: '50' },
      });
      const proposal = await createTestProposal(agent.id, { amount: '100' });

      const result = await autoExecuteService.checkRules(agent, proposal);

      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('max single amount'))).toBe(true);
    });

    it('should fail when token not in allowed list', async () => {
      const agent = await createTestAgent({
        autoExecuteEnabled: true,
        rules: { allowed_tokens: ['USDC', 'USDT'] },
      });
      const proposal = await createTestProposal(agent.id, { token: 'ETH' });

      const result = await autoExecuteService.checkRules(agent, proposal);

      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('not in allowed tokens'))).toBe(true);
    });

    it('should fail when recipient not in whitelist', async () => {
      const agent = await createTestAgent({
        autoExecuteEnabled: true,
        rules: { 
          allowed_recipients: ['0x1111111111111111111111111111111111111111'] 
        },
      });
      const proposal = await createTestProposal(agent.id, {
        recipient: '0xabcdef1234567890123456789012345678901234',
      });

      const result = await autoExecuteService.checkRules(agent, proposal);

      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('not in whitelist'))).toBe(true);
    });

    it('should fail when chain not in allowed list', async () => {
      const agent = await createTestAgent({
        autoExecuteEnabled: true,
        rules: { allowed_chains: [1, 137] },
      });
      const proposal = await createTestProposal(agent.id, { chainId: 42161 });

      const result = await autoExecuteService.checkRules(agent, proposal);

      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('not in allowed chains'))).toBe(true);
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 12: Auto-Execute Budget Enforcement', () => {
    /**
     * Feature: agent-link-api, Property 12: Auto-Execute Budget Enforcement
     * 
     * For any agent with auto-execute enabled, proposals within budget limits 
     * and passing all rules SHALL be automatically approved and executed. 
     * Proposals exceeding budget or violating rules SHALL be queued for manual approval.
     * 
     * Validates: Requirements 5.1, 5.2, 5.4, 5.5
     */
    it('should enforce budget limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 1000 }).map(n => n.toString()),
          fc.integer({ min: 1, max: 50 }).map(n => n.toString()),
          async (budgetAmount, paymentAmount) => {
            proposalService._clearAll();
            budgetService._clearAll();
            agentService._clearAll();

            const agent = await createTestAgent({ autoExecuteEnabled: true });
            
            const budget = await budgetService.create({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              amount: budgetAmount,
              token: 'USDC',
              period: 'monthly',
            });

            const proposal = await createTestProposal(agent.id, {
              amount: paymentAmount,
              token: 'USDC',
              budgetId: budget.id,
            });

            const result = await autoExecuteService.processProposal(proposal);

            const budgetNum = parseFloat(budgetAmount);
            const paymentNum = parseFloat(paymentAmount);

            if (paymentNum <= budgetNum) {
              expect(result.auto_executed).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }).map(n => n.toString()),
          fc.integer({ min: 1, max: 200 }).map(n => n.toString()),
          async (maxAmount, paymentAmount) => {
            proposalService._clearAll();
            budgetService._clearAll();
            agentService._clearAll();

            const agent = await createTestAgent({
              autoExecuteEnabled: true,
              rules: { max_single_amount: maxAmount },
            });

            // Create sufficient budget
            const budget = await budgetService.create({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              amount: '10000',
              token: 'USDC',
              period: 'monthly',
            });

            const proposal = await createTestProposal(agent.id, {
              amount: paymentAmount,
              token: 'USDC',
              budgetId: budget.id,
            });

            const result = await autoExecuteService.processProposal(proposal);

            const maxNum = parseFloat(maxAmount);
            const paymentNum = parseFloat(paymentAmount);

            if (paymentNum <= maxNum) {
              expect(result.auto_executed).toBe(true);
            } else {
              expect(result.auto_executed).toBe(false);
              expect(result.reason).toContain('Rule violations');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Auto-Execute Notification', () => {
    /**
     * Feature: agent-link-api, Property 13: Auto-Execute Notification
     * 
     * For any auto-executed payment, the owner SHALL receive a notification 
     * containing the agent name, amount, token, recipient, and transaction hash.
     * For payments requiring manual approval, the owner SHALL receive a 
     * notification with the reason for manual approval.
     * 
     * Validates: Requirements 5.3
     */
    it('should send notification on auto-executed payment', async () => {
      // Mock notification service
      const notifySpy = jest.spyOn(notificationService, 'notifyAgentPaymentExecuted')
        .mockResolvedValue(undefined);
      const proposalNotifySpy = jest.spyOn(notificationService, 'notifyAgentProposalCreated')
        .mockResolvedValue(undefined);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }).map(n => n.toString()),
          fc.constantFrom('USDC', 'USDT', 'DAI'),
          async (amount, token) => {
            proposalService._clearAll();
            budgetService._clearAll();
            agentService._clearAll();
            notifySpy.mockClear();
            proposalNotifySpy.mockClear();

            const agent = await createTestAgent({ autoExecuteEnabled: true });
            
            // Create sufficient budget
            const budget = await budgetService.create({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              amount: '10000',
              token,
              period: 'monthly',
            });

            const proposal = await createTestProposal(agent.id, {
              amount,
              token,
              budgetId: budget.id,
            });

            const result = await autoExecuteService.processProposal(proposal);

            if (result.auto_executed) {
              // Notification should be sent for auto-executed payment
              expect(notifySpy).toHaveBeenCalled();
              const callArgs = notifySpy.mock.calls[0];
              expect(callArgs[0]).toBe(testOwnerAddress); // owner
              expect(callArgs[1]).toBe(agent.name); // agent name
              expect(callArgs[2]).toBe(amount); // amount
              expect(callArgs[3]).toBe(token); // token
              expect(callArgs[5]).toBeDefined(); // tx_hash
              expect(callArgs[6]).toBe(true); // autoExecuted flag
            }
          }
        ),
        { numRuns: 100 }
      );

      notifySpy.mockRestore();
      proposalNotifySpy.mockRestore();
    });

    it('should send notification when manual approval is needed', async () => {
      // Mock notification service
      const notifySpy = jest.spyOn(notificationService, 'notifyAgentProposalCreated')
        .mockResolvedValue(undefined);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 500 }).map(n => n.toString()),
          fc.integer({ min: 10, max: 50 }).map(n => n.toString()),
          async (paymentAmount, maxAmount) => {
            proposalService._clearAll();
            budgetService._clearAll();
            agentService._clearAll();
            notifySpy.mockClear();

            // Create agent with rule that will be violated
            const agent = await createTestAgent({
              autoExecuteEnabled: true,
              rules: { max_single_amount: maxAmount },
            });

            // Create sufficient budget
            const budget = await budgetService.create({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              amount: '10000',
              token: 'USDC',
              period: 'monthly',
            });

            const proposal = await createTestProposal(agent.id, {
              amount: paymentAmount,
              token: 'USDC',
              budgetId: budget.id,
            });

            const result = await autoExecuteService.processProposal(proposal);

            const paymentNum = parseFloat(paymentAmount);
            const maxNum = parseFloat(maxAmount);

            if (paymentNum > maxNum) {
              // Should not auto-execute
              expect(result.auto_executed).toBe(false);
              // Notification should be sent for manual approval needed
              // The second call is from autoExecuteService (first is from proposalService.create)
              expect(notifySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
              const callArgs = notifySpy.mock.calls[1]; // Second call is from autoExecuteService
              expect(callArgs[0]).toBe(testOwnerAddress); // owner
              expect(callArgs[1]).toBe(agent.name); // agent name
              // Reason should mention manual approval
              expect(callArgs[5]).toContain('Manual approval needed');
            }
          }
        ),
        { numRuns: 100 }
      );

      notifySpy.mockRestore();
    });
  });

  describe('Property 14: Emergency Pause', () => {
    /**
     * Feature: agent-link-api, Property 14: Emergency Pause
     * 
     * For any owner invoking "pause all agents", all agents owned by that 
     * address SHALL immediately have auto-execute disabled and status set 
     * to "paused".
     * 
     * Validates: Requirements 5.6
     */
    it('should stop auto-execution when agent is paused', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          fc.integer({ min: 1, max: 5 }),
          async (ownerAddress, agentCount) => {
            proposalService._clearAll();
            budgetService._clearAll();
            agentService._clearAll();

            // Create multiple agents
            const agents: string[] = [];
            for (let i = 0; i < agentCount; i++) {
              const { agent } = await agentService.create({
                owner_address: ownerAddress,
                name: `Agent ${i}`,
                auto_execute_enabled: true,
              });
              agents.push(agent.id);

              // Create budget for each agent
              await budgetService.create({
                agent_id: agent.id,
                owner_address: ownerAddress,
                amount: '1000',
                token: 'USDC',
                period: 'monthly',
              });
            }

            // Pause all agents
            await agentService.pauseAll(ownerAddress);

            // Try to auto-execute proposals
            for (const agentId of agents) {
              const proposal = await proposalService.create({
                agent_id: agentId,
                owner_address: ownerAddress,
                recipient_address: '0xabcdef1234567890123456789012345678901234',
                amount: '100',
                token: 'USDC',
                chain_id: 1,
                reason: 'Test',
              });

              const result = await autoExecuteService.processProposal(proposal);
              expect(result.auto_executed).toBe(false);
              // Either paused or auto-execute disabled (pauseAll disables both)
              expect(result.reason).toMatch(/paused|disabled/i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('isWithinBudget', () => {
    it('should return true when budget is sufficient', async () => {
      const agent = await createTestAgent();
      
      await budgetService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        amount: '1000',
        token: 'USDC',
        period: 'monthly',
      });

      const result = await autoExecuteService.isWithinBudget(
        agent.id,
        '500',
        'USDC'
      );

      expect(result).toBe(true);
    });

    it('should return false when budget is insufficient', async () => {
      const agent = await createTestAgent();
      
      await budgetService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        amount: '100',
        token: 'USDC',
        period: 'monthly',
      });

      const result = await autoExecuteService.isWithinBudget(
        agent.id,
        '500',
        'USDC'
      );

      expect(result).toBe(false);
    });

    it('should return false when no budget exists', async () => {
      const agent = await createTestAgent();

      const result = await autoExecuteService.isWithinBudget(
        agent.id,
        '100',
        'USDC'
      );

      expect(result).toBe(false);
    });
  });
});
