/**
 * Agent x402 Integration Service
 *
 * Handles x402 authorization generation and payment execution for agent proposals.
 * Integrates with Supabase for persistence and relayer service for on-chain execution.
 *
 * @module lib/services/agent-x402-service
 */

import { randomUUID, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { PaymentProposal } from './proposal-service';
import { relayerService, isRelayerConfigured } from './relayer-service';
import type { Address, Hex } from 'viem';

// ============================================
// Types
// ============================================

export interface X402Authorization {
  id: string;
  proposal_id: string;
  version: '1.0';
  network: string;
  payment_address: string;
  from_address: string;
  amount: string;
  token: string;
  chain_id: number;
  memo?: string;
  nonce: string;
  valid_after: Date;
  valid_before: Date;
  signature?: string;
  status: 'pending' | 'signed' | 'executing' | 'completed' | 'failed' | 'expired';
  tx_hash?: string;
  transfer_id?: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
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
  authorization_id?: string;
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
// In-Memory Store (fallback for testing)
// ============================================

const authorizationStore = new Map<string, X402Authorization>();

let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

function convertDbAuth(data: any): X402Authorization {
  return {
    ...data,
    valid_after: new Date(data.valid_after),
    valid_before: new Date(data.valid_before),
    expires_at: new Date(data.expires_at || data.valid_before),
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

/**
 * Generate a cryptographic 32-byte nonce as hex
 */
function generateNonce(): string {
  return '0x' + randomBytes(32).toString('hex');
}

// ============================================
// Agent x402 Service
// ============================================

export class AgentX402Service {
  /**
   * Generate x402 authorization for an approved proposal.
   * Creates an unsigned authorization record in the database.
   */
  async generateAuthorization(
    proposal: PaymentProposal,
    ownerAddress: string
  ): Promise<X402Authorization> {
    if (proposal.status !== 'approved' && proposal.status !== 'executing') {
      throw new Error(`Cannot generate authorization for proposal with status: ${proposal.status}`);
    }

    const network = CHAIN_NETWORKS[proposal.chain_id] || 'unknown';
    const now = new Date();
    const nowUnix = Math.floor(now.getTime() / 1000);
    const validAfter = new Date((nowUnix - 60) * 1000); // 60s clock skew tolerance
    const validBefore = new Date((nowUnix + DEFAULT_EXPIRY_SECONDS) * 1000);
    const nonce = generateNonce();
    const transferId = randomUUID();

    const authData = {
      proposal_id: proposal.id,
      version: '1.0' as const,
      network,
      payment_address: proposal.recipient_address.toLowerCase(),
      from_address: ownerAddress.toLowerCase(),
      amount: proposal.amount,
      token: proposal.token.toUpperCase(),
      chain_id: proposal.chain_id,
      memo: proposal.reason,
      nonce,
      valid_after: validAfter.toISOString(),
      valid_before: validBefore.toISOString(),
      status: 'pending' as const,
      transfer_id: transferId,
      expires_at: validBefore.toISOString(),
    };

    if (useDatabaseStorage) {
      try {
        // Store in x402_authorizations table
        const data = await prisma.x402Authorization.create({
          data: {
            proposal_id: authData.proposal_id,
            version: authData.version,
            network: authData.network,
            payment_address: authData.payment_address,
            from_address: authData.from_address,
            amount: authData.amount,
            token: authData.token,
            chain_id: authData.chain_id,
            memo: authData.memo,
            nonce: authData.nonce,
            valid_after: new Date(authData.valid_after),
            valid_before: new Date(authData.valid_before),
            status: 'pending',
            transfer_id: transferId,
            expires_at: new Date(authData.expires_at),
          }
        });

        return {
          id: data.id,
          proposal_id: data.proposal_id,
          version: '1.0',
          network: data.network,
          payment_address: data.payment_address,
          from_address: data.from_address,
          amount: data.amount,
          token: data.token,
          chain_id: data.chain_id,
          memo: data.memo || undefined,
          nonce: data.nonce,
          valid_after: data.valid_after,
          valid_before: data.valid_before,
          status: 'pending',
          transfer_id: data.transfer_id || undefined,
          expires_at: data.expires_at,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      } catch (error) {
        console.error('[x402 Service] Failed to create authorization:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory
      const authorization: X402Authorization = {
        id: randomUUID(),
        proposal_id: proposal.id,
        version: '1.0',
        network,
        payment_address: authData.payment_address,
        from_address: authData.from_address,
        amount: authData.amount,
        token: authData.token,
        chain_id: proposal.chain_id,
        memo: proposal.reason,
        nonce,
        valid_after: validAfter,
        valid_before: validBefore,
        status: 'pending',
        transfer_id: transferId,
        expires_at: validBefore,
        created_at: now,
        updated_at: now,
      };

      authorizationStore.set(authorization.id, authorization);
      return authorization;
    }
  }

  /**
   * Store a signature for an authorization.
   * The actual EIP-712 signing happens client-side; this stores the result.
   */
  async storeSignature(
    authorizationId: string,
    signature: string
  ): Promise<X402Authorization> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.x402Authorization.update({
          where: { id: authorizationId },
          data: {
            signature,
            status: 'signed',
            updated_at: new Date(),
          }
        });

        return convertDbAuth(data);
      } catch (error) {
        console.error('[x402 Service] Failed to store signature:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory
      const authorization = authorizationStore.get(authorizationId);
      if (!authorization) {
        throw new Error('Authorization not found');
      }

      authorization.signature = signature;
      authorization.status = 'signed';
      authorization.updated_at = new Date();
      authorizationStore.set(authorizationId, authorization);
      return authorization;
    }
  }

  /**
   * Execute payment via the relayer service.
   * Uses the real relayer when configured, simulates otherwise.
   */
  async executePayment(authorizationId: string): Promise<X402ExecutionResult> {
    let auth: X402Authorization | null = null;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.x402Authorization.findUnique({
          where: { id: authorizationId }
        });
        if (data) auth = convertDbAuth(data);
      } catch {
        // Fall through
      }
    }

    if (!auth) {
      auth = authorizationStore.get(authorizationId) || null;
    }

    if (!auth) {
      return { success: false, error: 'Authorization not found' };
    }

    if (!auth.signature) {
      return { success: false, error: 'Authorization not signed' };
    }

    if (new Date() > auth.valid_before) {
      await this.updateAuthStatus(authorizationId, 'expired');
      return { success: false, error: 'Authorization expired' };
    }

    // Mark as executing
    await this.updateAuthStatus(authorizationId, 'executing');

    try {
      let txHash: string;

      if (isRelayerConfigured()) {
        // Use real relayer for on-chain execution
        const result = await relayerService.executeERC3009Transfer({
          chainId: auth.chain_id,
          token: auth.token,
          from: auth.from_address as Address,
          to: auth.payment_address as Address,
          value: auth.amount,
          validAfter: Math.floor(auth.valid_after.getTime() / 1000),
          validBefore: Math.floor(auth.valid_before.getTime() / 1000),
          nonce: auth.nonce as Hex,
          signature: auth.signature as Hex,
        });

        if (result.status === 'failed') {
          await this.updateAuthStatus(authorizationId, 'failed');
          return {
            success: false,
            error: result.error || 'Relayer execution failed',
            authorization_id: authorizationId,
          };
        }

        txHash = result.transactionHash || result.taskId;
      } else {
        // Development mode: simulate execution
        console.warn('[x402 Service] No relayer configured, simulating execution');
        txHash = '0x' + randomBytes(32).toString('hex');
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Update authorization with tx hash
      await this.updateAuthCompleted(authorizationId, txHash);

      return {
        success: true,
        tx_hash: txHash,
        authorization_id: authorizationId,
      };
    } catch (error) {
      await this.updateAuthStatus(authorizationId, 'failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        authorization_id: authorizationId,
      };
    }
  }

  /**
   * Full flow: generate authorization, store signature, and execute.
   * For server-side auto-execute flows where signing is handled internally.
   */
  async processProposalPayment(
    proposal: PaymentProposal,
    ownerAddress: string,
    signature?: string
  ): Promise<X402ExecutionResult> {
    try {
      // Generate authorization
      const authorization = await this.generateAuthorization(proposal, ownerAddress);

      if (signature) {
        // Store the provided signature
        await this.storeSignature(authorization.id, signature);
      } else {
        // In development, use a mock signature
        const mockSig = '0x' + randomBytes(65).toString('hex');
        await this.storeSignature(authorization.id, mockSig);
      }

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
    if (useDatabaseStorage) {
      try {
        const data = await prisma.x402Authorization.findUnique({
          where: { id: authorizationId }
        });

        if (!data) return null;

        return convertDbAuth(data);
      } catch {
        return null;
      }
    } else {
      return authorizationStore.get(authorizationId) || null;
    }
  }

  /**
   * Get authorization by proposal ID
   */
  async getAuthorizationByProposal(proposalId: string): Promise<X402Authorization | null> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.x402Authorization.findFirst({
          where: { proposal_id: proposalId },
          orderBy: { created_at: 'desc' }
        });

        if (!data) return null;

        return convertDbAuth(data);
      } catch {
        return null;
      }
    } else {
      for (const auth of authorizationStore.values()) {
        if (auth.proposal_id === proposalId) {
          return auth;
        }
      }
      return null;
    }
  }

  /**
   * Get all authorizations for an owner
   */
  async listByOwner(ownerAddress: string, limit: number = 50): Promise<X402Authorization[]> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.x402Authorization.findMany({
          where: { from_address: ownerAddress.toLowerCase() },
          orderBy: { created_at: 'desc' },
          take: limit
        });

        return data.map(convertDbAuth);
      } catch {
        return [];
      }
    } else {
      const results: X402Authorization[] = [];
      for (const auth of authorizationStore.values()) {
        if (auth.from_address === ownerAddress.toLowerCase()) {
          results.push(auth);
        }
      }
      return results
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    }
  }

  /**
   * Expire all stale authorizations
   */
  async expireStaleAuthorizations(): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const result = await prisma.x402Authorization.updateMany({
          where: {
            status: { in: ['pending', 'signed'] },
            valid_before: { lt: new Date() }
          },
          data: {
            status: 'expired'
          }
        });

        return result.count;
      } catch {
        return 0;
      }
    } else {
      let count = 0;
      const now = new Date();
      for (const [id, auth] of authorizationStore.entries()) {
        if ((auth.status === 'pending' || auth.status === 'signed') && now > auth.valid_before) {
          auth.status = 'expired';
          authorizationStore.set(id, auth);
          count++;
        }
      }
      return count;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async updateAuthStatus(
    authorizationId: string,
    status: X402Authorization['status']
  ): Promise<void> {
    if (useDatabaseStorage) {
      try {
        await prisma.x402Authorization.update({
          where: { id: authorizationId },
          data: { status }
        });
      } catch (error) {
        console.error('[x402 Service] Update status error:', error);
      }
    } else {
      const auth = authorizationStore.get(authorizationId);
      if (auth) {
        auth.status = status;
        auth.updated_at = new Date();
        authorizationStore.set(authorizationId, auth);
      }
    }
  }

  private async updateAuthCompleted(
    authorizationId: string,
    txHash: string
  ): Promise<void> {
    if (useDatabaseStorage) {
      try {
        await prisma.x402Authorization.update({
          where: { id: authorizationId },
          data: {
            status: 'completed',
            tx_hash: txHash,
          }
        });
      } catch (error) {
        console.error('[x402 Service] Update completed error:', error);
      }
    } else {
      const auth = authorizationStore.get(authorizationId);
      if (auth) {
        auth.status = 'completed';
        auth.tx_hash = txHash;
        auth.updated_at = new Date();
        authorizationStore.set(authorizationId, auth);
      }
    }
  }

  // ============================================
  // Test Helpers
  // ============================================

  _clearAll(): void {
    authorizationStore.clear();
  }

  _getCount(): number {
    return authorizationStore.size;
  }
}

// Export singleton instance
export const agentX402Service = new AgentX402Service();
