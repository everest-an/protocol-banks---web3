/**
 * Auto-Execute Service
 * 
 * Handles automatic approval and execution of proposals within budget.
 * Checks rules, budget limits, and executes payments via x402 protocol.
 * 
 * @module lib/services/auto-execute-service
 */

import { PaymentProposal, proposalService } from './proposal-service';
import { budgetService } from './budget-service';
import { agentService, Agent, AutoExecuteRules } from './agent-service';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export interface AutoExecuteResult {
  auto_executed: boolean;
  reason?: string;
  proposal: PaymentProposal;
  tx_hash?: string;
}

export interface RuleCheckResult {
  passed: boolean;
  violations: string[];
}

// ============================================
// Auto-Execute Service
// ============================================

export class AutoExecuteService {
  /**
   * Process a proposal for auto-execution
   */
  async processProposal(proposal: PaymentProposal): Promise<AutoExecuteResult> {
    // Get agent
    const agent = await agentService.getById(proposal.agent_id);
    if (!agent) {
      return {
        auto_executed: false,
        reason: 'Agent not found',
        proposal,
      };
    }

    // Check if auto-execute is enabled
    if (!agent.auto_execute_enabled) {
      // Notify owner that manual approval is needed
      this.notifyManualApprovalNeeded(proposal, agent.name, 'Auto-execute is disabled');
      return {
        auto_executed: false,
        reason: 'Auto-execute is disabled for this agent',
        proposal,
      };
    }

    // Check if agent is active
    if (agent.status !== 'active') {
      return {
        auto_executed: false,
        reason: `Agent is ${agent.status}`,
        proposal,
      };
    }

    // Check rules
    const ruleCheck = await this.checkRules(agent, proposal);
    if (!ruleCheck.passed) {
      // Notify owner that manual approval is needed due to rule violations
      this.notifyManualApprovalNeeded(
        proposal, 
        agent.name, 
        `Rule violations: ${ruleCheck.violations.join(', ')}`
      );
      return {
        auto_executed: false,
        reason: `Rule violations: ${ruleCheck.violations.join(', ')}`,
        proposal,
      };
    }

    // Check budget
    const withinBudget = await this.isWithinBudget(
      proposal.agent_id,
      proposal.amount,
      proposal.token,
      proposal.chain_id
    );

    if (!withinBudget) {
      // Notify owner that manual approval is needed due to budget
      this.notifyManualApprovalNeeded(proposal, agent.name, 'Insufficient budget');
      return {
        auto_executed: false,
        reason: 'Insufficient budget for auto-execution',
        proposal,
      };
    }

    // Auto-approve the proposal
    await proposalService.approve(
      proposal.id,
      proposal.owner_address,
      agent.name
    );

    // Deduct from budget if budget_id is set
    if (proposal.budget_id) {
      try {
        await budgetService.deductBudget(proposal.budget_id, proposal.amount);
      } catch (error) {
        // Revert approval if budget deduction fails
        await proposalService.reject(
          proposal.id,
          proposal.owner_address,
          'Budget deduction failed',
          agent.name
        );
        return {
          auto_executed: false,
          reason: 'Budget deduction failed',
          proposal,
        };
      }
    }

    // Start execution
    const executingProposal = await proposalService.startExecution(proposal.id);

    // Execute via x402 (simulated for now)
    try {
      const txHash = await this.executePayment(executingProposal);
      
      // Mark as executed with auto-execute flag for notification
      const executedProposal = await proposalService.markExecuted(
        proposal.id,
        txHash,
        undefined,
        agent.name,
        true // auto-executed
      );

      return {
        auto_executed: true,
        proposal: executedProposal,
        tx_hash: txHash,
      };
    } catch (error) {
      const failedProposal = await proposalService.markFailed(
        proposal.id,
        error instanceof Error ? error.message : 'Execution failed',
        agent.name
      );

      return {
        auto_executed: false,
        reason: error instanceof Error ? error.message : 'Execution failed',
        proposal: failedProposal,
      };
    }
  }

  /**
   * Send notification when manual approval is needed
   */
  private notifyManualApprovalNeeded(
    proposal: PaymentProposal,
    agentName: string,
    reason: string
  ): void {
    // Send notification asynchronously (don't block)
    notificationService.notifyAgentProposalCreated(
      proposal.owner_address,
      agentName,
      proposal.amount,
      proposal.token,
      proposal.recipient_address,
      `${proposal.reason} (Manual approval needed: ${reason})`,
      proposal.id
    ).catch(err => {
      console.error('[AutoExecuteService] Failed to send notification:', err);
    });
  }

  /**
   * Check if proposal passes auto-execute rules
   */
  async checkRules(agent: Agent, proposal: PaymentProposal): Promise<RuleCheckResult> {
    const violations: string[] = [];
    const rules = agent.auto_execute_rules;

    if (!rules) {
      // No rules configured, allow all
      return { passed: true, violations: [] };
    }

    // Check max single amount
    if (rules.max_single_amount) {
      const maxAmount = parseFloat(rules.max_single_amount);
      const proposalAmount = parseFloat(proposal.amount);
      if (proposalAmount > maxAmount) {
        violations.push(`Amount ${proposal.amount} exceeds max single amount ${rules.max_single_amount}`);
      }
    }

    // Check allowed tokens
    if (rules.allowed_tokens && rules.allowed_tokens.length > 0) {
      const normalizedToken = proposal.token.toUpperCase();
      const allowedTokens = rules.allowed_tokens.map(t => t.toUpperCase());
      if (!allowedTokens.includes(normalizedToken)) {
        violations.push(`Token ${proposal.token} is not in allowed tokens: ${rules.allowed_tokens.join(', ')}`);
      }
    }

    // Check allowed recipients (whitelist)
    if (rules.allowed_recipients && rules.allowed_recipients.length > 0) {
      const normalizedRecipient = proposal.recipient_address.toLowerCase();
      const allowedRecipients = rules.allowed_recipients.map(r => r.toLowerCase());
      if (!allowedRecipients.includes(normalizedRecipient)) {
        violations.push(`Recipient ${proposal.recipient_address} is not in whitelist`);
      }
    }

    // Check allowed chains
    if (rules.allowed_chains && rules.allowed_chains.length > 0) {
      if (!rules.allowed_chains.includes(proposal.chain_id)) {
        violations.push(`Chain ${proposal.chain_id} is not in allowed chains: ${rules.allowed_chains.join(', ')}`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Check if agent has sufficient budget for the payment
   */
  async isWithinBudget(
    agentId: string,
    amount: string,
    token: string,
    chainId?: number
  ): Promise<boolean> {
    const availability = await budgetService.checkAvailability(
      agentId,
      amount,
      token,
      chainId
    );
    return availability.available;
  }

  /**
   * Execute payment via x402 protocol (simulated)
   * In production, this would call the actual x402 service
   */
  private async executePayment(proposal: PaymentProposal): Promise<string> {
    // Simulate x402 execution
    // In production, this would:
    // 1. Generate x402 authorization
    // 2. Submit to x402 relayer
    // 3. Wait for transaction confirmation
    // 4. Return transaction hash

    // For now, generate a mock transaction hash
    const txHash = `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    return txHash;
  }

  /**
   * Check daily spending limit
   */
  async checkDailyLimit(agentId: string, rules: AutoExecuteRules): Promise<boolean> {
    if (!rules.max_daily_amount) {
      return true;
    }

    // Get today's executed proposals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const proposals = await proposalService.listByAgent(agentId, {
      status: 'executed',
      startDate: today,
    });

    // Sum up today's spending
    let totalSpent = 0;
    for (const p of proposals) {
      totalSpent += parseFloat(p.amount);
    }

    const maxDaily = parseFloat(rules.max_daily_amount);
    return totalSpent < maxDaily;
  }
}

// Export singleton instance
export const autoExecuteService = new AutoExecuteService();
