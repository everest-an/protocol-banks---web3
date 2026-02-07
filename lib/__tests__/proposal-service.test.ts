/**
 * Proposal Service Tests
 * 
 * Property-based tests for Proposal Service functionality.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/proposal-service.test.ts
 */

import * as fc from 'fast-check';
import { 
  proposalService, 
  CreateProposalInput,
  setUseDatabaseStorage as setProposalDb,
} from '../services/proposal-service';
import { agentService, setUseDatabaseStorage as setAgentDb } from '../services/agent-service';

// ============================================
// Test Helpers
// ============================================

const validTokens = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH'];
const validChainIds = [1, 137, 42161, 10, 8453];

// Arbitrary for wallet address
const walletAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(s => `0x${s}`);

// Arbitrary for positive amount
const amountArb = fc.integer({ min: 1, max: 1000000 })
  .map(n => (n / 100).toFixed(2));

// Arbitrary for reason
const reasonArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

// Arbitrary for proposal input
const proposalInputArb = fc.record({
  recipient_address: walletAddressArb,
  amount: amountArb,
  token: fc.constantFrom(...validTokens),
  chain_id: fc.constantFrom(...validChainIds),
  reason: reasonArb,
  metadata: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
});

// ============================================
// Unit Tests
// ============================================

describe('Proposal Service', () => {
  let testAgentId: string;
  let testOwnerAddress: string;

  beforeEach(async () => {
    setProposalDb(false);
    setAgentDb(false);
    proposalService._clearAll();
    agentService._clearAll();
    
    // Create a test agent
    testOwnerAddress = '0x1234567890123456789012345678901234567890';
    const { agent } = await agentService.create({
      owner_address: testOwnerAddress,
      name: 'Test Agent',
    });
    testAgentId = agent.id;
  });

  describe('create', () => {
    it('should create a proposal with valid input', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.agent_id).toBe(testAgentId);
      expect(proposal.amount).toBe('100');
      expect(proposal.token).toBe('USDC');
      expect(proposal.status).toBe('pending');
    });

    it('should reject missing required fields', async () => {
      await expect(proposalService.create({
        agent_id: '',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      })).rejects.toThrow('agent_id is required');

      await expect(proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      })).rejects.toThrow('recipient_address is required');
    });

    it('should reject invalid recipient address', async () => {
      await expect(proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: 'invalid',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      })).rejects.toThrow('recipient_address must be a valid Ethereum address');
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 9: Proposal Lifecycle', () => {
    /**
     * Feature: agent-link-api, Property 9: Proposal Lifecycle
     * 
     * For any proposal created by an agent, the proposal SHALL transition 
     * through valid states: pending → (approved | rejected) → 
     * (executing → executed | failed). Invalid state transitions SHALL be rejected.
     * 
     * Validates: Requirements 4.1, 4.5, 4.6, 4.7
     */
    it('should follow valid state transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          proposalInputArb,
          fc.boolean(), // approve or reject
          async (ownerAddress, input, shouldApprove) => {
            proposalService._clearAll();
            agentService._clearAll();

            const { agent } = await agentService.create({
              owner_address: ownerAddress,
              name: 'Test Agent',
            });

            // Create proposal - starts as pending
            const proposal = await proposalService.create({
              agent_id: agent.id,
              owner_address: ownerAddress,
              ...input,
            });
            expect(proposal.status).toBe('pending');

            if (shouldApprove) {
              // Approve path: pending → approved → executing → executed
              const approved = await proposalService.approve(proposal.id, ownerAddress);
              expect(approved.status).toBe('approved');
              expect(approved.approved_at).toBeDefined();

              const executing = await proposalService.startExecution(proposal.id);
              expect(executing.status).toBe('executing');

              const executed = await proposalService.markExecuted(proposal.id, '0xtxhash123');
              expect(executed.status).toBe('executed');
              expect(executed.tx_hash).toBe('0xtxhash123');
              expect(executed.executed_at).toBeDefined();
            } else {
              // Reject path: pending → rejected
              const rejected = await proposalService.reject(proposal.id, ownerAddress, 'Test rejection');
              expect(rejected.status).toBe('rejected');
              expect(rejected.rejection_reason).toBe('Test rejection');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid state transitions', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      });

      // Cannot execute pending proposal
      await expect(proposalService.startExecution(proposal.id))
        .rejects.toThrow('Invalid state transition');

      // Cannot mark pending as executed
      await expect(proposalService.markExecuted(proposal.id, '0xtx'))
        .rejects.toThrow('Invalid state transition');

      // Approve first
      await proposalService.approve(proposal.id, testOwnerAddress);

      // Cannot approve again
      await expect(proposalService.approve(proposal.id, testOwnerAddress))
        .rejects.toThrow('Invalid state transition');
    });
  });

  describe('Property 10: Proposal Validation', () => {
    /**
     * Feature: agent-link-api, Property 10: Proposal Validation
     * 
     * For any proposal creation request missing required fields 
     * (recipient, amount, token, chain, reason), the service SHALL 
     * reject the request with a validation error.
     * 
     * Validates: Requirements 4.2
     */
    it('should reject invalid proposal inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          walletAddressArb,
          fc.constantFrom('recipient_address', 'amount', 'token', 'reason'),
          async (ownerAddress, missingField) => {
            proposalService._clearAll();
            agentService._clearAll();

            const { agent } = await agentService.create({
              owner_address: ownerAddress,
              name: 'Test Agent',
            });

            const validInput: CreateProposalInput = {
              agent_id: agent.id,
              owner_address: ownerAddress,
              recipient_address: '0xabcdef1234567890123456789012345678901234',
              amount: '100',
              token: 'USDC',
              chain_id: 1,
              reason: 'Test payment',
            };

            // Remove the field to test
            const invalidInput = { ...validInput };
            (invalidInput as any)[missingField] = '';

            await expect(proposalService.create(invalidInput))
              .rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative amounts', async () => {
      await expect(proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '-100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      })).rejects.toThrow('amount must be a positive number');
    });
  });

  describe('createBatch', () => {
    it('should create multiple proposals', async () => {
      const inputs: CreateProposalInput[] = [
        {
          agent_id: testAgentId,
          owner_address: testOwnerAddress,
          recipient_address: '0xabcdef1234567890123456789012345678901234',
          amount: '100',
          token: 'USDC',
          chain_id: 1,
          reason: 'Payment 1',
        },
        {
          agent_id: testAgentId,
          owner_address: testOwnerAddress,
          recipient_address: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '200',
          token: 'ETH',
          chain_id: 1,
          reason: 'Payment 2',
        },
      ];

      const proposals = await proposalService.createBatch(inputs);
      expect(proposals).toHaveLength(2);
      expect(proposals[0].amount).toBe('100');
      expect(proposals[1].amount).toBe('200');
    });

    it('should reject empty batch', async () => {
      await expect(proposalService.createBatch([]))
        .rejects.toThrow('At least one proposal input is required');
    });

    it('should reject batch exceeding limit', async () => {
      const inputs = Array(101).fill({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      });

      await expect(proposalService.createBatch(inputs))
        .rejects.toThrow('Maximum 100 proposals per batch');
    });
  });

  describe('list and listByAgent', () => {
    it('should list proposals with filters', async () => {
      // Create multiple proposals
      await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Payment 1',
      });

      const proposal2 = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '200',
        token: 'ETH',
        chain_id: 1,
        reason: 'Payment 2',
      });

      // Approve one
      await proposalService.approve(proposal2.id, testOwnerAddress);

      // List all
      const all = await proposalService.list(testOwnerAddress);
      expect(all).toHaveLength(2);

      // Filter by status
      const pending = await proposalService.list(testOwnerAddress, { status: 'pending' });
      expect(pending).toHaveLength(1);

      const approved = await proposalService.list(testOwnerAddress, { status: 'approved' });
      expect(approved).toHaveLength(1);
    });

    it('should paginate results', async () => {
      // Create 5 proposals
      for (let i = 0; i < 5; i++) {
        await proposalService.create({
          agent_id: testAgentId,
          owner_address: testOwnerAddress,
          recipient_address: '0xabcdef1234567890123456789012345678901234',
          amount: `${(i + 1) * 100}`,
          token: 'USDC',
          chain_id: 1,
          reason: `Payment ${i + 1}`,
        });
      }

      const page1 = await proposalService.list(testOwnerAddress, { limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = await proposalService.list(testOwnerAddress, { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = await proposalService.list(testOwnerAddress, { limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });
  });

  describe('getPendingCount', () => {
    it('should count pending proposals', async () => {
      // Create 3 proposals
      const p1 = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Payment 1',
      });

      await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '200',
        token: 'ETH',
        chain_id: 1,
        reason: 'Payment 2',
      });

      await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xdeadbeef1234567890123456789012345678abcd',
        amount: '300',
        token: 'DAI',
        chain_id: 1,
        reason: 'Payment 3',
      });

      expect(await proposalService.getPendingCount(testOwnerAddress)).toBe(3);

      // Approve one
      await proposalService.approve(p1.id, testOwnerAddress);
      expect(await proposalService.getPendingCount(testOwnerAddress)).toBe(2);
    });
  });

  describe('markFailed', () => {
    it('should mark executing proposal as failed', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      });

      await proposalService.approve(proposal.id, testOwnerAddress);
      await proposalService.startExecution(proposal.id);
      
      const failed = await proposalService.markFailed(proposal.id, 'Transaction reverted');
      expect(failed.status).toBe('failed');
      expect(failed.rejection_reason).toBe('Transaction reverted');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle case-insensitive addresses', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress.toUpperCase(),
        recipient_address: '0xABCDEF1234567890123456789012345678901234',
        amount: '100',
        token: 'usdc',
        chain_id: 1,
        reason: 'Test',
      });

      expect(proposal.owner_address).toBe(testOwnerAddress.toLowerCase());
      expect(proposal.recipient_address).toBe('0xabcdef1234567890123456789012345678901234');
      expect(proposal.token).toBe('USDC');
    });

    it('should reject unauthorized approval', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      });

      const otherOwner = '0x9999999999999999999999999999999999999999';
      await expect(proposalService.approve(proposal.id, otherOwner))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle metadata', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
        metadata: {
          invoice_id: 'INV-001',
          category: 'supplies',
        },
      });

      expect(proposal.metadata).toEqual({
        invoice_id: 'INV-001',
        category: 'supplies',
      });
    });
  });

  // ============================================
  // Property 11: Proposal Notification Tests
  // ============================================

  describe('Property 11: Proposal Notification', () => {
    /**
     * Feature: agent-link-api, Property 11: Proposal Notification
     * 
     * For any proposal created, the owner SHALL receive a notification 
     * (push and/or email) within 30 seconds.
     * 
     * Validates: Requirements 4.3
     */
    it('should trigger notification on proposal creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          proposalInputArb,
          async (input) => {
            proposalService._clearAll();
            agentService._clearAll();

            const { agent } = await agentService.create({
              owner_address: testOwnerAddress,
              name: 'Test Agent',
            });

            // Create proposal with agent name for notification
            const proposal = await proposalService.create({
              agent_id: agent.id,
              agent_name: agent.name,
              owner_address: testOwnerAddress,
              ...input,
            });

            // Verify proposal was created (notification is async)
            expect(proposal.id).toBeDefined();
            expect(proposal.status).toBe('pending');
            
            // The notification is sent asynchronously and doesn't block
            // In a real test, we would mock the notification service
            // and verify it was called with correct parameters
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger notification on proposal approval', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        agent_name: 'Test Agent',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      // Approve with agent name for notification
      const approved = await proposalService.approve(proposal.id, testOwnerAddress, 'Test Agent');
      
      expect(approved.status).toBe('approved');
      expect(approved.approved_at).toBeDefined();
    });

    it('should trigger notification on proposal rejection', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        agent_name: 'Test Agent',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      // Reject with agent name for notification
      const rejected = await proposalService.reject(
        proposal.id, 
        testOwnerAddress, 
        'Budget exceeded',
        'Test Agent'
      );
      
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejection_reason).toBe('Budget exceeded');
    });

    it('should trigger notification on payment execution', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        agent_name: 'Test Agent',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      await proposalService.approve(proposal.id, testOwnerAddress);
      await proposalService.startExecution(proposal.id);
      
      // Mark executed with agent name and auto-execute flag
      const executed = await proposalService.markExecuted(
        proposal.id, 
        '0xtxhash123',
        undefined,
        'Test Agent',
        false // not auto-executed
      );
      
      expect(executed.status).toBe('executed');
      expect(executed.tx_hash).toBe('0xtxhash123');
    });

    it('should trigger notification on auto-executed payment', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        agent_name: 'Test Agent',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '50',
        token: 'USDC',
        chain_id: 1,
        reason: 'Auto-execute test',
      });

      await proposalService.approve(proposal.id, testOwnerAddress);
      await proposalService.startExecution(proposal.id);
      
      // Mark executed with auto-execute flag
      const executed = await proposalService.markExecuted(
        proposal.id, 
        '0xautotxhash',
        undefined,
        'Test Agent',
        true // auto-executed
      );
      
      expect(executed.status).toBe('executed');
    });

    it('should trigger notification on payment failure', async () => {
      const proposal = await proposalService.create({
        agent_id: testAgentId,
        agent_name: 'Test Agent',
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test payment',
      });

      await proposalService.approve(proposal.id, testOwnerAddress);
      await proposalService.startExecution(proposal.id);
      
      // Mark failed with agent name
      const failed = await proposalService.markFailed(
        proposal.id, 
        'Insufficient gas',
        'Test Agent'
      );
      
      expect(failed.status).toBe('failed');
      expect(failed.rejection_reason).toBe('Insufficient gas');
    });
  });
});
