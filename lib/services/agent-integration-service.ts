/**
 * Agent Integration Service
 * 
 * Wires all agent services together for the complete proposal lifecycle:
 * proposal → auto-execute → x402 → webhook → activity logging
 * 
 * @module lib/services/agent-integration-service
 */

import { proposalService, PaymentProposal } from './proposal-service';
import { autoExecuteService, AutoExecuteResult } from './auto-execute-service';
import { agentX402Service, X402ExecutionResult } from './agent-x402-service';
import { agentWebhookService, AgentWebhookEvent } from './agent-webhook-service';
import { agentActivityService, AgentAction } from './agent-activity-service';
import { agentService } from './agent-service';
import { budgetService } from './budget-service';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export interface ProposalLifecycleResult {
  proposal: PaymentProposal;
  auto_executed: boolean;
  x402_result?: X402ExecutionResult;
  webhook_delivered: boolean;
  activity_logged: boolean;
  error?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor_type: 'agent' | 'owner' | 'system';
  actor_id: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
}

// ============================================
// In-Memory Audit Log Store
// ============================================

const auditLogStore: AuditLogEntry[] = [];

// ============================================
// Agent Integration Service
// ============================================

export class AgentIntegrationService {
  /**
   * Process a new proposal through the complete lifecycle
   */
  async processNewProposal(
    proposalInput: {
      agent_id: string;
      owner_address: string;
      recipient_address: string;
      amount: string;
      token: string;
      chain_id: number;
      reason: string;
      budget_id?: string;
    }
  ): Promise<ProposalLifecycleResult> {
    let proposal: PaymentProposal | null = null;
    let webhookDelivered = false;
    let activityLogged = false;

    try {
      // 1. Create proposal
      proposal = await proposalService.create(proposalInput);
      
      // Log activity
      await this.logActivity(
        proposalInput.agent_id,
        proposalInput.owner_address,
        'proposal_created',
        {
          proposal_id: proposal.id,
          amount: proposalInput.amount,
          token: proposalInput.token,
          recipient: proposalInput.recipient_address,
        }
      );
      activityLogged = true;

      // Audit log
      await this.auditLog('proposal.created', 'agent', proposalInput.agent_id, 'proposal', proposal.id, {
        amount: proposalInput.amount,
        token: proposalInput.token,
      });

      // 2. Trigger webhook for proposal created
      const agent = await agentService.getById(proposalInput.agent_id);
      if (agent?.webhook_url) {
        // Generate a temporary webhook secret for delivery
        const webhookSecret = agent.webhook_secret_hash || 'default-secret';
        await agentWebhookService.trigger(
          agent.id,
          agent.webhook_url,
          webhookSecret,
          'proposal.created',
          {
            proposal_id: proposal.id,
            amount: proposalInput.amount,
            token: proposalInput.token,
            recipient: proposalInput.recipient_address,
            reason: proposalInput.reason,
          }
        );
        webhookDelivered = true;
      }

      // 3. Try auto-execute
      const autoResult = await autoExecuteService.processProposal(proposal);
      
      if (autoResult.auto_executed) {
        // Update proposal reference
        proposal = autoResult.proposal;

        // Log auto-execute activity
        await this.logActivity(
          proposalInput.agent_id,
          proposalInput.owner_address,
          'payment_executed',
          {
            proposal_id: proposal.id,
            tx_hash: autoResult.tx_hash,
            auto_executed: true,
          }
        );

        // Audit log
        await this.auditLog('payment.auto_executed', 'system', 'auto-execute', 'proposal', proposal.id, {
          tx_hash: autoResult.tx_hash,
        });

        // Trigger webhook for payment executed
        if (agent?.webhook_url) {
          const webhookSecret = agent.webhook_secret_hash || 'default-secret';
          await agentWebhookService.trigger(
            agent.id,
            agent.webhook_url,
            webhookSecret,
            'payment.executed',
            {
              proposal_id: proposal.id,
              tx_hash: autoResult.tx_hash,
              auto_executed: true,
            }
          );
        }

        return {
          proposal,
          auto_executed: true,
          x402_result: { success: true, tx_hash: autoResult.tx_hash },
          webhook_delivered: webhookDelivered,
          activity_logged: activityLogged,
        };
      }

      // Not auto-executed, return pending proposal
      return {
        proposal,
        auto_executed: false,
        webhook_delivered: webhookDelivered,
        activity_logged: activityLogged,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log error activity
      if (proposal) {
        await this.logActivity(
          proposalInput.agent_id,
          proposalInput.owner_address,
          'api_error',
          {
            proposal_id: proposal.id,
            error: errorMessage,
          }
        );
      }

      return {
        proposal: proposal!,
        auto_executed: false,
        webhook_delivered: webhookDelivered,
        activity_logged: activityLogged,
        error: errorMessage,
      };
    }
  }

  /**
   * Manually approve a proposal and execute payment
   */
  async approveAndExecute(
    proposalId: string,
    ownerAddress: string
  ): Promise<ProposalLifecycleResult> {
    let proposal: PaymentProposal | null = null;

    try {
      // 1. Get and approve proposal
      proposal = await proposalService.get(proposalId);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const agent = await agentService.getById(proposal.agent_id);
      const agentName = agent?.name || 'Unknown Agent';

      proposal = await proposalService.approve(proposalId, ownerAddress, agentName);

      // Log activity
      await this.logActivity(
        proposal.agent_id,
        ownerAddress,
        'proposal_approved',
        { proposal_id: proposalId }
      );

      // Audit log
      await this.auditLog('proposal.approved', 'owner', ownerAddress, 'proposal', proposalId, {});

      // Trigger webhook
      if (agent?.webhook_url) {
        const webhookSecret = agent.webhook_secret_hash || 'default-secret';
        await agentWebhookService.trigger(
          agent.id,
          agent.webhook_url,
          webhookSecret,
          'proposal.approved',
          { proposal_id: proposalId }
        );
      }

      // 2. Execute via x402
      proposal = await proposalService.startExecution(proposalId);
      
      const x402Result = await agentX402Service.processProposalPayment(proposal, ownerAddress);

      if (x402Result.success) {
        proposal = await proposalService.markExecuted(
          proposalId,
          x402Result.tx_hash!,
          undefined,
          agentName
        );

        // Deduct budget if applicable
        if (proposal.budget_id) {
          await budgetService.deductBudget(proposal.budget_id, proposal.amount);
        }

        // Log activity
        await this.logActivity(
          proposal.agent_id,
          ownerAddress,
          'payment_executed',
          {
            proposal_id: proposalId,
            tx_hash: x402Result.tx_hash,
            auto_executed: false,
          }
        );

        // Audit log
        await this.auditLog('payment.executed', 'owner', ownerAddress, 'proposal', proposalId, {
          tx_hash: x402Result.tx_hash,
        });

        // Trigger webhook
        if (agent?.webhook_url) {
          const webhookSecret = agent.webhook_secret_hash || 'default-secret';
          await agentWebhookService.trigger(
            agent.id,
            agent.webhook_url,
            webhookSecret,
            'payment.executed',
            {
              proposal_id: proposalId,
              tx_hash: x402Result.tx_hash,
            }
          );
        }

        // Send notification
        await notificationService.notifyAgentPaymentExecuted(
          ownerAddress,
          agentName,
          proposal.amount,
          proposal.token,
          proposal.recipient_address,
          x402Result.tx_hash!,
          false
        );

        return {
          proposal,
          auto_executed: false,
          x402_result: x402Result,
          webhook_delivered: true,
          activity_logged: true,
        };
      } else {
        // Execution failed
        proposal = await proposalService.markFailed(
          proposalId,
          x402Result.error || 'Execution failed',
          agentName
        );

        // Log activity
        await this.logActivity(
          proposal.agent_id,
          ownerAddress,
          'payment_failed',
          {
            proposal_id: proposalId,
            error: x402Result.error,
          }
        );

        // Trigger webhook
        if (agent?.webhook_url) {
          const webhookSecret = agent.webhook_secret_hash || 'default-secret';
          await agentWebhookService.trigger(
            agent.id,
            agent.webhook_url,
            webhookSecret,
            'payment.failed',
            {
              proposal_id: proposalId,
              error: x402Result.error,
            }
          );
        }

        return {
          proposal,
          auto_executed: false,
          x402_result: x402Result,
          webhook_delivered: true,
          activity_logged: true,
          error: x402Result.error,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        proposal: proposal!,
        auto_executed: false,
        webhook_delivered: false,
        activity_logged: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    proposalId: string,
    ownerAddress: string,
    reason: string
  ): Promise<PaymentProposal> {
    const proposal = await proposalService.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const agent = await agentService.getById(proposal.agent_id);
    const agentName = agent?.name || 'Unknown Agent';

    const rejectedProposal = await proposalService.reject(
      proposalId,
      ownerAddress,
      reason,
      agentName
    );

    // Log activity
    await this.logActivity(
      proposal.agent_id,
      ownerAddress,
      'proposal_rejected',
      { proposal_id: proposalId, reason }
    );

    // Audit log
    await this.auditLog('proposal.rejected', 'owner', ownerAddress, 'proposal', proposalId, { reason });

    // Trigger webhook
    if (agent?.webhook_url) {
      const webhookSecret = agent.webhook_secret_hash || 'default-secret';
      await agentWebhookService.trigger(
        agent.id,
        agent.webhook_url,
        webhookSecret,
        'proposal.rejected',
        { proposal_id: proposalId, reason }
      );
    }

    return rejectedProposal;
  }

  /**
   * Log agent activity
   */
  private async logActivity(
    agentId: string,
    ownerAddress: string,
    action: AgentAction,
    details: Record<string, unknown>
  ): Promise<void> {
    await agentActivityService.log(agentId, ownerAddress, action, details);
  }

  /**
   * Add audit log entry
   */
  async auditLog(
    action: string,
    actorType: 'agent' | 'owner' | 'system',
    actorId: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      actor_type: actorType,
      actor_id: actorId,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress,
    };

    auditLogStore.push(entry);
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters?: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let logs = [...auditLogStore];

    if (filters?.resourceType) {
      logs = logs.filter(l => l.resource_type === filters.resourceType);
    }
    if (filters?.resourceId) {
      logs = logs.filter(l => l.resource_id === filters.resourceId);
    }
    if (filters?.actorId) {
      logs = logs.filter(l => l.actor_id === filters.actorId);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  /**
   * Clear all data (for testing)
   */
  _clearAll(): void {
    auditLogStore.length = 0;
  }
}

// Export singleton instance
export const agentIntegrationService = new AgentIntegrationService();
