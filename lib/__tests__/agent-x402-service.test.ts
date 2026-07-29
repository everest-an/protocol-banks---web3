/**
 * Agent x402 Service Tests
 * 
 * Property-based tests for x402 integration with agent proposals.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-x402-service.test.ts
 */

import * as fc from 'fast-check';
import { agentX402Service, setUseDatabaseStorage as setX402Db } from '../services/agent-x402-service';
import { proposalService, PaymentProposal, setUseDatabaseStorage as setProposalDb } from '../services/proposal-service';
import { agentService, setUseDatabaseStorage as setAgentDb } from '../services/agent-service';

// Mock Prisma to prevent DB calls from notification-service
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'mock-pref-id',
        user_address: '0xtest',
        payment_received: true,
        payment_sent: true,
        subscription_reminder: true,
        subscription_payment: true,
        multisig_proposal: true,
        multisig_executed: true,
        agent_proposal_created: true,
        agent_proposal_approved: true,
        agent_payment_executed: true,
        agent_payment_failed: true,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    },
    pushSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}));

// ============================================
// Test Helpers
// ============================================

const validChainIds = [1, 137, 42161, 10, 8453];
const validTokens = ['USDC', 'USDT', 'DAI'];

// ============================================
// Unit Tests
// ============================================

describe('Agent x402 Service', () => {
  const testOwnerAddress = '0x1234567890123456789012345678901234567890';

  const originalAllowMock = process.env.ALLOW_MOCK_EXECUTION;

  beforeEach(() => {
    // No relayer is configured under test. Opt in explicitly to the simulated
    // execution path — without this the service correctly refuses to report a
    // payment it never submitted on-chain.
    process.env.ALLOW_MOCK_EXECUTION = 'true';
    setX402Db(false);
    setProposalDb(false);
    setAgentDb(false);
    agentX402Service._clearAll();
    proposalService._clearAll();
    agentService._clearAll();
  });

  afterEach(() => {
    if (originalAllowMock === undefined) {
      delete process.env.ALLOW_MOCK_EXECUTION;
    } else {
      process.env.ALLOW_MOCK_EXECUTION = originalAllowMock;
    }
  });

  async function createApprovedProposal(options: {
    amount?: string;
    token?: string;
    chainId?: number;
    recipient?: string;
  } = {}): Promise<PaymentProposal> {
    const { agent } = await agentService.create({
      owner_address: testOwnerAddress,
      name: 'Test Agent',
    });

    const proposal = await proposalService.create({
      agent_id: agent.id,
      owner_address: testOwnerAddress,
      recipient_address: options.recipient || '0xabcdef1234567890123456789012345678901234',
      amount: options.amount || '100',
      token: options.token || 'USDC',
      chain_id: options.chainId || 1,
      reason: 'Test payment',
    });

    // Approve the proposal
    return proposalService.approve(proposal.id, testOwnerAddress);
  }

  describe('generateAuthorization', () => {
    it('should generate authorization for approved proposal', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);

      expect(auth.id).toBeDefined();
      expect(auth.proposal_id).toBe(proposal.id);
      expect(auth.version).toBe('1.0');
      expect(auth.payment_address).toBe(proposal.recipient_address);
      expect(auth.amount).toBe(proposal.amount);
      expect(auth.token).toBe(proposal.token);
      expect(auth.chain_id).toBe(proposal.chain_id);
      expect(auth.expires_at).toBeInstanceOf(Date);
      expect(auth.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject pending proposals', async () => {
      const { agent } = await agentService.create({
        owner_address: testOwnerAddress,
        name: 'Test Agent',
      });

      const proposal = await proposalService.create({
        agent_id: agent.id,
        owner_address: testOwnerAddress,
        recipient_address: '0xabcdef1234567890123456789012345678901234',
        amount: '100',
        token: 'USDC',
        chain_id: 1,
        reason: 'Test',
      });

      await expect(
        agentX402Service.generateAuthorization(proposal, testOwnerAddress)
      ).rejects.toThrow('Cannot generate authorization');
    });
  });

  describe('storeSignature', () => {
    it('should store signature for authorization', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);
      const mockSignature = '0x' + 'ab'.repeat(65); // 130 hex chars = 65 bytes
      const signedAuth = await agentX402Service.storeSignature(auth.id, mockSignature);

      expect(signedAuth.signature).toBe(mockSignature);
      expect(signedAuth.status).toBe('signed');
    });

    it('should reject non-existent authorization', async () => {
      await expect(
        agentX402Service.storeSignature('non-existent-id', '0xdeadbeef')
      ).rejects.toThrow('Authorization not found');
    });
  });

  describe('executePayment', () => {
    it('should execute signed authorization', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);
      const mockSignature = '0x' + 'ab'.repeat(65);
      await agentX402Service.storeSignature(auth.id, mockSignature);
      
      const result = await agentX402Service.executePayment(auth.id);

      expect(result.success).toBe(true);
      expect(result.tx_hash).toMatch(/^0x[a-f0-9]+$/);
    });

    it('should reject unsigned authorization', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);
      
      const result = await agentX402Service.executePayment(auth.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not signed');
    });

    it('should reject non-existent authorization', async () => {
      const result = await agentX402Service.executePayment('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('processProposalPayment', () => {
    const testSignature = '0x' + 'ab'.repeat(65);

    it('should complete full payment flow', async () => {
      const proposal = await createApprovedProposal();
      const result = await agentX402Service.processProposalPayment(
        proposal,
        testOwnerAddress,
        testSignature
      );

      expect(result.success).toBe(true);
      expect(result.tx_hash).toBeDefined();
    });

    it('should refuse to execute without an owner signature', async () => {
      const proposal = await createApprovedProposal();
      const result = await agentX402Service.processProposalPayment(proposal, testOwnerAddress);

      // Funds move under the owner's signature; the server has no valid
      // substitute, so it must not invent one.
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/signature/i);
    });
  });

  // ============================================
  // Property Tests
  // ============================================

  describe('Property 17: x402 Authorization Generation', () => {
    /**
     * Feature: agent-link-api, Property 17: x402 Authorization Generation
     * 
     * For any approved proposal, generating x402 authorization SHALL produce
     * a valid authorization with correct payment details, EIP-3009 signature
     * format, and expiration time.
     * 
     * Validates: Requirements 8.1, 8.2, 8.3
     */
    it('should generate valid authorization for any approved proposal', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }).map(n => n.toString()),
          fc.constantFrom(...validTokens),
          fc.constantFrom(...validChainIds),
          fc.stringMatching(/^0x[a-f0-9]{40}$/),
          async (amount, token, chainId, recipient) => {
            agentX402Service._clearAll();
            proposalService._clearAll();
            agentService._clearAll();

            const proposal = await createApprovedProposal({
              amount,
              token,
              chainId,
              recipient,
            });

            const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);

            // Verify authorization fields
            expect(auth.version).toBe('1.0');
            expect(auth.payment_address).toBe(recipient.toLowerCase());
            expect(auth.amount).toBe(amount);
            expect(auth.token).toBe(token.toUpperCase());
            expect(auth.chain_id).toBe(chainId);
            expect(auth.valid_before.getTime()).toBeGreaterThan(Date.now());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should store signatures correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }).map(n => n.toString()),
          fc.constantFrom(...validTokens),
          async (amount, token) => {
            agentX402Service._clearAll();
            proposalService._clearAll();
            agentService._clearAll();

            const proposal = await createApprovedProposal({ amount, token });
            const auth = await agentX402Service.generateAuthorization(proposal, testOwnerAddress);
            const mockSignature = '0x' + 'ab'.repeat(65);
            const signedAuth = await agentX402Service.storeSignature(auth.id, mockSignature);

            // Verify signature was stored
            expect(signedAuth.signature).toBe(mockSignature);
            expect(signedAuth.status).toBe('signed');

            // Verify authorization time bounds
            const now = Math.floor(Date.now() / 1000);
            expect(Math.floor(signedAuth.valid_after.getTime() / 1000)).toBeLessThanOrEqual(now + 1);
            expect(Math.floor(signedAuth.valid_before.getTime() / 1000)).toBeGreaterThan(now);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should execute payments successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }).map(n => n.toString()),
          fc.constantFrom(...validTokens),
          fc.constantFrom(...validChainIds),
          async (amount, token, chainId) => {
            agentX402Service._clearAll();
            proposalService._clearAll();
            agentService._clearAll();

            const proposal = await createApprovedProposal({ amount, token, chainId });
            const result = await agentX402Service.processProposalPayment(
              proposal,
              testOwnerAddress,
              '0x' + 'ab'.repeat(65)
            );

            expect(result.success).toBe(true);
            expect(result.tx_hash).toMatch(/^0x[a-f0-9]+$/);
            expect(result.authorization_id).toBeDefined();
          }
        ),
        { numRuns: 10 }  // Reduced: each run includes 300ms simulated execution delay
      );
    }, 60000);
  });
});
