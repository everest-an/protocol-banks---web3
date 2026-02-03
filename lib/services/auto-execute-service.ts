/**
 * Auto-Execute Service
 *
 * Handles automatic approval and execution of proposals within budget.
 * Checks rules, budget limits, and executes payments via x402 protocol
 * or the Go payout engine.
 *
 * Execution paths:
 * 1. x402 + Relayer: For ERC-3009 gasless USDC transfers (preferred)
 * 2. Payout Bridge: For batch payments via Go payout engine or TS fallback
 *
 * @module lib/services/auto-execute-service
 */

import { PaymentProposal, proposalService } from './proposal-service';
import { budgetService } from './budget-service';
import { agentService, Agent, AutoExecuteRules } from './agent-service';
import { agentX402Service } from './agent-x402-service';
import { agentActivityService } from './agent-activity-service';
import { notificationService } from './notification-service';
import { isRelayerConfigured } from './relayer-service';
import { isERC3009Supported } from '@/lib/erc3009';
import { submitBatchPayment } from '@/lib/grpc/payout-bridge';
import { getTokenAddress, CHAIN_IDS } from '@/lib/web3';

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

    // Check daily spending limit
    if (agent.auto_execute_rules) {
      const withinDailyLimit = await this.checkDailyLimit(
        proposal.agent_id,
        agent.auto_execute_rules
      );
      if (!withinDailyLimit) {
        this.notifyManualApprovalNeeded(proposal, agent.name, 'Daily spending limit reached');
        return {
          auto_executed: false,
          reason: 'Daily spending limit reached',
          proposal,
        };
      }
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

    // Execute payment: try x402/relayer first, then payout bridge
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

      // Log activity
      agentActivityService.log(
        proposal.agent_id,
        proposal.owner_address,
        'payment_executed',
        {
          proposal_id: proposal.id,
          amount: proposal.amount,
          token: proposal.token,
          recipient_address: proposal.recipient_address,
          tx_hash: txHash,
          auto_executed: true,
          agent_name: agent.name,
        }
      ).catch(err => console.error('[AutoExecute] Activity log failed:', err));

      return {
        auto_executed: true,
        proposal: executedProposal,
        tx_hash: txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Execution failed';

      const failedProposal = await proposalService.markFailed(
        proposal.id,
        errorMessage,
        agent.name
      );

      // Log failure
      agentActivityService.log(
        proposal.agent_id,
        proposal.owner_address,
        'payment_failed',
        {
          proposal_id: proposal.id,
          amount: proposal.amount,
          token: proposal.token,
          error: errorMessage,
          auto_executed: true,
        }
      ).catch(err => console.error('[AutoExecute] Activity log failed:', err));

      return {
        auto_executed: false,
        reason: errorMessage,
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
   * Execute payment - tries x402/relayer for gasless transfers, falls back to payout bridge.
   *
   * Execution strategy:
   * 1. If ERC-3009 is supported for the token+chain AND relayer is configured → use x402 service
   * 2. Otherwise → use the payout bridge (Go engine or TS fallback)
   */
  private async executePayment(proposal: PaymentProposal): Promise<string> {
    const chainId = proposal.chain_id || CHAIN_IDS.BASE;
    const token = proposal.token || 'USDC';

    // Strategy 1: x402 + Relayer for gasless ERC-3009 transfers
    if (isERC3009Supported(chainId, token) && isRelayerConfigured()) {
      try {
        return await this.executeViaX402(proposal);
      } catch (error) {
        console.warn('[AutoExecute] x402 execution failed, falling back to payout bridge:', error);
        // Fall through to payout bridge
      }
    }

    // Strategy 2: Payout bridge (Go engine or TypeScript fallback)
    return await this.executeViaPayout(proposal);
  }

  /**
   * Execute via x402 protocol + relayer (gasless ERC-3009)
   */
  private async executeViaX402(proposal: PaymentProposal): Promise<string> {
    console.log(`[AutoExecute] Executing via x402 for proposal ${proposal.id}`);

    // Generate authorization and execute via the x402 service
    const result = await agentX402Service.processProposalPayment(
      proposal,
      proposal.owner_address
    );

    if (!result.success) {
      throw new Error(result.error || 'x402 execution failed');
    }

    return result.tx_hash || '';
  }

  /**
   * Execute via payout bridge (Go engine or TypeScript fallback)
   */
  private async executeViaPayout(proposal: PaymentProposal): Promise<string> {
    const chainId = proposal.chain_id || CHAIN_IDS.BASE;
    const token = proposal.token || 'USDC';

    const tokenAddress = getTokenAddress(chainId, token);
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    }

    console.log(`[AutoExecute] Executing via payout bridge for proposal ${proposal.id}`);

    try {
      const result = await submitBatchPayment(
        proposal.owner_address,
        proposal.owner_address,
        [
          {
            address: proposal.recipient_address,
            amount: proposal.amount,
            token: tokenAddress,
            chainId,
            vendorName: proposal.reason,
          },
        ],
        {
          priority: 'high',
        }
      );

      if (result.status === 'failed') {
        throw new Error(result.transactions[0]?.error || 'Payment execution failed');
      }

      return result.transactions[0]?.txHash || result.batchId;
    } catch (error) {
      console.error('[AutoExecute] Payout bridge execution failed:', error);
      throw error;
    }
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
