/**
 * Subscription Service
 * Manages recurring payment subscriptions
 */

import { prisma } from '@/lib/prisma';
import { calculateNextPaymentDate, formatSubscriptionForDisplay, validateSubscription } from '@/lib/subscription-helpers';
import type { Subscription as UISubscription, SubscriptionInput, SubscriptionFrequency as UIFrequency } from '@/types';

// ============================================
// Types
// ============================================

export type SubscriptionFrequency = UIFrequency;
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'payment_failed';

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
}

export interface UpdateSubscriptionInput {
  service_name?: string;
  amount?: string;
  frequency?: SubscriptionFrequency;
  status?: SubscriptionStatus;
  memo?: string;
}

// ============================================
// Helper Functions
// ============================================

function mapToSubscription(data: any): Subscription {
  if (!data) return null as any;
  return {
    ...data,
    recipient_address: data.wallet_address,
    next_payment_date: data.next_payment_date ? data.next_payment_date.toISOString() : null,
    last_payment_date: data.last_payment_date ? data.last_payment_date.toISOString() : null,
    created_at: data.created_at.toISOString(),
    updated_at: data.updated_at.toISOString(),
  };
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
   * Create a new subscription
   */
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const nextPaymentDate = calculateNextPaymentDate(startDate, input.frequency);

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
      }
    });

    return mapToSubscription(subscription);
  }

  /**
   * List all subscriptions for an owner
   */
  async list(ownerAddress: string, options: { status?: SubscriptionStatus } = {}): Promise<Subscription[]> {
    const where: any = {
      owner_address: ownerAddress.toLowerCase()
    };
    if (options.status) {
      where.status = options.status;
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
   * Update a subscription
   */
  async update(id: string, ownerAddress: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const existing = await prisma.subscription.findFirst({
         where: { id, owner_address: ownerAddress.toLowerCase() }
    });
    if (!existing) throw new Error('Subscription not found');

    const data: any = {};
    if (input.service_name !== undefined) data.service_name = input.service_name;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.status !== undefined) data.status = input.status;
    if (input.memo !== undefined) data.memo = input.memo;

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

    // Calculate new next payment date from now
    const nextPaymentDate = calculateNextPaymentDate(new Date(), subscription.frequency);

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

    return subscriptions.map(mapToSubscription);
  }

  /**
   * Record a successful payment
   */
  async recordPayment(id: string, amount: string, txHash?: string): Promise<Subscription> {
    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new Error('Subscription not found');

    const currentTotal = parseFloat(subscription.total_paid || '0');
    const newTotal = currentTotal + parseFloat(amount);
    
    // Calculate next payment date
    // Note: Use Date object for Prisma
    const nextPaymentDate = calculateNextPaymentDate(new Date(), subscription.frequency as any);

    const updated = await prisma.subscription.update({
        where: { id },
        data: {
            last_payment_date: new Date(),
            next_payment_date: nextPaymentDate,
            total_paid: newTotal.toString(),
            payment_count: { increment: 1 },
            last_tx_hash: txHash,
            status: 'active',
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
