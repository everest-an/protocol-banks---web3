/**
 * Subscription Service
 * Manages recurring payment subscriptions and enterprise auto-pay
 */

import { prisma } from '@/lib/prisma';
import { calculateNextPaymentDate, checkAuthorizationValidity, getRemainingQuota } from '@/lib/subscription-helpers';
import type { Subscription as UISubscription, SubscriptionInput, SubscriptionFrequency as UIFrequency, AutoPayUseCase } from '@/types';

// ============================================
// Types
// ============================================

export type SubscriptionFrequency = UIFrequency;
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'payment_failed' | 'authorization_expired';

export interface Subscription {
  id: string;
  owner_address: string;
  service_name: string;
  wallet_address: string;
  recipient_address: string;
  amount: string;
  token: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  next_payment_date: string | null;
  last_payment_date: string | null;
  last_tx_hash?: string;
  total_paid: string;
  payment_count: number;
  chain_id: number;
  chain?: string;
  memo?: string;
  created_at: string;
  updated_at: string;
  // Auto Pay fields
  use_case: AutoPayUseCase;
  max_authorized_amount?: string;
  authorization_expires_at?: string;
  schedule_day?: number;
  schedule_time?: string;
  timezone: string;
  description?: string;
  recipients?: Array<{ address: string; amount: string; name?: string }>;
  // Computed fields
  remaining_quota?: string;
  authorization_valid?: boolean;
}

export interface CreateSubscriptionInput {
  owner_address: string;
  service_name: string;
  wallet_address: string;
  amount: string;
  token: string;
  frequency: SubscriptionFrequency;
  chain_id: number;
  start_date?: string;
  memo?: string;
  // Auto Pay fields
  use_case?: AutoPayUseCase;
  max_authorized_amount?: string;
  authorization_expires_at?: string;
  schedule_day?: number;
  schedule_time?: string;
  timezone?: string;
  description?: string;
  recipients?: Array<{ address: string; amount: string; name?: string }>;
}

export interface UpdateSubscriptionInput {
  service_name?: string;
  amount?: string;
  frequency?: SubscriptionFrequency;
  status?: SubscriptionStatus;
  memo?: string;
  // Auto Pay fields
  max_authorized_amount?: string;
  authorization_expires_at?: string;
  schedule_day?: number;
  schedule_time?: string;
  timezone?: string;
  description?: string;
  recipients?: Array<{ address: string; amount: string; name?: string }>;
}

// ============================================
// Helper Functions
// ============================================

function mapToSubscription(data: any): Subscription {
  if (!data) return null as any;

  const sub: Subscription = {
    ...data,
    recipient_address: data.wallet_address,
    next_payment_date: data.next_payment_date ? data.next_payment_date.toISOString() : null,
    last_payment_date: data.last_payment_date ? data.last_payment_date.toISOString() : null,
    authorization_expires_at: data.authorization_expires_at
      ? data.authorization_expires_at.toISOString()
      : undefined,
    recipients: data.recipients ?? undefined,
    use_case: data.use_case || 'individual',
    timezone: data.timezone || 'UTC',
    created_at: data.created_at.toISOString(),
    updated_at: data.updated_at.toISOString(),
  };

  // Compute remaining_quota and authorization_valid
  const uiSub = {
    ...sub,
    next_payment: sub.next_payment_date || undefined,
    last_payment: sub.last_payment_date || undefined,
  } as any;
  sub.remaining_quota = getRemainingQuota(uiSub) ?? undefined;
  const authCheck = checkAuthorizationValidity(uiSub);
  sub.authorization_valid = authCheck.valid;

  return sub;
}

/**
 * Check if a subscription is due for payment
 */
export function isSubscriptionDue(subscription: Subscription): boolean {
  if (subscription.status !== 'active') {
    return false;
  }

  if (!subscription.next_payment_date) {
    return false;
  }

  const nextPayment = new Date(subscription.next_payment_date);
  return nextPayment <= new Date();
}

// ============================================
// Subscription Service
// ============================================

export class SubscriptionService {
  constructor() {}

  /**
   * Create a new subscription / auto pay
   */
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const nextPaymentDate = calculateNextPaymentDate(startDate, input.frequency, {
      schedule_day: input.schedule_day,
      schedule_time: input.schedule_time,
    });

    const subscription = await prisma.subscription.create({
      data: {
        owner_address: input.owner_address.toLowerCase(),
        service_name: input.service_name,
        wallet_address: input.wallet_address.toLowerCase(),
        amount: input.amount,
        token: input.token,
        frequency: input.frequency,
        status: 'active',
        next_payment_date: nextPaymentDate,
        last_payment_date: null,
        total_paid: '0',
        payment_count: 0,
        chain_id: input.chain_id,
        memo: input.memo || null,
        // Auto Pay fields
        use_case: input.use_case || 'individual',
        max_authorized_amount: input.max_authorized_amount || null,
        authorization_expires_at: input.authorization_expires_at
          ? new Date(input.authorization_expires_at)
          : null,
        schedule_day: input.schedule_day || null,
        schedule_time: input.schedule_time || null,
        timezone: input.timezone || 'UTC',
        description: input.description || null,
        recipients: input.recipients || undefined,
      }
    });

    return mapToSubscription(subscription);
  }

  /**
   * List all subscriptions for an owner
   */
  async list(ownerAddress: string, options: { status?: SubscriptionStatus; use_case?: AutoPayUseCase } = {}): Promise<Subscription[]> {
    const where: any = {
      owner_address: ownerAddress.toLowerCase()
    };
    if (options.status) {
      where.status = options.status;
    }
    if (options.use_case) {
      where.use_case = options.use_case;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });

    return subscriptions.map(mapToSubscription);
  }

  /**
   * Get a single subscription by ID
   */
  async getById(id: string, ownerAddress: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findFirst({
        where: {
            id,
            owner_address: ownerAddress.toLowerCase()
        }
    });

    return mapToSubscription(subscription);
  }

  /**
   * Update a subscription / auto pay
   */
  async update(id: string, ownerAddress: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const existing = await prisma.subscription.findFirst({
         where: { id, owner_address: ownerAddress.toLowerCase() }
    });
    if (!existing) throw new Error('Subscription not found');

    // Validate: max_authorized_amount cannot be lowered below total_paid
    if (input.max_authorized_amount !== undefined) {
      const totalPaid = parseFloat(existing.total_paid || '0');
      const newMax = parseFloat(input.max_authorized_amount);
      if (newMax < totalPaid) {
        throw new Error(`Max authorized amount ($${newMax}) cannot be less than total already paid ($${totalPaid})`);
      }
    }

    const data: any = {};
    if (input.service_name !== undefined) data.service_name = input.service_name;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.status !== undefined) data.status = input.status;
    if (input.memo !== undefined) data.memo = input.memo;
    // Auto Pay fields
    if (input.max_authorized_amount !== undefined) data.max_authorized_amount = input.max_authorized_amount;
    if (input.authorization_expires_at !== undefined) {
      data.authorization_expires_at = input.authorization_expires_at
        ? new Date(input.authorization_expires_at) : null;
    }
    if (input.schedule_day !== undefined) data.schedule_day = input.schedule_day;
    if (input.schedule_time !== undefined) data.schedule_time = input.schedule_time;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.description !== undefined) data.description = input.description;
    if (input.recipients !== undefined) data.recipients = input.recipients;

    const subscription = await prisma.subscription.update({
      where: { id },
      data
    });

    return mapToSubscription(subscription);
  }

  /**
   * Cancel a subscription
   */
  async cancel(id: string, ownerAddress: string): Promise<void> {
    const { count } = await prisma.subscription.updateMany({
        where: { id, owner_address: ownerAddress.toLowerCase() },
        data: {
            status: 'cancelled',
            next_payment_date: null
        }
    });

    if (count === 0) {
      throw new Error('Failed to cancel subscription: Not found');
    }
  }

  /**
   * Pause a subscription
   */
  async pause(id: string, ownerAddress: string): Promise<void> {
    const { count } = await prisma.subscription.updateMany({
        where: { id, owner_address: ownerAddress.toLowerCase() },
        data: { status: 'paused' }
    });

    if (count === 0) {
       throw new Error('Failed to pause subscription: Not found');
    }
  }

  /**
   * Resume a paused subscription
   */
  async resume(id: string, ownerAddress: string): Promise<Subscription> {
    // Get current subscription
    const subscription = await this.getById(id, ownerAddress);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'paused') {
      throw new Error('Can only resume paused subscriptions');
    }

    // Calculate new next payment date from now (with schedule_day if set)
    const nextPaymentDate = calculateNextPaymentDate(new Date(), subscription.frequency, {
      schedule_day: subscription.schedule_day,
      schedule_time: subscription.schedule_time,
    });

    const updated = await prisma.subscription.update({
        where: { id },
        data: {
            status: 'active',
            next_payment_date: nextPaymentDate,
            updated_at: new Date()
        }
    });

    return mapToSubscription(updated);
  }

  /**
   * Get due subscriptions (for payment processing)
   * Excludes subscriptions with expired authorization or exceeded spending caps.
   * Automatically marks invalid subscriptions as 'authorization_expired'.
   */
  async getDueSubscriptions(limit: number = 100): Promise<Subscription[]> {
    const now = new Date();

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        next_payment_date: {
           lte: now
        }
      },
      orderBy: { next_payment_date: 'asc' },
      take: limit
    });

    const validSubscriptions: Subscription[] = [];

    for (const raw of subscriptions) {
      const sub = mapToSubscription(raw);

      // Check authorization validity before including
      if (!sub.authorization_valid && (sub.max_authorized_amount || sub.authorization_expires_at)) {
        // Auto-expire invalid subscriptions
        try {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'authorization_expired', updated_at: new Date() }
          });
          console.log(`[SubscriptionService] Subscription ${sub.id} marked as authorization_expired`);
        } catch (e) {
          console.warn(`[SubscriptionService] Failed to expire subscription ${sub.id}:`, e);
        }
        continue;
      }

      validSubscriptions.push(sub);
    }

    return validSubscriptions;
  }

  /**
   * Record a successful payment
   * After recording, checks if spending cap is exceeded and auto-expires if needed.
   */
  async recordPayment(id: string, amount: string, txHash?: string): Promise<Subscription> {
    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new Error('Subscription not found');

    const currentTotal = parseFloat(subscription.total_paid || '0');
    const newTotal = currentTotal + parseFloat(amount);

    // Calculate next payment date with schedule_day support
    const nextPaymentDate = calculateNextPaymentDate(new Date(), subscription.frequency as any, {
      schedule_day: subscription.schedule_day ?? undefined,
      schedule_time: subscription.schedule_time ?? undefined,
    });

    // Check if spending cap will be exceeded after this payment
    let newStatus: string = 'active';
    if (subscription.max_authorized_amount) {
      const maxAuth = parseFloat(subscription.max_authorized_amount);
      if (newTotal >= maxAuth) {
        newStatus = 'authorization_expired';
        console.log(`[SubscriptionService] Subscription ${id} reached spending cap ($${newTotal}/$${maxAuth})`);
      }
    }

    const updated = await prisma.subscription.update({
        where: { id },
        data: {
            last_payment_date: new Date(),
            next_payment_date: newStatus === 'authorization_expired' ? null : nextPaymentDate,
            total_paid: newTotal.toString(),
            payment_count: { increment: 1 },
            last_tx_hash: txHash,
            status: newStatus,
            updated_at: new Date()
        }
    });

    // Also record in subscription_payments table for history
    try {
      await prisma.subscriptionPayment.create({
        data: {
            subscription_id: id,
            amount: amount,
            tx_hash: txHash,
            status: 'completed'
        }
      });
    } catch (historyError) {
      console.warn('[SubscriptionService] Failed to record payment history:', historyError);
    }

    return mapToSubscription(updated);
  }

  /**
   * Record a failed payment
   */
  async recordPaymentFailure(id: string, errorMessage: string): Promise<void> {
    // Get subscription details for notification
    const subscription = await prisma.subscription.findUnique({ where: { id } });

    if (!subscription) {
      console.error('[SubscriptionService] Failed to get subscription for failure recording');
    }

    // Calculate retry date (24 hours from now)
    const retryDate = new Date();
    retryDate.setHours(retryDate.getHours() + 24);

    if (subscription) {
        await prisma.subscription.update({
            where: { id },
            data: {
                status: 'payment_failed',
                next_payment_date: retryDate,
                updated_at: new Date()
            }
        });
    }

    // Record failure in payment history
    try {
      await prisma.subscriptionPayment.create({
        data: {
            subscription_id: id,
            amount: subscription?.amount || '0',
            status: 'failed',
            error_message: errorMessage
        }
      });
    } catch (historyError) {
      console.warn('[SubscriptionService] Failed to record payment failure history:', historyError);
    }

    // Send notification to user about payment failure
    if (subscription) {
      try {
        const { notificationService } = await import('./notification-service');
        await notificationService.send(
          subscription.owner_address,
          'subscription_payment', // Use subscription_payment type
          {
            title: 'Subscription Payment Failed',
            body: `Payment for ${subscription.service_name} failed: ${errorMessage}. We will retry in 24 hours.`,
            data: {
              subscription_id: id,
              service_name: subscription.service_name,
              amount: subscription.amount,
              token: subscription.token,
              error: errorMessage,
              retry_date: retryDate.toISOString(),
              status: 'failed',
            },
          }
        );
      } catch (notifyError) {
        console.warn('[SubscriptionService] Failed to send payment failure notification:', notifyError);
      }
    }

    console.log(`[SubscriptionService] Payment failure recorded for ${id}, retry scheduled for ${retryDate.toISOString()}`);
  }

  /**
   * Get subscriptions that need retry (payment_failed status with past next_payment_date)
   */
  async getRetryDueSubscriptions(limit = 100): Promise<Subscription[]> {
    const now = new Date();

    const subscriptions = await prisma.subscription.findMany({
        where: {
            status: 'payment_failed',
            next_payment_date: { lte: now }
        },
        orderBy: { next_payment_date: 'asc' },
        take: limit
    });

    return subscriptions.map(mapToSubscription);
  }

  /**
   * Reset subscription status after successful retry
   */
  async resetAfterRetry(id: string): Promise<void> {
    await prisma.subscription.update({
        where: { id },
        data: {
            status: 'active',
            updated_at: new Date()
        }
    });
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
