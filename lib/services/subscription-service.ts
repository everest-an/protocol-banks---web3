/**
 * Subscription Service
 * Manages recurring payment subscriptions
 */

import { createClient } from '@/lib/supabase-client';
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
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new subscription
   */
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const nextPaymentDate = calculateNextPaymentDate(startDate, input.frequency);

    const subscriptionData = {
      owner_address: input.owner_address.toLowerCase(),
      service_name: input.service_name,
      wallet_address: input.wallet_address.toLowerCase(),
      amount: input.amount,
      token: input.token,
      frequency: input.frequency,
      status: 'active' as SubscriptionStatus,
      next_payment_date: nextPaymentDate.toISOString(),
      last_payment_date: null,
      total_paid: '0',
      payment_count: 0,
      chain_id: input.chain_id,
      memo: input.memo || null,
    };

    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert([subscriptionData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return data as Subscription;
  }

  /**
   * List all subscriptions for an owner
   */
  async list(ownerAddress: string, options: { status?: SubscriptionStatus } = {}): Promise<Subscription[]> {
    let query = this.supabase
      .from('subscriptions')
      .select('*')
      .eq('owner_address', ownerAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list subscriptions: ${error.message}`);
    }

    return (data || []) as Subscription[];
  }

  /**
   * Get a single subscription by ID
   */
  async getById(id: string, ownerAddress: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get subscription: ${error.message}`);
    }

    return data as Subscription;
  }

  /**
   * Update a subscription
   */
  async update(id: string, ownerAddress: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.service_name !== undefined) updateData.service_name = input.service_name;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.memo !== undefined) updateData.memo = input.memo;

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    return data as Subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancel(id: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        next_payment_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Pause a subscription
   */
  async pause(id: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to pause subscription: ${error.message}`);
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

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'active',
        next_payment_date: nextPaymentDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resume subscription: ${error.message}`);
    }

    return data as Subscription;
  }

  /**
   * Get due subscriptions (for payment processing)
   */
  async getDueSubscriptions(limit: number = 100): Promise<Subscription[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('next_payment_date', now)
      .order('next_payment_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get due subscriptions: ${error.message}`);
    }

    return (data || []) as Subscription[];
  }

  /**
   * Record a successful payment
   */
  async recordPayment(id: string, amount: string, txHash?: string): Promise<Subscription> {
    // Get current subscription
    const { data: subscription, error: getError } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate next payment date
    const nextPaymentDate = calculateNextPaymentDate(new Date(), subscription.frequency);
    const newTotalPaid = (parseFloat(subscription.total_paid || '0') + parseFloat(amount)).toString();

    const updateData: Record<string, any> = {
      last_payment_date: new Date().toISOString(),
      next_payment_date: nextPaymentDate.toISOString(),
      total_paid: newTotalPaid,
      payment_count: (subscription.payment_count || 0) + 1,
      status: 'active', // Reset from payment_failed if applicable
      updated_at: new Date().toISOString(),
    };

    if (txHash) {
      updateData.last_tx_hash = txHash;
    }

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    // Also record in subscription_payments table for history
    try {
      await this.supabase.from('subscription_payments').insert({
        subscription_id: id,
        amount: amount,
        tx_hash: txHash,
        status: 'completed',
        created_at: new Date().toISOString(),
      });
    } catch (historyError) {
      // Don't fail if history recording fails
      console.warn('[SubscriptionService] Failed to record payment history:', historyError);
    }

    return data as Subscription;
  }

  /**
   * Record a failed payment
   */
  async recordPaymentFailure(id: string, errorMessage: string): Promise<void> {
    // Get subscription details for notification
    const { data: subscription, error: getError } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (getError) {
      console.error('[SubscriptionService] Failed to get subscription for failure recording:', getError);
    }

    // Calculate retry date (24 hours from now)
    const retryDate = new Date();
    retryDate.setHours(retryDate.getHours() + 24);

    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'payment_failed',
        next_payment_date: retryDate.toISOString(), // Schedule retry in 24 hours
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to record payment failure: ${error.message}`);
    }

    // Record failure in payment history
    try {
      await this.supabase.from('subscription_payments').insert({
        subscription_id: id,
        amount: subscription?.amount || '0',
        status: 'failed',
        error_message: errorMessage,
        created_at: new Date().toISOString(),
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
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'payment_failed')
      .lte('next_payment_date', now)
      .order('next_payment_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get retry due subscriptions: ${error.message}`);
    }

    return (data || []) as Subscription[];
  }

  /**
   * Reset subscription status after successful retry
   */
  async resetAfterRetry(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to reset subscription after retry: ${error.message}`);
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
