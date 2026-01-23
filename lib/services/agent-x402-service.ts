/**
 * Agent x402 Integration Service
 * 
 * Handles x402 authorization generation and payment execution for agent proposals.
 * 
 * @module lib/services/agent-x402-service
 */

import { randomUUID } from 'crypto';
import { PaymentProposal } from './proposal-service';

// ============================================
// Types
// ============================================

export interface X402Authorization {
  id: string;
  proposal_id: string;
  version: '1.0';
  network: string;
  payment_address: string;
  amount: string;
  token: string;
  chain_id: number;
  memo?: string;
  expires_at: Date;
  created_at: Date;
  signature?: X402Signature;
}

export interface X402Signature {
  v: number;
  r: string;
  s: string;
  nonce: string;
  valid_after: number;
  valid_before: number;
}

export interface X402ExecutionResult {
  success: boolean;
  tx_hash?: string;
  error?: string;
  gas_used?: string;
  block_number?: number;
}

// ============================================
// Constants
// ============================================

const CHAIN_NETWORKS: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avalanche',
};

const DEFAULT_EXPIRY_SECONDS = 3600; // 1 hour

// ============================================
// In-Memory Store
// ============================================

const authorizationStore = new Map<string, X402Authorization>();

// ============================================
// Agent x402 Service
// ============================================

export class AgentX402Service {
  /**
   * Generate x402 authorization for an approved proposal
   */
  async generateAuthorization(proposal: PaymentProposal): Promise<X402Authorization> {
    if (proposal.status !== 'approved' && proposal.status !== 'executing') {
      throw new Error(`Cannot generate authorization for proposal with status: ${proposal.status}`);
    }

    const network = CHAIN_NETWORKS[proposal.chain_id] || 'unknown';
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_SECONDS * 1000);

    const authorization: X402Authorization = {
      id: randomUUID(),
      proposal_id: proposal.id,
      version: '1.0',
      network,
      payment_address: proposal.recipient_address,
      amount: proposal.amount,
      token: proposal.token,
      chain_id: proposal.chain_id,
      memo: proposal.reason,
      expires_at: expiresAt,
      created_at: new Date(),
    };

    authorizationStore.set(authorization.id, authorization);
    return authorization;
  }

  /**
   * Sign authorization with wallet (simulated)
   * In production, this would use the owner's wallet to sign
   */
  async signAuthorization(
    authorizationId: string,
    ownerAddress: string
  ): Promise<X402Authorization> {
    const authorization = authorizationStore.get(authorizationId);
    if (!authorization) {
      throw new Error('Authorization not found');
    }

    // Generate simulated EIP-3009 signature
    const now = Math.floor(Date.now() / 1000);
    const signature: X402Signature = {
      v: 27,
      r: `0x${this.generateRandomHex(64)}`,
      s: `0x${this.generateRandomHex(64)}`,
      nonce: `0x${this.generateRandomHex(64)}`,
      valid_after: now,
      valid_before: now + DEFAULT_EXPIRY_SECONDS,
    };

    authorization.signature = signature;
    authorizationStore.set(authorizationId, authorization);
    return authorization;
  }

  /**
   * Execute payment via x402 relayer (simulated)
   * In production, this would submit to the x402 relayer
   */
  async executePayment(authorizationId: string): Promise<X402ExecutionResult> {
    const authorization = authorizationStore.get(authorizationId);
    if (!authorization) {
      return {
        success: false,
        error: 'Authorization not found',
      };
    }

    if (!authorization.signature) {
      return {
        success: false,
        error: 'Authorization not signed',
      };
    }

    if (new Date() > authorization.expires_at) {
      return {
        success: false,
        error: 'Authorization expired',
      };
    }

    // Simulate successful execution
    const txHash = `0x${this.generateRandomHex(64)}`;
    const blockNumber = Math.floor(Math.random() * 1000000) + 20000000;
    const gasUsed = (Math.floor(Math.random() * 50000) + 50000).toString();

    return {
      success: true,
      tx_hash: txHash,
      gas_used: gasUsed,
      block_number: blockNumber,
    };
  }

  /**
   * Full flow: generate, sign, and execute
   */
  async processProposalPayment(
    proposal: PaymentProposal,
    ownerAddress: string
  ): Promise<X402ExecutionResult> {
    try {
      // Generate authorization
      const authorization = await this.generateAuthorization(proposal);

      // Sign authorization
      await this.signAuthorization(authorization.id, ownerAddress);

      // Execute payment
      return await this.executePayment(authorization.id);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get authorization by ID
   */
  async getAuthorization(authorizationId: string): Promise<X402Authorization | null> {
    return authorizationStore.get(authorizationId) || null;
  }

  /**
   * Get authorization by proposal ID
   */
  async getAuthorizationByProposal(proposalId: string): Promise<X402Authorization | null> {
    for (const auth of authorizationStore.values()) {
      if (auth.proposal_id === proposalId) {
        return auth;
      }
    }
    return null;
  }

  /**
   * Generate random hex string
   */
  private generateRandomHex(length: number): string {
    return Array.from({ length }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Clear all authorizations (for testing)
   */
  _clearAll(): void {
    authorizationStore.clear();
  }

  /**
   * Get authorization count (for testing)
   */
  _getCount(): number {
    return authorizationStore.size;
  }
}

// Export singleton instance
export const agentX402Service = new AgentX402Service();
