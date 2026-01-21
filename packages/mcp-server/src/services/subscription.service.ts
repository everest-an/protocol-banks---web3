/**
 * ProtocolBanks MCP Server - Subscription Service
 * 
 * Manages subscription plans and user subscriptions via Supabase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SubscriptionPlan,
  UserSubscription,
  UserSubscriptionWithPlan,
  PaymentRecord,
  SubscriptionStatus,
  DBSubscriptionPlan,
  DBUserSubscription,
  DBPaymentRecord,
  MCPErrorCode,
} from '../types';
import { Logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

// ============================================================================
// Subscription Service
// ============================================================================

export class SubscriptionService {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(config: SubscriptionServiceConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.logger = new Logger({ level: 'info', prefix: 'SubscriptionService' });
  }

  // ==========================================================================
  // Plan Management
  // ==========================================================================

  /**
   * List all active subscription plans
   */
  async listPlans(): Promise<SubscriptionPlan[]> {
    this.logger.debug('Listing subscription plans');
    
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      this.logger.error('Failed to list plans', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to list subscription plans');
    }

    return (data || []).map(this.mapDBPlanToPlan);
  }

  /**
   * Get a specific subscription plan by ID
   */
  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    this.logger.debug(`Getting plan: ${planId}`);
    
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get plan', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to get subscription plan');
    }

    return this.mapDBPlanToPlan(data);
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Create a new subscription (pending payment)
   */
  async createSubscription(
    planId: string,
    userId: string
  ): Promise<UserSubscription> {
    this.logger.info(`Creating subscription for user ${userId} to plan ${planId}`);
    
    // Verify plan exists
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new SubscriptionError('PLAN_NOT_FOUND', `Plan '${planId}' not found`);
    }

    // Check for existing active subscription
    const existing = await this.getActiveSubscription(userId, planId);
    if (existing) {
      throw new SubscriptionError('SUBSCRIPTION_EXISTS', 'User already has an active subscription to this plan');
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, plan.interval);

    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'pending',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create subscription', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to create subscription');
    }

    return this.mapDBSubscriptionToSubscription(data);
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<UserSubscriptionWithPlan | null> {
    this.logger.debug(`Getting subscription: ${subscriptionId}`);
    
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*),
        payments:subscription_payments(*)
      `)
      .eq('id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get subscription', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to get subscription');
    }

    return this.mapDBSubscriptionWithPlan(data);
  }

  /**
   * Get user's active subscription to a specific plan
   */
  async getActiveSubscription(
    userId: string,
    planId: string
  ): Promise<UserSubscription | null> {
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to check existing subscription');
    }

    return this.mapDBSubscriptionToSubscription(data);
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<UserSubscriptionWithPlan[]> {
    this.logger.debug(`Getting subscriptions for user: ${userId}`);
    
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*),
        payments:subscription_payments(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get user subscriptions', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to get user subscriptions');
    }

    return (data || []).map(this.mapDBSubscriptionWithPlan);
  }

  /**
   * Activate a subscription after payment confirmation
   */
  async activateSubscription(subscriptionId: string): Promise<UserSubscription> {
    this.logger.info(`Activating subscription: ${subscriptionId}`);
    
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to activate subscription', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to activate subscription');
    }

    return this.mapDBSubscriptionToSubscription(data);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<UserSubscription> {
    this.logger.info(`Cancelling subscription: ${subscriptionId}`);
    
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        auto_renew: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .in('status', ['active', 'pending'])
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to cancel subscription', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to cancel subscription');
    }

    return this.mapDBSubscriptionToSubscription(data);
  }

  /**
   * Update subscription status
   */
  async updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus
  ): Promise<UserSubscription> {
    this.logger.info(`Updating subscription ${subscriptionId} status to ${status}`);
    
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update subscription status', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to update subscription status');
    }

    return this.mapDBSubscriptionToSubscription(data);
  }

  // ==========================================================================
  // Payment Records
  // ==========================================================================

  /**
   * Record a payment for a subscription
   */
  async recordPayment(
    subscriptionId: string,
    amount: string,
    token: string,
    txHash: string,
    network: string
  ): Promise<PaymentRecord> {
    this.logger.info(`Recording payment for subscription: ${subscriptionId}`);
    
    const { data, error } = await this.supabase
      .from('subscription_payments')
      .insert({
        subscription_id: subscriptionId,
        amount: parseFloat(amount),
        token,
        tx_hash: txHash,
        network,
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to record payment', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to record payment');
    }

    return this.mapDBPaymentToPayment(data);
  }

  /**
   * Get payment history for a subscription
   */
  async getPaymentHistory(subscriptionId: string): Promise<PaymentRecord[]> {
    const { data, error } = await this.supabase
      .from('subscription_payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get payment history', { error: error.message });
      throw new SubscriptionError('DATABASE_ERROR', 'Failed to get payment history');
    }

    return (data || []).map(this.mapDBPaymentToPayment);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private calculateEndDate(startDate: Date, interval: string): Date {
    const endDate = new Date(startDate);
    
    switch (interval) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'one-time':
        // One-time subscriptions don't expire
        endDate.setFullYear(endDate.getFullYear() + 100);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return endDate;
  }

  private mapDBPlanToPlan(dbPlan: DBSubscriptionPlan): SubscriptionPlan {
    return {
      id: dbPlan.id,
      name: dbPlan.name,
      description: dbPlan.description || '',
      price: dbPlan.price.toString(),
      token: dbPlan.token,
      interval: dbPlan.interval,
      features: dbPlan.features || [],
      maxApiCalls: dbPlan.max_api_calls || undefined,
      isActive: dbPlan.is_active,
      createdAt: dbPlan.created_at,
      updatedAt: dbPlan.updated_at,
    };
  }

  private mapDBSubscriptionToSubscription(dbSub: DBUserSubscription): UserSubscription {
    return {
      id: dbSub.id,
      userId: dbSub.user_id,
      planId: dbSub.plan_id,
      status: dbSub.status,
      startDate: dbSub.start_date || '',
      endDate: dbSub.end_date || '',
      autoRenew: dbSub.auto_renew,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
    };
  }

  private mapDBSubscriptionWithPlan(dbData: any): UserSubscriptionWithPlan {
    return {
      ...this.mapDBSubscriptionToSubscription(dbData),
      plan: this.mapDBPlanToPlan(dbData.plan),
      paymentHistory: (dbData.payments || []).map(this.mapDBPaymentToPayment),
    };
  }

  private mapDBPaymentToPayment(dbPayment: DBPaymentRecord): PaymentRecord {
    return {
      id: dbPayment.id,
      subscriptionId: dbPayment.subscription_id,
      amount: dbPayment.amount.toString(),
      token: dbPayment.token,
      txHash: dbPayment.tx_hash || '',
      network: dbPayment.network,
      timestamp: dbPayment.created_at,
      status: dbPayment.status,
    };
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class SubscriptionError extends Error {
  code: MCPErrorCode;

  constructor(code: MCPErrorCode, message: string) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSubscriptionService(
  config: SubscriptionServiceConfig
): SubscriptionService {
  return new SubscriptionService(config);
}
