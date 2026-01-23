/**
 * Agent x402 Service Tests
 * 
 * Property-based tests for x402 integration with agent proposals.
 * Feature: agent-link-api
 * 
 * @module lib/__tests__/agent-x402-service.test.ts
 */

import * as fc from 'fast-check';
import { agentX402Service } from '../services/agent-x402-service';
import { proposalService, PaymentProposal } from '../services/proposal-service';
import { agentService } from '../services/agent-service';

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

  beforeEach(() => {
    agentX402Service._clearAll();
    proposalService._clearAll();
    agentService._clearAll();
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
      const auth = await agentX402Service.generateAuthorization(proposal);

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
        agentX402Service.generateAuthorization(proposal)
      ).rejects.toThrow('Cannot generate authorization');
    });
  });

  describe('signAuthorization', () => {
    it('should sign authorization with EIP-3009 format', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal);
      const signedAuth = await agentX402Service.signAuthorization(auth.id, testOwnerAddress);

      expect(signedAuth.signature).toBeDefined();
      expect(signedAuth.signature?.v).toBe(27);
      expect(signedAuth.signature?.r).toMatch(/^0x[a-f0-9]{64}$/);
      expect(signedAuth.signature?.s).toMatch(/^0x[a-f0-9]{64}$/);
      expect(signedAuth.signature?.nonce).toMatch(/^0x[a-f0-9]{64}$/);
      expect(signedAuth.signature?.valid_after).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
      expect(signedAuth.signature?.valid_before).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject non-existent authorization', async () => {
      await expect(
        agentX402Service.signAuthorization('non-existent-id', testOwnerAddress)
      ).rejects.toThrow('Authorization not found');
    });
  });

  describe('executePayment', () => {
    it('should execute signed authorization', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal);
      await agentX402Service.signAuthorization(auth.id, testOwnerAddress);
      
      const result = await agentX402Service.executePayment(auth.id);

      expect(result.success).toBe(true);
      expect(result.tx_hash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.gas_used).toBeDefined();
      expect(result.block_number).toBeDefined();
    });

    it('should reject unsigned authorization', async () => {
      const proposal = await createApprovedProposal();
      const auth = await agentX402Service.generateAuthorization(proposal);
      
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
    it('should complete full payment flow', async () => {
      const proposal = await createApprovedProposal();
      const result = await agentX402Service.processProposalPayment(proposal, testOwnerAddress);

      expect(result.success).toBe(true);
      expect(result.tx_hash).toBeDefined();
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

            const auth = await agentX402Service.generateAuthorization(proposal);

            // Verify authorization fields
            expect(auth.version).toBe('1.0');
            expect(auth.payment_address).toBe(recipient);
            expect(auth.amount).toBe(amount);
            expect(auth.token).toBe(token);
            expect(auth.chain_id).toBe(chainId);
            expect(auth.expires_at.getTime()).toBeGreaterThan(Date.now());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid EIP-3009 signatures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }).map(n => n.toString()),
          fc.constantFrom(...validTokens),
          async (amount, token) => {
            agentX402Service._clearAll();
            proposalService._clearAll();
            agentService._clearAll();

            const proposal = await createApprovedProposal({ amount, token });
            const auth = await agentX402Service.generateAuthorization(proposal);
            const signedAuth = await agentX402Service.signAuthorization(auth.id, testOwnerAddress);

            // Verify signature format
            expect(signedAuth.signature).toBeDefined();
            expect(signedAuth.signature?.v).toBeGreaterThanOrEqual(27);
            expect(signedAuth.signature?.v).toBeLessThanOrEqual(28);
            expect(signedAuth.signature?.r).toMatch(/^0x[a-f0-9]{64}$/);
            expect(signedAuth.signature?.s).toMatch(/^0x[a-f0-9]{64}$/);
            expect(signedAuth.signature?.nonce).toMatch(/^0x[a-f0-9]{64}$/);
            
            // Verify time bounds
            const now = Math.floor(Date.now() / 1000);
            expect(signedAuth.signature?.valid_after).toBeLessThanOrEqual(now + 1);
            expect(signedAuth.signature?.valid_before).toBeGreaterThan(now);
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
            const result = await agentX402Service.processProposalPayment(proposal, testOwnerAddress);

            expect(result.success).toBe(true);
            expect(result.tx_hash).toMatch(/^0x[a-f0-9]{64}$/);
            expect(result.gas_used).toBeDefined();
            expect(result.block_number).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
