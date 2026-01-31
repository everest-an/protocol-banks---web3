/**
 * Subscription Service
 * Manages recurring payment subscriptions
 */

import { createClient } from '@/lib/supabase-client';
import type { Subscription as UISubscription, SubscriptionInput, SubscriptionFrequency as UIFrequency } from '@/types';

// ============================================
// Types
// ============================================

export type SubscriptionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'payment_failed';

export interface Subscription {
  id: string;
  owner_address: string;
  service_name: string;
  wallet_address: string;
  amount: string;
  token: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  next_payment_date: string | null;
  last_payment_date: string | null;
  total_paid: string;
  payment_count: number;
  chain_id: number;
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
 * Calculate the next payment date based on frequency
 * Handles month-end edge cases (e.g., Jan 31 → Feb 28)
 */
export function calculateNextPaymentDate(
  fromDate: Date,
  frequency: SubscriptionFrequency
): Date {
  const result = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      result.setDate(result.getDate() + 1);
      break;

    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;

    case 'monthly': {
      const originalDay = result.getDate();
      result.setMonth(result.getMonth() + 1);
      
      // Handle month-end edge cases
      // If we started on day 31 and next month has fewer days
      if (result.getDate() !== originalDay) {
        // We've overflowed into the next month, go back to last day of intended month
        result.setDate(0);
      }
      break;
    }

    case 'yearly': {
      const originalDay = result.getDate();
      const originalMonth = result.getMonth();
      result.setFullYear(result.getFullYear() + 1);
      
      // Handle Feb 29 → Feb 28 for non-leap years
      if (result.getMonth() !== originalMonth || result.getDate() !== originalDay) {
        result.setDate(0);
      }
      break;
    }
  }

  return result;
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

/**
 * Validate subscription input
 */
export function validateSubscription(input: SubscriptionInput): void {
  if (!input.service_name || input.service_name.trim() === '') {
    throw new Error('Service name is required');
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  if (!input.recipient_address || !input.recipient_address.startsWith('0x')) {
    throw new Error('Valid recipient address is required');
  }

  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(input.frequency)) {
    throw new Error('Invalid frequency');
  }

  if (!['USDC', 'USDT', 'DAI', 'ETH'].includes(input.token)) {
    throw new Error('Invalid token');
  }
}

/**
 * Format subscription for display
 */
export function formatSubscriptionForDisplay(subscription: UISubscription): {
  formattedAmount: string;
  formattedFrequency: string;
  formattedNextPayment: string;
  formattedLastPayment: string;
} {
  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  return {
    formattedAmount: `${subscription.amount} ${subscription.token}`,
    formattedFrequency: frequencyLabels[subscription.frequency] || subscription.frequency,
    formattedNextPayment: subscription.next_payment
      ? new Date(subscription.next_payment).toLocaleDateString()
      : 'N/A',
    formattedLastPayment: subscription.last_payment
      ? new Date(subscription.last_payment).toLocaleDateString()
      : 'Never',
  };
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
  async recordPayment(id: string, amount: string): Promise<Subscription> {
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
    const newTotalPaid = (parseFloat(subscription.total_paid) + parseFloat(amount)).toString();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        last_payment_date: new Date().toISOString(),
        next_payment_date: nextPaymentDate.toISOString(),
        total_paid: newTotalPaid,
        payment_count: subscription.payment_count + 1,
        status: 'active', // Reset from payment_failed if applicable
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    return data as Subscription;
  }

  /**
   * Record a failed payment and schedule retry
   */
  async recordPaymentFailure(id: string, errorMessage: string): Promise<void> {
    // Get subscription details for notification
    const { data: subscription, error: getError } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate retry date (24 hours from now)
    const retryDate = new Date();
    retryDate.setHours(retryDate.getHours() + 24);

    // Increment failure count or set to 1
    const failureCount = (subscription.failure_count || 0) + 1;
    const maxRetries = 3;

    // Determine new status based on failure count
    const newStatus = failureCount >= maxRetries ? 'cancelled' : 'payment_failed';

    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        failure_count: failureCount,
        last_failure_reason: errorMessage,
        next_payment_date: failureCount < maxRetries ? retryDate.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to record payment failure: ${error.message}`);
    }

    // Record failure in payment_retries table for tracking
    await this.supabase
      .from('subscription_payment_retries')
      .insert({
        subscription_id: id,
        attempt_number: failureCount,
        error_message: errorMessage,
        next_retry_at: failureCount < maxRetries ? retryDate.toISOString() : null,
        created_at: new Date().toISOString(),
      });

    // Log for debugging
    console.log(`[SubscriptionService] Payment failure recorded for ${id}: attempt ${failureCount}/${maxRetries}, status: ${newStatus}`);
  }

  /**
   * Get subscriptions that need retry
   */
  async getRetryDueSubscriptions(limit: number = 100): Promise<Subscription[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'payment_failed')
      .lte('next_payment_date', now)
      .lt('failure_count', 3)
      .order('next_payment_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get retry subscriptions: ${error.message}`);
    }

    return (data || []) as Subscription[];
  }

  /**
   * Reset failure count after successful payment
   */
  async resetFailureCount(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        failure_count: 0,
        last_failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to reset failure count: ${error.message}`);
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
