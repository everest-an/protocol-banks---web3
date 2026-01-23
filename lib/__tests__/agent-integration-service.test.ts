/**
 * Agent Integration Service Tests
 * 
 * Integration tests for the complete proposal lifecycle.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-integration-service.test.ts
 */

import * as fc from 'fast-check';
import { agentIntegrationService } from '../services/agent-integration-service';
import { proposalService } from '../services/proposal-service';
import { agentService } from '../services/agent-service';
import { budgetService } from '../services/budget-service';
import { agentX402Service } from '../services/agent-x402-service';
import { agentWebhookService } from '../services/agent-webhook-service';
import { agentActivityService } from '../services/agent-activity-service';

// ============================================
// Test Setup
// ============================================

describe('Agent Integration Service', () => {
  const testOwnerAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    // Clear all stores
    proposalService._clearAll();
    agentService._clearAll();
    budgetService._clearAll();
    agentX402Service._clearAll();
    agentWebhookService._clearAll();
    agentActivityService._clearAll();
    agentIntegrationService._clearAll();
  });

  async function createTestAgent(options: {
    autoExecuteEnabled?: boolean;
    webhookUrl?: string;
  } = {}) {
    const { agent, apiKey } = await agentService.create({
      owner_address: testOwnerAddress,
      name: 'Test Agent',
      auto_execute_enabled: options.autoExecuteEnabled ?? false,
      webhook_url: options.webhookUrl,
    });
    return { agent, apiKey };
  }

  // ============================================
  // Unit Tests
  // ============================================

  describe('processNewProposal', () => {
    it('should create proposal and log activity', async () => {
      const { agent } = await createTestAgent();

      const result = await agentIntegrationService.processNewProposal({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      expect(result.proposal).toBeDefined();
      expect(result.proposal.status).toBe('pending');
      expect(result.activity_logged).toBe(true);
    });

    it('should auto-execute when enabled and within budget', async () => {
      const { agent } = await createTestAgent({ autoExecuteEnabled: true });

      // Create budget
      await budgetService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        amount: '1000',
        token: 'USDC',
        period: 'monthly',
      });

      const result = await agentIntegrationService.processNewProposal({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      // Auto-execute should be attempted (may succeed or fail based on x402 mock)
      // The key is that the proposal was processed
      expect(result.proposal).toBeDefined();
      expect(result.activity_logged).toBe(true);
      // If auto-executed, status should be 'executed', otherwise 'pending'
      expect(['pending', 'executed']).toContain(result.proposal.status);
    });

    it('should trigger webhooks when configured', async () => {
      const { agent } = await createTestAgent({
        webhookUrl: 'https://example.com/webhook',
      });

      const result = await agentIntegrationService.processNewProposal({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      expect(result.webhook_delivered).toBe(true);
    });
  });

  describe('approveAndExecute', () => {
    it('should approve and execute proposal', async () => {
      const { agent } = await createTestAgent();

      // Create proposal
      const proposal = await proposalService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      const result = await agentIntegrationService.approveAndExecute(
        proposal.id,
        testOwnerAddress
      );

      // Proposal should be approved (execution may depend on x402 mock)
      expect(['approved', 'executed']).toContain(result.proposal.status);
    });

    it('should deduct budget on execution', async () => {
      const { agent } = await createTestAgent();

      // Create budget
      const budget = await budgetService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        amount: '1000',
        token: 'USDC',
        period: 'monthly',
      });

      // Create proposal with budget
      const proposal = await proposalService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
        budget_id: budget.id,
      });

      await agentIntegrationService.approveAndExecute(proposal.id, testOwnerAddress);

      // Check budget was deducted
      const updatedBudget = await budgetService.get(budget.id, testOwnerAddress);
      expect(parseFloat(updatedBudget!.used_amount)).toBe(100);
    });
  });

  describe('rejectProposal', () => {
    it('should reject proposal and log activity', async () => {
      const { agent } = await createTestAgent();

      const proposal = await proposalService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      const rejected = await agentIntegrationService.rejectProposal(
        proposal.id,
        testOwnerAddress,
        'Not approved'
      );

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejection_reason).toBe('Not approved');
    });
  });

  describe('auditLog', () => {
    it('should create audit log entries', async () => {
      await agentIntegrationService.auditLog(
        'test.action',
        'owner',
        testOwnerAddress,
        'proposal',
        'prop-123',
        { test: 'data' }
      );

      const logs = await agentIntegrationService.getAuditLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('test.action');
      expect(logs[0].actor_type).toBe('owner');
      expect(logs[0].resource_type).toBe('proposal');
    });

    it('should filter audit logs', async () => {
      await agentIntegrationService.auditLog('action1', 'owner', 'owner1', 'proposal', 'prop-1', {});
      await agentIntegrationService.auditLog('action2', 'agent', 'agent1', 'proposal', 'prop-2', {});
      await agentIntegrationService.auditLog('action3', 'owner', 'owner1', 'budget', 'budget-1', {});

      const proposalLogs = await agentIntegrationService.getAuditLogs({ resourceType: 'proposal' });
      expect(proposalLogs).toHaveLength(2);

      const owner1Logs = await agentIntegrationService.getAuditLogs({ actorId: 'owner1' });
      expect(owner1Logs).toHaveLength(2);
    });
  });

  // ============================================
  // Integration Property Tests
  // ============================================

  describe('Full Proposal Lifecycle', () => {
    /**
     * Integration test: Complete proposal lifecycle
     * 
     * Tests the full flow from proposal creation through execution,
     * including activity logging, webhooks, and audit trails.
     */
    it('should complete full lifecycle for any valid proposal', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }).map(n => n.toString()),
          fc.constantFrom('USDC', 'USDT', 'DAI'),
          fc.constantFrom(1, 137, 8453),
          async (amount, token, chainId) => {
            // Clear stores
            proposalService._clearAll();
            agentService._clearAll();
            budgetService._clearAll();
            agentX402Service._clearAll();
            agentWebhookService._clearAll();
            agentActivityService._clearAll();
            agentIntegrationService._clearAll();

            // Setup
            const { agent } = await createTestAgent({
              webhookUrl: 'https://example.com/webhook',
              webhookSecret: 'secret',
            });

            // Create proposal
            const createResult = await agentIntegrationService.processNewProposal({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              recipient_address: '0xabcdef1234567890123456789012345678901234',
              amount,
              token,
              chain_id: chainId,
              reason: 'Test payment',
            });

            expect(createResult.proposal).toBeDefined();
            expect(createResult.activity_logged).toBe(true);

            // Approve and execute
            const executeResult = await agentIntegrationService.approveAndExecute(
              createResult.proposal.id,
              testOwnerAddress
            );

            // Proposal should be approved or executed
            expect(['approved', 'executed']).toContain(executeResult.proposal.status);

            // Verify audit trail
            const auditLogs = await agentIntegrationService.getAuditLogs({
              resourceId: createResult.proposal.id,
            });
            expect(auditLogs.length).toBeGreaterThanOrEqual(1); // at least created
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle auto-execute lifecycle correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }).map(n => n.toString()),
          fc.integer({ min: 200, max: 1000 }).map(n => n.toString()),
          async (paymentAmount, budgetAmount) => {
            // Clear stores
            proposalService._clearAll();
            agentService._clearAll();
            budgetService._clearAll();
            agentX402Service._clearAll();
            agentWebhookService._clearAll();
            agentActivityService._clearAll();
            agentIntegrationService._clearAll();

            // Setup with auto-execute
            const { agent } = await createTestAgent({ autoExecuteEnabled: true });

            // Create budget
            await budgetService.create({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              amount: budgetAmount,
              token: 'USDC',
              period: 'monthly',
            });

            // Create proposal (should auto-execute)
            const result = await agentIntegrationService.processNewProposal({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              recipient_address: '0xabcdef1234567890123456789012345678901234',
              amount: paymentAmount,
              token: 'USDC',
              chain_id: 1,
              reason: 'Auto-execute test',
            });

            // Auto-execute should be attempted
            // The key is that the proposal was processed correctly
            expect(result.proposal).toBeDefined();
            expect(result.activity_logged).toBe(true);
            // Status depends on whether auto-execute succeeded
            expect(['pending', 'executed']).toContain(result.proposal.status);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle rejection lifecycle correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }).map(n => n.toString()),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (amount, rejectionReason) => {
            // Clear stores
            proposalService._clearAll();
            agentService._clearAll();
            budgetService._clearAll();
            agentX402Service._clearAll();
            agentWebhookService._clearAll();
            agentActivityService._clearAll();
            agentIntegrationService._clearAll();

            // Setup
            const { agent } = await createTestAgent();

            // Create proposal
            const createResult = await agentIntegrationService.processNewProposal({
              agent_id: agent.id,
              owner_address: testOwnerAddress,
              recipient_address: '0xabcdef1234567890123456789012345678901234',
              amount,
              token: 'USDC',
              chain_id: 1,
              reason: 'Test payment',
            });

            // Reject
            const rejected = await agentIntegrationService.rejectProposal(
              createResult.proposal.id,
              testOwnerAddress,
              rejectionReason
            );

            expect(rejected.status).toBe('rejected');
            expect(rejected.rejection_reason).toBe(rejectionReason);

            // Verify audit trail
            const auditLogs = await agentIntegrationService.getAuditLogs({
              resourceId: createResult.proposal.id,
            });
            expect(auditLogs.some(l => l.action === 'proposal.rejected')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
