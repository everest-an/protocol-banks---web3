/**
 * Split Payment Service
 * Handles percentage-based payment distribution
 * Users can set custom percentages for each recipient
 */

import { prisma } from '@/lib/prisma';
import { publicBatchTransferService } from './public-batch-transfer-service';
import type { WalletClient, PublicClient } from 'viem';
import type {
  SplitRecipient,
  SplitTemplate,
  SplitExecution,
  SplitExecutionStatus,
  CreateSplitTemplateInput,
  UpdateSplitTemplateInput,
  ExecuteSplitInput,
  CalculateSplitResult,
  ExecuteSplitResult,
  validateSplitRecipients,
  calculateSplitAmounts,
} from '@/types';

// Re-export validation helpers
export { validateSplitRecipients, calculateSplitAmounts } from '@/types/split-payment';

// ============================================
// Split Payment Service Class
// ============================================

export class SplitPaymentService {
  private mapTemplate(t: any): SplitTemplate {
    if (!t) return null as any;
    return {
        ...t,
        recipients: t.recipients as any,
        created_at: t.created_at.toISOString(),
        updated_at: t.updated_at.toISOString()
    };
  }

  // ============================================
  // Calculation
  // ============================================

  /**
   * Calculate split amounts and validate percentages
   */
  calculateSplit(
    totalAmount: string,
    recipients: SplitRecipient[]
  ): CalculateSplitResult {
    const { validateSplitRecipients, calculateSplitAmounts } = require('@/types/split-payment');

    const validation = validateSplitRecipients(recipients);
    const calculatedRecipients = calculateSplitAmounts(totalAmount, recipients);

    return {
      total_amount: totalAmount,
      recipients: calculatedRecipients,
      validation,
    };
  }

  // ============================================
  // Template CRUD Operations
  // ============================================

  /**
   * Create a new split template
   */
  async createTemplate(
    ownerAddress: string,
    input: CreateSplitTemplateInput
  ): Promise<SplitTemplate> {
    // Validate recipients
    const { validateSplitRecipients } = require('@/types/split-payment');
    const validation = validateSplitRecipients(input.recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    const template = await prisma.paymentSplitTemplate.create({
      data: {
        owner_address: ownerAddress,
        team_id: input.team_id,
        name: input.name,
        description: input.description,
        recipients: input.recipients as any,
      }
    });

    return this.mapTemplate(template);
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<SplitTemplate | null> {
    const template = await prisma.paymentSplitTemplate.findUnique({
        where: { id: templateId }
    });
    return this.mapTemplate(template);
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    ownerAddress: string,
    input: UpdateSplitTemplateInput
  ): Promise<SplitTemplate> {
    // Validate recipients if provided
    if (input.recipients) {
      const { validateSplitRecipients } = require('@/types/split-payment');
      const validation = validateSplitRecipients(input.recipients);
      if (!validation.is_valid) {
        throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
      }
    }

    const updated = await prisma.paymentSplitTemplate.update({
        where: { id: templateId },
        data: {
             ...input,
             recipients: input.recipients as any,
             updated_at: new Date()
        }
    });

    return this.mapTemplate(updated);
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await prisma.paymentSplitTemplate.delete({
        where: { id: templateId }
    });
  }

  /**
   * List templates for user
   */
  async listTemplates(
    ownerAddress: string,
    teamId?: string
  ): Promise<SplitTemplate[]> {
    const where: any = {
        is_active: true
    };
    if (teamId) {
        where.OR = [
            { owner_address: ownerAddress },
            { team_id: teamId }
        ];
    } else {
        where.owner_address = ownerAddress;
    }

    const templates = await prisma.paymentSplitTemplate.findMany({
        where,
        orderBy: { created_at: 'desc' }
    });

    return templates.map(t => this.mapTemplate(t));
  }

  // ============================================
  // API-Compatible Methods
  // ============================================

  /**
   * Create a split execution record (API route compatible)
   * This is a simplified method that records the split intent
   * The actual execution with wallet signing happens client-side
   */
  async createSplitExecution(input: {
    owner_address: string;
    template_id?: string;
    team_id?: string;
    total_amount: string;
    token: string;
    chain_id: number;
    recipients: SplitRecipient[];
  }): Promise<SplitExecution> {
    // Validate recipients
    const { validateSplitRecipients, calculateSplitAmounts } = require('@/types/split-payment');
    const validation = validateSplitRecipients(input.recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    // Calculate amounts
    const calculatedRecipients = calculateSplitAmounts(input.total_amount, input.recipients);

    // Create execution record
    const execution = await prisma.paymentSplitExecution.create({
      data: {
        owner_address: input.owner_address,
        template_id: input.template_id,
        team_id: input.team_id,
        total_amount: input.total_amount,
        token: input.token,
        chain_id: input.chain_id,
        recipients: calculatedRecipients as any,
        status: 'pending',
      }
    });

    return {
        ...execution,
        recipients: execution.recipients as any,
        created_at: execution.created_at.toISOString(),
        updated_at: execution.updated_at.toISOString()
    };
  }

  // ============================================
  // Execution
  // ============================================

  /**
   * Execute a split payment
   */
  async executeSplit(
    walletClient: WalletClient,
    publicClient: PublicClient,
    ownerAddress: string,
    input: ExecuteSplitInput
  ): Promise<ExecuteSplitResult> {
    let recipients = input.recipients;

    // If template_id is provided, load template recipients
    if (input.template_id) {
      const template = await this.getTemplate(input.template_id);
      if (!template) {
        throw new Error('Template not found');
      }
      recipients = template.recipients;
    }

    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients provided');
    }

    // Calculate amounts
    const { calculateSplitAmounts, validateSplitRecipients } = require('@/types/split-payment');
    const validation = validateSplitRecipients(recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    const calculatedRecipients = calculateSplitAmounts(input.total_amount, recipients);

    // Create execution record
    const execution = await prisma.paymentSplitExecution.create({
      data: {
        template_id: input.template_id,
        owner_address: ownerAddress,
        total_amount: input.total_amount,
        token: input.token,
        chain_id: input.chain_id || 42161,
        recipients: calculatedRecipients as any,
        status: 'processing',
      }
    });

    try {
      // Convert to batch transfer format
      const batchRecipients = calculatedRecipients.map((r: SplitRecipient) => ({
        address: r.address as `0x${string}`,
        amount: r.calculatedAmount || '0',
      }));

      // Execute batch transfer
      const result = await publicBatchTransferService.batchTransfer(
        walletClient,
        publicClient,
        batchRecipients,
        input.token,
        input.chain_id || 42161
      );

      // Update execution record
      const updateData: any = {
        status: result.success ? 'completed' : 'failed',
        updated_at: new Date()
      };

      if (result.txHash) {
        updateData.tx_hash = result.txHash;
      }

      if (result.errorMessage) {
        updateData.error_message = result.errorMessage;
      }

      await prisma.paymentSplitExecution.update({
          where: { id: execution.id },
          data: updateData
      });

      return {
        success: result.success,
        execution_id: execution.id,
        tx_hash: result.txHash,
        recipients_count: calculatedRecipients.length,
        total_amount: input.total_amount,
        error_message: result.errorMessage,
      };
    } catch (error: any) {
      // Update execution as failed
      await prisma.paymentSplitExecution.update({
          where: { id: execution.id },
          data: {
              status: 'failed',
              error_message: error.message
          }
      });

      return {
        success: false,
        execution_id: execution.id,
        recipients_count: calculatedRecipients.length,
        total_amount: input.total_amount,
        error_message: error.message,
      };
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    ownerAddress: string,
    options?: {
      templateId?: string;
      status?: SplitExecutionStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<SplitExecution[]> {
      const where: any = { owner_address: ownerAddress };
      if (options?.templateId) where.template_id = options.templateId;
      if (options?.status) where.status = options.status;

      const executions = await prisma.paymentSplitExecution.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: options?.limit,
          skip: options?.offset
      });

      return executions.map(e => ({
          ...e,
          recipients: e.recipients as any,
          created_at: e.created_at.toISOString(),
          updated_at: e.updated_at.toISOString()
      }));
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<SplitExecution | null> {
    const execution = await prisma.paymentSplitExecution.findUnique({
        where: { id: executionId }
    });

    if (!execution) return null;

    return {
        ...execution,
        recipients: execution.recipients as any,
        created_at: execution.created_at.toISOString(),
        updated_at: execution.updated_at.toISOString()
    };
  }
}

// Export singleton instance
export const splitPaymentService = new SplitPaymentService();
