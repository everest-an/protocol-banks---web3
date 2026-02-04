/**
 * Proposal Service
 *
 * Handles payment proposals from AI agents.
 * Supports proposal lifecycle: pending → approved/rejected → executing → executed/failed
 *
 * @module lib/services/proposal-service
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed';

export interface PaymentProposal {
  id: string;
  agent_id: string;
  owner_address: string;
  recipient_address: string;
  amount: string;
  token: string;
  chain_id: number;
  reason: string;
  metadata?: Record<string, any>;
  status: ProposalStatus;
  rejection_reason?: string;
  budget_id?: string;
  x402_authorization_id?: string;
  tx_hash?: string;
  created_at: Date;
  updated_at: Date;
  approved_at?: Date;
  executed_at?: Date;
}

export interface CreateProposalInput {
  agent_id: string;
  agent_name?: string; // For notification purposes
  owner_address: string;
  recipient_address: string;
  amount: string;
  token: string;
  chain_id: number;
  reason: string;
  metadata?: Record<string, any>;
  budget_id?: string;
}

export interface ProposalFilters {
  status?: ProposalStatus;
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['executing', 'rejected'],
  rejected: [],
  executing: ['executed', 'failed'],
  executed: [],
  failed: ['pending'], // Allow retry
};

// ============================================
// In-Memory Store (for testing/development)
// ============================================

const proposalStore = new Map<string, PaymentProposal>();

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

// ============================================
// Helper Functions
// ============================================

function isValidTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function convertDbProposal(data: any): PaymentProposal {
  return {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    approved_at: data.approved_at ? new Date(data.approved_at) : undefined,
    executed_at: data.executed_at ? new Date(data.executed_at) : undefined,
  };
}

function validateProposalInput(input: CreateProposalInput): void {
  if (!input.agent_id) {
    throw new Error('agent_id is required');
  }
  if (!input.owner_address) {
    throw new Error('owner_address is required');
  }
  if (!input.recipient_address) {
    throw new Error('recipient_address is required');
  }
  if (!input.amount) {
    throw new Error('amount is required');
  }
  if (!input.token) {
    throw new Error('token is required');
  }
  if (input.chain_id === undefined || input.chain_id === null) {
    throw new Error('chain_id is required');
  }
  if (!input.reason) {
    throw new Error('reason is required');
  }

  // Validate amount is positive
  const amount = parseFloat(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  // Validate recipient address format (basic check)
  if (!input.recipient_address.startsWith('0x') || input.recipient_address.length !== 42) {
    throw new Error('recipient_address must be a valid Ethereum address');
  }
}

// ============================================
// Proposal Service
// ============================================

export class ProposalService {
  /**
   * Create a new payment proposal
   */
  async create(input: CreateProposalInput): Promise<PaymentProposal> {
    validateProposalInput(input);

    const proposalData = {
      agent_id: input.agent_id,
      owner_address: input.owner_address.toLowerCase(),
      recipient_address: input.recipient_address.toLowerCase(),
      amount: input.amount,
      token: input.token.toUpperCase(),
      chain_id: input.chain_id,
      reason: input.reason,
      metadata: input.metadata,
      status: 'pending' as ProposalStatus,
      budget_id: input.budget_id,
    };

    let proposal: PaymentProposal;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.create({
          data: {
            agent_id: input.agent_id,
            owner_address: input.owner_address.toLowerCase(),
            recipient_address: input.recipient_address.toLowerCase(),
            amount: input.amount,
            token: input.token.toUpperCase(),
            chain_id: input.chain_id,
            reason: input.reason,
            metadata: input.metadata || undefined,
            status: 'pending',
            budget_id: input.budget_id,
          }
        });

        proposal = {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to create proposal:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const now = new Date();
      proposal = {
        id: randomUUID(),
        ...proposalData,
        created_at: now,
        updated_at: now,
      };

      proposalStore.set(proposal.id, proposal);
    }

    // Send notification to owner (async, don't block)
    this.sendProposalCreatedNotification(
      proposal,
      input.agent_name || 'AI Agent'
    ).catch(err => {
      console.error('[ProposalService] Failed to send notification:', err);
    });

    return proposal;
  }

  /**
   * Send notification when proposal is created
   */
  private async sendProposalCreatedNotification(
    proposal: PaymentProposal,
    agentName: string
  ): Promise<void> {
    try {
      await notificationService.notifyAgentProposalCreated(
        proposal.owner_address,
        agentName,
        proposal.amount,
        proposal.token,
        proposal.recipient_address,
        proposal.reason,
        proposal.id
      );
    } catch (err) {
      // Log but don't throw - notifications shouldn't break the main flow
      console.error('[ProposalService] Notification error:', err);
    }
  }

  /**
   * Create multiple proposals in batch
   */
  async createBatch(inputs: CreateProposalInput[]): Promise<PaymentProposal[]> {
    if (!inputs || inputs.length === 0) {
      throw new Error('At least one proposal input is required');
    }

    if (inputs.length > 100) {
      throw new Error('Maximum 100 proposals per batch');
    }

    const proposals: PaymentProposal[] = [];
    
    for (const input of inputs) {
      const proposal = await this.create(input);
      proposals.push(proposal);
    }

    return proposals;
  }

  /**
   * List proposals for an owner
   */
  async list(ownerAddress: string, filters?: ProposalFilters): Promise<PaymentProposal[]> {
    const normalizedOwner = ownerAddress.toLowerCase();

    if (useDatabaseStorage) {
      try {
        const where: any = {
            owner_address: normalizedOwner
        };

        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.agentId) {
            where.agent_id = filters.agentId;
        }
        if (filters?.startDate) {
            where.created_at = { gte: filters.startDate };
        }
        if (filters?.endDate) {
            where.created_at = { lte: filters.endDate };
        }

        const data = await prisma.paymentProposal.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: filters?.offset || 0,
            take: filters?.limit || 50
        });

        return data.map(d => ({
            ...d,
            reason: d.reason || "",
            status: d.status as ProposalStatus,
            metadata: (d.metadata as Record<string, any>) || undefined,
            created_at: d.created_at,
            updated_at: d.updated_at,
            approved_at: d.approved_at || undefined,
            executed_at: d.executed_at || undefined
        }));
      } catch (error) {
        console.error('[Proposal Service] Failed to list proposals:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let proposals: PaymentProposal[] = [];

      for (const proposal of proposalStore.values()) {
        if (proposal.owner_address === normalizedOwner) {
          proposals.push(proposal);
        }
      }

      // Apply filters
      if (filters?.status) {
        proposals = proposals.filter((p) => p.status === filters.status);
      }
      if (filters?.agentId) {
        proposals = proposals.filter((p) => p.agent_id === filters.agentId);
      }
      if (filters?.startDate) {
        proposals = proposals.filter((p) => p.created_at >= filters.startDate!);
      }
      if (filters?.endDate) {
        proposals = proposals.filter((p) => p.created_at <= filters.endDate!);
      }

      // Sort by created_at descending
      proposals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply pagination
      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? 50;
      proposals = proposals.slice(offset, offset + limit);

      return proposals;
    }
  }

  /**
   * List proposals by agent
   */
  async listByAgent(agentId: string, filters?: ProposalFilters): Promise<PaymentProposal[]> {
    if (useDatabaseStorage) {
      try {
        const where: any = {
            agent_id: agentId
        };

        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.startDate) {
            where.created_at = { gte: filters.startDate };
        }
        if (filters?.endDate) {
            where.created_at = { lte: filters.endDate };
        }

        const data = await prisma.paymentProposal.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: filters?.offset || 0,
            take: filters?.limit || 50
        });

        return data.map(d => ({
            ...d,
            reason: d.reason || "",
            status: d.status as ProposalStatus,
            metadata: (d.metadata as Record<string, any>) || undefined,
            created_at: d.created_at,
            updated_at: d.updated_at,
            approved_at: d.approved_at || undefined,
            executed_at: d.executed_at || undefined
        }));
      } catch (error) {
        console.error('[Proposal Service] Failed to list proposals by agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let proposals: PaymentProposal[] = [];

      for (const proposal of proposalStore.values()) {
        if (proposal.agent_id === agentId) {
          proposals.push(proposal);
        }
      }

      // Apply filters
      if (filters?.status) {
        proposals = proposals.filter((p) => p.status === filters.status);
      }
      if (filters?.startDate) {
        proposals = proposals.filter((p) => p.created_at >= filters.startDate!);
      }
      if (filters?.endDate) {
        proposals = proposals.filter((p) => p.created_at <= filters.endDate!);
      }

      // Sort by created_at descending
      proposals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply pagination
      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? 50;
      proposals = proposals.slice(offset, offset + limit);

      return proposals;
    }
  }

  /**
   * Get a proposal by ID
   */
  async get(proposalId: string): Promise<PaymentProposal | null> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.findUnique({
             where: { id: proposalId }
        });

        if (!data) return null;

        return {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to get proposal:', error);
        return null;
      }
    } else {
      // Fallback to in-memory storage
      return proposalStore.get(proposalId) ?? null;
    }
  }

  /**
   * Approve a proposal
   */
  async approve(proposalId: string, ownerAddress: string, agentName?: string): Promise<PaymentProposal> {
    const proposal = await this.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.owner_address !== ownerAddress.toLowerCase()) {
      throw new Error('Unauthorized: You do not own this proposal');
    }

    if (!isValidTransition(proposal.status, 'approved')) {
      throw new Error(`Invalid state transition: Cannot approve proposal in ${proposal.status} status`);
    }

    const now = new Date();
    const updates = {
      status: 'approved' as ProposalStatus,
      approved_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    let updatedProposal: PaymentProposal;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.update({
             where: {
                 id: proposalId,
                 owner_address: ownerAddress.toLowerCase()
             },
             data: {
                 status: 'approved',
                 approved_at: new Date(),
                 updated_at: new Date()
             }
        });

        updatedProposal = {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to approve proposal:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      updatedProposal = {
        ...proposal,
        status: 'approved',
        approved_at: now,
        updated_at: now,
      };

      proposalStore.set(proposalId, updatedProposal);
    }

    // Send notification (async, don't block)
    notificationService
      .notifyAgentProposalApproved(
        proposal.owner_address,
        agentName || 'AI Agent',
        proposal.amount,
        proposal.token,
        proposal.id
      )
      .catch((err) => {
        console.error('[ProposalService] Failed to send approval notification:', err);
      });

    return updatedProposal;
  }

  /**
   * Reject a proposal
   */
  async reject(proposalId: string, ownerAddress: string, reason?: string, agentName?: string): Promise<PaymentProposal> {
    const proposal = await this.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.owner_address !== ownerAddress.toLowerCase()) {
      throw new Error('Unauthorized: You do not own this proposal');
    }

    if (!isValidTransition(proposal.status, 'rejected')) {
      throw new Error(`Invalid state transition: Cannot reject proposal in ${proposal.status} status`);
    }

    const now = new Date();
    const updates = {
      status: 'rejected' as ProposalStatus,
      rejection_reason: reason,
      updated_at: now.toISOString(),
    };

    let updatedProposal: PaymentProposal;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.update({
             where: {
                 id: proposalId,
                 owner_address: ownerAddress.toLowerCase()
             },
             data: {
                 status: 'rejected',
                 rejection_reason: reason,
                 updated_at: new Date()
             }
        });

        updatedProposal = {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to reject proposal:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      updatedProposal = {
        ...proposal,
        status: 'rejected',
        rejection_reason: reason,
        updated_at: now,
      };

      proposalStore.set(proposalId, updatedProposal);
    }

    // Send notification (async, don't block)
    notificationService
      .notifyAgentProposalRejected(
        proposal.owner_address,
        agentName || 'AI Agent',
        proposal.amount,
        proposal.token,
        proposal.id,
        reason
      )
      .catch((err) => {
        console.error('[ProposalService] Failed to send rejection notification:', err);
      });

    return updatedProposal;
  }

  /**
   * Start executing a proposal
   */
  async startExecution(proposalId: string): Promise<PaymentProposal> {
    const proposal = await this.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!isValidTransition(proposal.status, 'executing')) {
      throw new Error(`Invalid state transition: Cannot execute proposal in ${proposal.status} status`);
    }

    const now = new Date();

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.update({
             where: { id: proposalId },
             data: {
                 status: 'executing',
                 updated_at: new Date()
             }
        });

        return {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Start execution error:', error);
        throw new Error(`Failed to start execution`);
      }
    } else {
      // Fallback to in-memory storage
      const updatedProposal: PaymentProposal = {
        ...proposal,
        status: 'executing',
        updated_at: now,
      };

      proposalStore.set(proposalId, updatedProposal);
      return updatedProposal;
    }
  }

  /**
   * Mark proposal as executed
   */
  async markExecuted(
    proposalId: string,
    txHash: string,
    x402AuthId?: string,
    agentName?: string,
    autoExecuted: boolean = false
  ): Promise<PaymentProposal> {
    const proposal = await this.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!isValidTransition(proposal.status, 'executed')) {
      throw new Error(`Invalid state transition: Cannot mark as executed from ${proposal.status} status`);
    }

    const now = new Date();

    let updatedProposal: PaymentProposal;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.update({
             where: { id: proposalId },
             data: {
                 status: 'executed',
                 tx_hash: txHash,
                 x402_authorization_id: x402AuthId,
                 executed_at: new Date(),
                 updated_at: new Date()
             }
        });

        updatedProposal = {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to mark as executed:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      updatedProposal = {
        ...proposal,
        status: 'executed',
        tx_hash: txHash,
        x402_authorization_id: x402AuthId,
        executed_at: now,
        updated_at: now,
      };

      proposalStore.set(proposalId, updatedProposal);
    }

    // Send notification (async, don't block)
    notificationService
      .notifyAgentPaymentExecuted(
        proposal.owner_address,
        agentName || 'AI Agent',
        proposal.amount,
        proposal.token,
        proposal.recipient_address,
        txHash,
        autoExecuted
      )
      .catch((err) => {
        console.error('[ProposalService] Failed to send execution notification:', err);
      });

    return updatedProposal;
  }

  /**
   * Mark proposal as failed
   */
  async markFailed(proposalId: string, reason?: string, agentName?: string): Promise<PaymentProposal> {
    const proposal = await this.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!isValidTransition(proposal.status, 'failed')) {
      throw new Error(`Invalid state transition: Cannot mark as failed from ${proposal.status} status`);
    }

    const now = new Date();

    let updatedProposal: PaymentProposal;

    if (useDatabaseStorage) {
      try {
        const data = await prisma.paymentProposal.update({
             where: { id: proposalId },
             data: {
                 status: 'failed',
                 rejection_reason: reason,
                 updated_at: new Date()
             }
        });

        updatedProposal = {
            ...data,
            reason: data.reason || "",
            status: data.status as ProposalStatus,
            metadata: (data.metadata as Record<string, any>) || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            approved_at: data.approved_at || undefined,
            executed_at: data.executed_at || undefined
        };
      } catch (error) {
        console.error('[Proposal Service] Failed to mark as failed:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      updatedProposal = {
        ...proposal,
        status: 'failed',
        rejection_reason: reason,
        updated_at: now,
      };

      proposalStore.set(proposalId, updatedProposal);
    }

    // Send notification (async, don't block)
    notificationService
      .notifyAgentPaymentFailed(
        proposal.owner_address,
        agentName || 'AI Agent',
        proposal.amount,
        proposal.token,
        proposal.recipient_address,
        reason || 'Unknown error',
        proposal.id
      )
      .catch((err) => {
        console.error('[ProposalService] Failed to send failure notification:', err);
      });

    return updatedProposal;
  }

  /**
   * Get count of pending proposals for an owner
   */
  async getPendingCount(ownerAddress: string): Promise<number> {
    const normalizedOwner = ownerAddress.toLowerCase();

    if (useDatabaseStorage) {
      try {
        const count = await prisma.paymentProposal.count({
            where: {
                owner_address: normalizedOwner,
                status: 'pending'
            }
        });
        return count;
      } catch (error) {
        console.error('[Proposal Service] Failed to get pending count:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let count = 0;

      for (const proposal of proposalStore.values()) {
        if (proposal.owner_address === normalizedOwner && proposal.status === 'pending') {
          count++;
        }
      }

      return count;
    }
  }

  /**
   * Clear all proposals (for testing)
   */
  _clearAll(): void {
    proposalStore.clear();
  }

  /**
   * Get proposal count (for testing)
   */
  _getCount(): number {
    return proposalStore.size;
  }
}

// Export singleton instance
export const proposalService = new ProposalService();
