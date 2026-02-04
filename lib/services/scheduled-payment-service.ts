/**
 * Scheduled Payment Service
 * Handles automated payroll and recurring payments
 * Supports daily, weekly, bi-weekly, and monthly schedules
 */

import { prisma } from '@/lib/prisma';
import type {
  ScheduledPayment,
  ScheduledPaymentLog,
  ScheduledRecipient,
  ScheduleType,
  ScheduleConfig,
  ScheduledPaymentStatus,
  ExecutionStatus,
  CreateScheduledPaymentInput,
  UpdateScheduledPaymentInput,
  ScheduledPaymentWithLogs,
  ExecuteScheduledResult,
  CronExecutionSummary,
  calculateNextExecution,
  getScheduleDescription,
} from '@/types';

// Re-export helpers
export { calculateNextExecution, getScheduleDescription } from '@/types/scheduled-payment';

// ============================================
// Scheduled Payment Service Class
// ============================================

export class ScheduledPaymentService {
  constructor() {}

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new scheduled payment
   */
  async create(
    ownerAddress: string,
    input: CreateScheduledPaymentInput
  ): Promise<ScheduledPayment> {
    // Validate recipients
    if (!input.recipients || input.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Calculate first execution date
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const nextExecution = calculateNextExecution(
      input.schedule_type,
      input.schedule_config,
      startDate
    );

    const payment = await prisma.scheduledPayment.create({
      data: {
        owner_address: ownerAddress,
        team_id: input.team_id,
        name: input.name,
        description: input.description,
        recipients: input.recipients as any,
        schedule_type: input.schedule_type,
        schedule_config: (input.schedule_config) as any,
        timezone: input.timezone || 'UTC',
        next_execution: nextExecution,
        max_executions: input.max_executions,
        chain_id: input.chain_id || 42161,
        token: input.token || 'USDT',
        status: 'active',
      }
    });

    return {
        ...payment,
        recipients: payment.recipients as any,
        schedule_config: payment.schedule_config as any,
        schedule_type: payment.schedule_type as ScheduleType,
        status: payment.status as ScheduledPaymentStatus,
        timezone: payment.timezone || 'UTC',
        next_execution: payment.next_execution.toISOString(),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
    };
  }

  /**
   * Get scheduled payment by ID
   */
  async get(paymentId: string): Promise<ScheduledPayment | null> {
    const payment = await prisma.scheduledPayment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) return null;

    return {
        ...payment,
        recipients: payment.recipients as any,
        schedule_config: payment.schedule_config as any,
        schedule_type: payment.schedule_type as ScheduleType,
        status: payment.status as ScheduledPaymentStatus,
        timezone: payment.timezone || 'UTC',
        next_execution: payment.next_execution.toISOString(),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
    };
  }

  /**
   * Get scheduled payment with recent logs
   */
  async getWithLogs(
    paymentId: string,
    logLimit: number = 10
  ): Promise<ScheduledPaymentWithLogs | null> {
    const payment = await this.get(paymentId);
    if (!payment) return null;

    const logs = await prisma.scheduledPaymentLog.findMany({
      where: { scheduled_payment_id: paymentId },
      orderBy: { execution_time: 'desc' },
      take: logLimit
    });

    const mappedLogs: ScheduledPaymentLog[] = logs.map(l => ({
        ...l,
        execution_time: l.execution_time.toISOString(),
        created_at: l.created_at.toISOString(),
        status: l.status as ExecutionStatus,
        tx_hash: l.tx_hash || undefined,
        error_message: l.error_message || undefined
    }));

    return {
      ...payment,
      recent_logs: mappedLogs,
    };
  }

  /**
   * Update scheduled payment
   */
  async update(
    paymentId: string,
    input: UpdateScheduledPaymentInput
  ): Promise<ScheduledPayment> {
    const updateData: any = {
      ...input,
      updated_at: new Date(),
    };

    // Recalculate next execution if schedule changed
    if (input.schedule_type || input.schedule_config) {
      const current = await this.get(paymentId);
      if (current) {
        const { calculateNextExecution } = require('@/types/scheduled-payment');
        const scheduleType = input.schedule_type || current.schedule_type;
        const scheduleConfig = input.schedule_config || current.schedule_config;
        const nextExecution = calculateNextExecution(scheduleType, scheduleConfig);
        updateData.next_execution = nextExecution;
      }
    }

    const payment = await prisma.scheduledPayment.update({
      where: { id: paymentId },
      data: updateData
    });

    return {
        ...payment,
        recipients: payment.recipients as any,
        schedule_config: payment.schedule_config as any,
        schedule_type: payment.schedule_type as ScheduleType,
        status: payment.status as ScheduledPaymentStatus,
        timezone: payment.timezone || 'UTC',
        next_execution: payment.next_execution.toISOString(),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
    };
  }

  /**
   * Delete scheduled payment
   */
  async delete(paymentId: string): Promise<void> {
    await prisma.scheduledPayment.delete({
      where: { id: paymentId }
    });
  }

  /**
   * List scheduled payments for user
   */
  async list(
    ownerAddress: string,
    options?: {
      status?: ScheduledPaymentStatus;
      teamId?: string;
      limit?: number;
    }
  ): Promise<ScheduledPayment[]> {
    const where: any = {};
    
    if (options?.teamId) {
        where.OR = [
            { owner_address: ownerAddress },
            { team_id: options.teamId }
        ];
    } else {
        where.owner_address = ownerAddress;
    }

    if (options?.status) {
        where.status = options.status;
    }

    const payments = await prisma.scheduledPayment.findMany({
      where,
      orderBy: { next_execution: 'asc' },
      take: options?.limit
    });

    return payments.map(payment => ({
        ...payment,
        recipients: payment.recipients as any,
        schedule_config: payment.schedule_config as any,
        schedule_type: payment.schedule_type as ScheduleType,
        status: payment.status as ScheduledPaymentStatus,
        timezone: payment.timezone || 'UTC',
        next_execution: payment.next_execution.toISOString(),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
    }));
  }

  // ============================================
  // Status Management
  // ============================================

  /**
   * Pause a scheduled payment
   */
  async pause(paymentId: string): Promise<ScheduledPayment> {
    return this.update(paymentId, { status: 'paused' });
  }

  /**
   * Resume a paused scheduled payment
   */
  async resume(paymentId: string): Promise<ScheduledPayment> {
    const payment = await this.get(paymentId);
    if (!payment) throw new Error('Scheduled payment not found');

    // Recalculate next execution from now
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const nextExecution = calculateNextExecution(
      payment.schedule_type,
      payment.schedule_config
    );

    const updatedPayment = await prisma.scheduledPayment.update({
      where: { id: paymentId },
      data: {
        status: 'active',
        next_execution: nextExecution,
        updated_at: new Date(),
      }
    });

    return {
        ...updatedPayment,
        recipients: updatedPayment.recipients as any,
        schedule_config: updatedPayment.schedule_config as any,
        schedule_type: updatedPayment.schedule_type as ScheduleType,
        status: updatedPayment.status as ScheduledPaymentStatus,
        timezone: updatedPayment.timezone || 'UTC',
        next_execution: updatedPayment.next_execution.toISOString(),
        created_at: updatedPayment.created_at.toISOString(),
        updated_at: updatedPayment.updated_at.toISOString()
    };
  }

  /**
   * Cancel a scheduled payment
   */
  async cancel(paymentId: string): Promise<ScheduledPayment> {
    return this.update(paymentId, { status: 'cancelled' });
  }

  // ============================================
  // Execution (For Cron Jobs)
  // ============================================

  /**
   * Get all due scheduled payments
   */
  async getDuePayments(limit: number = 100): Promise<ScheduledPayment[]> {
    const payments = await prisma.scheduledPayment.findMany({
      where: {
        status: 'active',
        next_execution: {
           lte: new Date()
        }
      },
      orderBy: { next_execution: 'asc' },
      take: limit
    });

    return payments.map(payment => ({
        ...payment,
        recipients: payment.recipients as any,
        schedule_config: payment.schedule_config as any,
        schedule_type: payment.schedule_type as ScheduleType,
        status: payment.status as ScheduledPaymentStatus,
        timezone: payment.timezone || 'UTC',
        next_execution: payment.next_execution.toISOString(),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
    }));
  }

  /**
   * Execute a single scheduled payment
   * Note: This creates a log entry but doesn't actually transfer funds.
   * The actual transfer should be done by the calling code using the batch transfer service.
   */
  async executePayment(paymentId: string): Promise<ExecuteScheduledResult> {
    const payment = await this.get(paymentId);
    if (!payment) {
      throw new Error('Scheduled payment not found');
    }

    if (payment.status !== 'active') {
      return {
        payment_id: paymentId,
        success: false,
        log_id: '',
        recipients_processed: 0,
        successful_count: 0,
        failed_count: 0,
        error_message: `Payment is ${payment.status}, not active`,
      };
    }

    // Check max executions
    if (payment.max_executions && payment.total_executions >= payment.max_executions) {
      await this.update(paymentId, { status: 'cancelled' });
      return {
        payment_id: paymentId,
        success: false,
        log_id: '',
        recipients_processed: 0,
        successful_count: 0,
        failed_count: 0,
        error_message: 'Maximum executions reached',
      };
    }

    // Calculate total amount
    const recipients = payment.recipients as any as ScheduledRecipient[];
    const totalAmount = recipients.reduce(
      (sum, r) => sum + parseFloat(r.amount || '0'),
      0
    );

    // Create log entry
    const log = await prisma.scheduledPaymentLog.create({
      data: {
        scheduled_payment_id: paymentId,
        status: 'success',  // Will be updated after actual execution
        total_amount: totalAmount.toString(),
        recipients_count: recipients.length,
        successful_count: recipients.length,
        failed_count: 0,
        details: recipients.map((r) => ({
          address: r.address,
          amount: r.amount,
          status: 'pending',
        })) as any,
      }
    });

    // Calculate next execution
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const nextExecution = calculateNextExecution(
      payment.schedule_type,
      payment.schedule_config
    );

    // Update payment record
    await prisma.scheduledPayment.update({
      where: { id: paymentId },
      data: {
        last_execution: new Date(),
        next_execution: nextExecution,
        total_executions: payment.total_executions + 1,
        updated_at: new Date(),
      }
    });

    return {
      payment_id: paymentId,
      success: true,
      log_id: log.id,
      recipients_processed: recipients.length,
      successful_count: recipients.length,
      failed_count: 0,
    };
  }

  /**
   * Update execution log after actual transfer
   */
  async updateExecutionLog(
    logId: string,
    result: {
      status: ExecutionStatus;
      tx_hash?: string;
      successful_count: number;
      failed_count: number;
      error_message?: string;
      details?: Array<{ address: string; amount: string; status: string; error?: string }>;
    }
  ): Promise<void> {
    await prisma.scheduledPaymentLog.update({
        where: { id: logId },
        data: {
            ...result,
            details: result.details as any
        }
    });
  }

  /**
   * Execute all due payments (for cron job)
   */
  async executeAllDue(limit: number = 100): Promise<CronExecutionSummary> {
    const duePayments = await this.getDuePayments(limit);
    const results: ExecuteScheduledResult[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const payment of duePayments) {
      try {
        const result = await this.executePayment(payment.id);
        results.push(result);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error: any) {
        failed++;
        results.push({
          payment_id: payment.id,
          success: false,
          log_id: '',
          recipients_processed: 0,
          successful_count: 0,
          failed_count: 0,
          error_message: error.message,
        });
      }
    }

    return {
      executed_at: new Date().toISOString(),
      payments_processed: duePayments.length,
      successful,
      failed,
      skipped,
      results,
    };
  }

  // ============================================
  // Logs
  // ============================================

  /**
   * Get execution logs for a payment
   */
  async getLogs(
    paymentId: string,
    limit: number = 20
  ): Promise<ScheduledPaymentLog[]> {
    const logs = await prisma.scheduledPaymentLog.findMany({
      where: { scheduled_payment_id: paymentId },
      orderBy: { executed_at: 'desc' },
      take: limit
    });

    return logs.map(log => ({
      ...log,
      execution_time: log.executed_at.toISOString(),
      created_at: log.executed_at.toISOString(),
      details: log.details as any
    }));
  }
}

// Export singleton instance
export const scheduledPaymentService = new ScheduledPaymentService();
