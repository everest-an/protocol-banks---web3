/**
 * Webhook Service
 * Manages webhook subscriptions, delivery, and retry logic
 */

import { createHash, randomBytes, createHmac } from 'crypto';
import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export type WebhookEvent =
  | 'payment.created'
  | 'payment.completed'
  | 'payment.failed'
  | 'batch_payment.created'
  | 'batch_payment.completed'
  | 'multisig.proposal_created'
  | 'multisig.executed'
  | 'subscription.created'
  | 'subscription.payment_due'
  | 'subscription.payment_completed'
  | 'subscription.cancelled';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  owner_address: string;
  events: WebhookEvent[];
  secret_hash: string;
  is_active: boolean;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  owner_address: string;
  events: WebhookEvent[];
  retry_count?: number;
  timeout_ms?: number;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  is_active?: boolean;
  retry_count?: number;
  timeout_ms?: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEvent;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  last_attempt_at?: string;
  next_retry_at?: string;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  created_at: string;
  delivered_at?: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

// ============================================
// Constants
// ============================================

const WEBHOOK_SECRET_LENGTH = 32;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [60000, 300000, 900000]; // 1min, 5min, 15min

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a cryptographically secure webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(WEBHOOK_SECRET_LENGTH).toString('hex')}`;
}

/**
 * Hash a webhook secret using SHA-256
 */
export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  // Use timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Calculate next retry time based on attempt number
 */
export function calculateNextRetryTime(attempt: number): Date {
  const delayIndex = Math.min(attempt, RETRY_DELAYS_MS.length - 1);
  const delayMs = RETRY_DELAYS_MS[delayIndex];
  return new Date(Date.now() + delayMs);
}

// ============================================
// Webhook Service
// ============================================

export class WebhookService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new webhook
   * Returns the webhook object and the secret (shown only once)
   */
  async create(input: CreateWebhookInput): Promise<{ webhook: Webhook; secret: string }> {
    // Generate secret and hash
    const secret = generateWebhookSecret();
    const secretHash = hashWebhookSecret(secret);

    // Prepare data for insertion
    const webhookData = {
      name: input.name,
      url: input.url,
      owner_address: input.owner_address.toLowerCase(),
      events: input.events,
      secret_hash: secretHash,
      is_active: true,
      retry_count: input.retry_count ?? DEFAULT_RETRY_COUNT,
      timeout_ms: input.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    };

    // Insert into database
    const { data, error } = await this.supabase
      .from('webhooks')
      .insert([webhookData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    return {
      webhook: data as Webhook,
      secret,
    };
  }

  /**
   * List all webhooks for an owner
   */
  async list(ownerAddress: string): Promise<Webhook[]> {
    const { data, error } = await this.supabase
      .from('webhooks')
      .select('*')
      .eq('owner_address', ownerAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list webhooks: ${error.message}`);
    }

    return (data || []) as Webhook[];
  }

  /**
   * Get a single webhook by ID
   */
  async getById(id: string, ownerAddress: string): Promise<Webhook | null> {
    const { data, error } = await this.supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get webhook: ${error.message}`);
    }

    return data as Webhook;
  }

  /**
   * Update a webhook
   */
  async update(id: string, ownerAddress: string, input: UpdateWebhookInput): Promise<Webhook> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.events !== undefined) updateData.events = input.events;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.retry_count !== undefined) updateData.retry_count = input.retry_count;
    if (input.timeout_ms !== undefined) updateData.timeout_ms = input.timeout_ms;

    const { data, error } = await this.supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }

    return data as Webhook;
  }

  /**
   * Delete a webhook
   */
  async delete(id: string, ownerAddress: string): Promise<void> {
    const { error } = await this.supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(
    webhookId: string,
    ownerAddress: string,
    options: { limit?: number; status?: string } = {}
  ): Promise<WebhookDelivery[]> {
    // First verify ownership
    const webhook = await this.getById(webhookId, ownerAddress);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    let query = this.supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get deliveries: ${error.message}`);
    }

    return (data || []) as WebhookDelivery[];
  }

  /**
   * Queue a webhook delivery
   */
  async queueDelivery(
    webhookId: string,
    event: WebhookEvent,
    payload: Record<string, any>
  ): Promise<WebhookDelivery> {
    const deliveryData = {
      webhook_id: webhookId,
      event_type: event,
      payload,
      status: 'pending',
      attempts: 0,
    };

    const { data, error } = await this.supabase
      .from('webhook_deliveries')
      .insert([deliveryData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to queue delivery: ${error.message}`);
    }

    return data as WebhookDelivery;
  }

  /**
   * Get webhooks subscribed to an event for an owner
   */
  async getWebhooksForEvent(ownerAddress: string, event: WebhookEvent): Promise<Webhook[]> {
    const { data, error } = await this.supabase
      .from('webhooks')
      .select('*')
      .eq('owner_address', ownerAddress.toLowerCase())
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      throw new Error(`Failed to get webhooks for event: ${error.message}`);
    }

    return (data || []) as Webhook[];
  }

  /**
   * Update delivery status after attempt
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: 'delivered' | 'failed' | 'retrying',
    details: {
      responseStatus?: number;
      responseBody?: string;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status,
      last_attempt_at: new Date().toISOString(),
    };

    if (details.responseStatus !== undefined) {
      updateData.response_status = details.responseStatus;
    }
    if (details.responseBody !== undefined) {
      updateData.response_body = details.responseBody;
    }
    if (details.errorMessage !== undefined) {
      updateData.error_message = details.errorMessage;
    }

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Get current delivery to increment attempts
    const { data: delivery } = await this.supabase
      .from('webhook_deliveries')
      .select('attempts')
      .eq('id', deliveryId)
      .single();

    if (delivery) {
      updateData.attempts = delivery.attempts + 1;

      if (status === 'retrying') {
        updateData.next_retry_at = calculateNextRetryTime(delivery.attempts).toISOString();
      }
    }

    const { error } = await this.supabase
      .from('webhook_deliveries')
      .update(updateData)
      .eq('id', deliveryId);

    if (error) {
      throw new Error(`Failed to update delivery status: ${error.message}`);
    }
  }

  /**
   * Get pending deliveries for retry
   */
  async getPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('webhook_deliveries')
      .select('*')
      .or(`status.eq.pending,and(status.eq.retrying,next_retry_at.lte.${now})`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get pending deliveries: ${error.message}`);
    }

    return (data || []) as WebhookDelivery[];
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
