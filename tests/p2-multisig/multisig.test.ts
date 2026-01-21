/**
 * P2 Multi-Signature Approval Tests
 * Tests for multi-sig proposal creation, approval flow, and execution
 */

import * as fc from 'fast-check';

describe('P2 Multi-Signature Approval', () => {
  describe('Proposal Creation', () => {
    it('should create valid proposal with required fields', () => {
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe('pending');
      expect(proposal.signatures).toHaveLength(0);
      expect(proposal.requiredSignatures).toBe(2);
    });

    it('should generate unique proposal IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const proposal = createProposal({
          type: 'transfer',
          to: '0x1234567890123456789012345678901234567890',
          value: '1000',
          token: 'USDC',
          chainId: 8453,
          requiredSignatures: 2,
          totalSigners: 3,
        });
        expect(ids.has(proposal.id)).toBe(false);
        ids.add(proposal.id);
      }
    });

    it('should validate required signatures <= total signers', () => {
      expect(() => createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 5,
        totalSigners: 3,
      })).toThrow('required signatures cannot exceed total signers');
    });

    it('should require at least 2 signers for multi-sig', () => {
      expect(() => createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 1,
        totalSigners: 1,
      })).toThrow('multi-sig requires at least 2 signers');
    });

    it('should support different proposal types', () => {
      const types = ['transfer', 'contract_call', 'add_signer', 'remove_signer', 'change_threshold'];
      
      types.forEach((type) => {
        const proposal = createProposal({
          type: type as any,
          to: '0x1234567890123456789012345678901234567890',
          value: '0',
          token: 'ETH',
          chainId: 1,
          requiredSignatures: 2,
          totalSigners: 3,
        });
        expect(proposal.type).toBe(type);
      });
    });

    it('should set expiration time', () => {
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
        expiresInHours: 24,
      });

      const expiresAt = new Date(proposal.expiresAt).getTime();
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('Signature Collection', () => {
    it('should add valid signatures', () => {
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      const signer = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const signature = '0x' + 'ab'.repeat(65);

      const result = addSignature(proposal, signer, signature);
      expect(result.success).toBe(true);
      expect(result.proposal.signatures).toHaveLength(1);
      expect(result.proposal.signatures[0].signer).toBe(signer);
    });

    it('should reject duplicate signatures from same signer', () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      const signer = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const signature = '0x' + 'ab'.repeat(65);

      proposal = addSignature(proposal, signer, signature).proposal;
      const result = addSignature(proposal, signer, signature);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already signed');
    });

    it('should track signature count correctly', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (signerCount) => {
          let proposal = createProposal({
            type: 'transfer',
            to: '0x1234567890123456789012345678901234567890',
            value: '1000',
            token: 'USDC',
            chainId: 8453,
            requiredSignatures: signerCount,
            totalSigners: signerCount,
          });

          for (let i = 0; i < signerCount; i++) {
            const signer = `0x${'a'.repeat(39)}${i.toString(16).padStart(1, '0')}`;
            const signature = '0x' + 'ab'.repeat(65);
            proposal = addSignature(proposal, signer, signature).proposal;
          }

          return proposal.signatures.length === signerCount;
        }),
        { numRuns: 20 }
      );
    });

    it('should update status when threshold reached', () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      expect(proposal.status).toBe('pending');

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;
      expect(proposal.status).toBe('pending');

      proposal = addSignature(proposal, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0x' + 'cd'.repeat(65)).proposal;
      expect(proposal.status).toBe('ready');
    });

    it('should reject signatures on expired proposals', () => {
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
        expiresInHours: -1, // Already expired
      });

      const result = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65));
      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('Proposal Execution', () => {
    it('should execute when threshold reached', async () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0x' + 'cd'.repeat(65)).proposal;

      const executor = createMockExecutor({ shouldSucceed: true });
      const result = await executeProposal(proposal, executor);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.proposal.status).toBe('executed');
    });

    it('should reject execution without enough signatures', async () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;

      const executor = createMockExecutor({ shouldSucceed: true });
      const result = await executeProposal(proposal, executor);

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient signatures');
    });

    it('should handle execution failures gracefully', async () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0x' + 'cd'.repeat(65)).proposal;

      const executor = createMockExecutor({ shouldSucceed: false, errorMessage: 'Insufficient funds' });
      const result = await executeProposal(proposal, executor);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
      expect(result.proposal.status).toBe('failed');
    });

    it('should prevent double execution', async () => {
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0x' + 'cd'.repeat(65)).proposal;

      const executor = createMockExecutor({ shouldSucceed: true });
      const result1 = await executeProposal(proposal, executor);
      expect(result1.success).toBe(true);

      const result2 = await executeProposal(result1.proposal, executor);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already executed');
    });
  });

  describe('Proposal Cancellation', () => {
    it('should allow creator to cancel pending proposal', () => {
      const creator = '0xcccccccccccccccccccccccccccccccccccccccc';
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
        creator,
      });

      const result = cancelProposal(proposal, creator);
      expect(result.success).toBe(true);
      expect(result.proposal.status).toBe('cancelled');
    });

    it('should reject cancellation by non-creator', () => {
      const creator = '0xcccccccccccccccccccccccccccccccccccccccc';
      const proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
        creator,
      });

      const result = cancelProposal(proposal, '0xdddddddddddddddddddddddddddddddddddddddd');
      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('only creator');
    });

    it('should reject cancellation of executed proposals', async () => {
      const creator = '0xcccccccccccccccccccccccccccccccccccccccc';
      let proposal = createProposal({
        type: 'transfer',
        to: '0x1234567890123456789012345678901234567890',
        value: '1000',
        token: 'USDC',
        chainId: 8453,
        requiredSignatures: 2,
        totalSigners: 3,
        creator,
      });

      proposal = addSignature(proposal, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0x' + 'cd'.repeat(65)).proposal;

      const executor = createMockExecutor({ shouldSucceed: true });
      const execResult = await executeProposal(proposal, executor);

      const cancelResult = cancelProposal(execResult.proposal, creator);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error?.toLowerCase()).toContain('cannot cancel');
    });
  });

  describe('Signer Management', () => {
    it('should add new signer through proposal', async () => {
      const wallet = createMultiSigWallet({
        signers: [
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        ],
        threshold: 2,
      });

      let proposal = createProposal({
        type: 'add_signer',
        to: '0xcccccccccccccccccccccccccccccccccccccccc', // New signer
        value: '0',
        token: 'ETH',
        chainId: 1,
        requiredSignatures: 2,
        totalSigners: 2,
      });

      proposal = addSignature(proposal, wallet.signers[0], '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, wallet.signers[1], '0x' + 'cd'.repeat(65)).proposal;

      const result = await executeSignerChange(wallet, proposal);
      expect(result.success).toBe(true);
      expect(result.wallet.signers).toHaveLength(3);
      expect(result.wallet.signers).toContain('0xcccccccccccccccccccccccccccccccccccccccc');
    });

    it('should remove signer through proposal', async () => {
      const wallet = createMultiSigWallet({
        signers: [
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          '0xcccccccccccccccccccccccccccccccccccccccc',
        ],
        threshold: 2,
      });

      let proposal = createProposal({
        type: 'remove_signer',
        to: '0xcccccccccccccccccccccccccccccccccccccccc', // Signer to remove
        value: '0',
        token: 'ETH',
        chainId: 1,
        requiredSignatures: 2,
        totalSigners: 3,
      });

      proposal = addSignature(proposal, wallet.signers[0], '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, wallet.signers[1], '0x' + 'cd'.repeat(65)).proposal;

      const result = await executeSignerChange(wallet, proposal);
      expect(result.success).toBe(true);
      expect(result.wallet.signers).toHaveLength(2);
      expect(result.wallet.signers).not.toContain('0xcccccccccccccccccccccccccccccccccccccccc');
    });

    it('should prevent removing signer below threshold', async () => {
      const wallet = createMultiSigWallet({
        signers: [
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        ],
        threshold: 2,
      });

      let proposal = createProposal({
        type: 'remove_signer',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '0',
        token: 'ETH',
        chainId: 1,
        requiredSignatures: 2,
        totalSigners: 2,
      });

      proposal = addSignature(proposal, wallet.signers[0], '0x' + 'ab'.repeat(65)).proposal;
      proposal = addSignature(proposal, wallet.signers[1], '0x' + 'cd'.repeat(65)).proposal;

      const result = await executeSignerChange(wallet, proposal);
      expect(result.success).toBe(false);
      expect(result.error).toContain('below threshold');
    });
  });
});

// Types and helper functions
interface Signature {
  signer: string;
  signature: string;
  timestamp: string;
}

interface Proposal {
  id: string;
  type: 'transfer' | 'contract_call' | 'add_signer' | 'remove_signer' | 'change_threshold';
  to: string;
  value: string;
  token: string;
  chainId: number;
  requiredSignatures: number;
  totalSigners: number;
  signatures: Signature[];
  status: 'pending' | 'ready' | 'executed' | 'failed' | 'cancelled' | 'expired';
  creator?: string;
  expiresAt: string;
  createdAt: string;
  txHash?: string;
}

interface ProposalParams {
  type: Proposal['type'];
  to: string;
  value: string;
  token: string;
  chainId: number;
  requiredSignatures: number;
  totalSigners: number;
  creator?: string;
  expiresInHours?: number;
}

function createProposal(params: ProposalParams): Proposal {
  if (params.requiredSignatures > params.totalSigners) {
    throw new Error('required signatures cannot exceed total signers');
  }
  if (params.totalSigners < 2) {
    throw new Error('multi-sig requires at least 2 signers');
  }

  const expiresInHours = params.expiresInHours ?? 72;
  return {
    id: generateProposalId(),
    type: params.type,
    to: params.to,
    value: params.value,
    token: params.token,
    chainId: params.chainId,
    requiredSignatures: params.requiredSignatures,
    totalSigners: params.totalSigners,
    signatures: [],
    status: 'pending',
    creator: params.creator,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function generateProposalId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function addSignature(proposal: Proposal, signer: string, signature: string): { success: boolean; proposal: Proposal; error?: string } {
  if (new Date(proposal.expiresAt).getTime() < Date.now()) {
    return { success: false, proposal, error: 'Proposal has expired' };
  }

  if (proposal.signatures.some(s => s.signer.toLowerCase() === signer.toLowerCase())) {
    return { success: false, proposal, error: 'Signer has already signed this proposal' };
  }

  const newSignatures = [
    ...proposal.signatures,
    { signer, signature, timestamp: new Date().toISOString() },
  ];

  const newStatus = newSignatures.length >= proposal.requiredSignatures ? 'ready' : 'pending';

  return {
    success: true,
    proposal: {
      ...proposal,
      signatures: newSignatures,
      status: newStatus,
    },
  };
}

interface Executor {
  execute(proposal: Proposal): Promise<{ success: boolean; txHash?: string; error?: string }>;
}

function createMockExecutor(options: { shouldSucceed: boolean; errorMessage?: string }): Executor {
  return {
    async execute(proposal: Proposal) {
      if (options.shouldSucceed) {
        return { success: true, txHash: '0x' + 'a'.repeat(64) };
      }
      return { success: false, error: options.errorMessage || 'Execution failed' };
    },
  };
}

async function executeProposal(proposal: Proposal, executor: Executor): Promise<{ success: boolean; proposal: Proposal; txHash?: string; error?: string }> {
  if (proposal.status === 'executed') {
    return { success: false, proposal, error: 'Proposal already executed' };
  }

  if (proposal.signatures.length < proposal.requiredSignatures) {
    return { success: false, proposal, error: 'Proposal has insufficient signatures' };
  }

  const result = await executor.execute(proposal);

  if (result.success) {
    return {
      success: true,
      proposal: { ...proposal, status: 'executed', txHash: result.txHash },
      txHash: result.txHash,
    };
  }

  return {
    success: false,
    proposal: { ...proposal, status: 'failed' },
    error: result.error,
  };
}

function cancelProposal(proposal: Proposal, requestor: string): { success: boolean; proposal: Proposal; error?: string } {
  if (proposal.status === 'executed') {
    return { success: false, proposal, error: 'Cannot cancel executed proposal' };
  }

  if (proposal.creator && proposal.creator.toLowerCase() !== requestor.toLowerCase()) {
    return { success: false, proposal, error: 'Only creator can cancel proposal' };
  }

  return {
    success: true,
    proposal: { ...proposal, status: 'cancelled' },
  };
}

interface MultiSigWallet {
  address: string;
  signers: string[];
  threshold: number;
}

function createMultiSigWallet(params: { signers: string[]; threshold: number }): MultiSigWallet {
  return {
    address: '0x' + 'e'.repeat(40),
    signers: params.signers,
    threshold: params.threshold,
  };
}

async function executeSignerChange(wallet: MultiSigWallet, proposal: Proposal): Promise<{ success: boolean; wallet: MultiSigWallet; error?: string }> {
  if (proposal.type === 'add_signer') {
    return {
      success: true,
      wallet: {
        ...wallet,
        signers: [...wallet.signers, proposal.to],
      },
    };
  }

  if (proposal.type === 'remove_signer') {
    const newSigners = wallet.signers.filter(s => s.toLowerCase() !== proposal.to.toLowerCase());
    if (newSigners.length < wallet.threshold) {
      return { success: false, wallet, error: 'Cannot remove signer: would fall below threshold' };
    }
    return {
      success: true,
      wallet: { ...wallet, signers: newSigners },
    };
  }

  return { success: false, wallet, error: 'Invalid proposal type' };
}
