/**
 * Webhook Service
 * Manages webhook subscriptions, delivery, and retry logic
 */

import { createHash, randomBytes, createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

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
  | 'subscription.payment_failed'
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
  constructor() {}

  /**
   * Create a new webhook
   * Returns the webhook object and the secret (shown only once)
   */
  async create(input: CreateWebhookInput): Promise<{ webhook: Webhook; secret: string }> {
    // Generate secret and hash
    const secret = generateWebhookSecret();
    const secretHash = hashWebhookSecret(secret);

    // Prepare data for insertion
    const webhook = await prisma.webhook.create({
      data: {
        name: input.name,
        url: input.url,
        owner_address: input.owner_address.toLowerCase(),
        events: input.events,
        secret_hash: secretHash,
        is_active: true,
        retry_count: input.retry_count ?? DEFAULT_RETRY_COUNT,
        timeout_ms: input.timeout_ms ?? DEFAULT_TIMEOUT_MS,
      }
    });

    return {
      webhook: {
        ...webhook,
        events: webhook.events as WebhookEvent[],
        created_at: webhook.created_at.toISOString(),
        updated_at: webhook.updated_at.toISOString()
      },
      secret,
    };
  }

  /**
   * List all webhooks for an owner
   */
  async list(ownerAddress: string): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        owner_address: ownerAddress.toLowerCase()
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return webhooks.map(w => ({
      ...w,
      events: w.events as WebhookEvent[],
      created_at: w.created_at.toISOString(),
      updated_at: w.updated_at.toISOString()
    }));
  }

  /**
   * Get a single webhook by ID
   */
  async getById(id: string, ownerAddress: string): Promise<Webhook | null> {
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        owner_address: ownerAddress.toLowerCase()
      }
    });

    if (!webhook) {
      return null;
    }

    return {
      ...webhook,
      events: webhook.events as WebhookEvent[],
      created_at: webhook.created_at.toISOString(),
      updated_at: webhook.updated_at.toISOString()
    };
  }

  /**
   * Update a webhook
   */
  async update(id: string, ownerAddress: string, input: UpdateWebhookInput): Promise<Webhook> {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.events !== undefined) updateData.events = input.events;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.retry_count !== undefined) updateData.retry_count = input.retry_count;
    if (input.timeout_ms !== undefined) updateData.timeout_ms = input.timeout_ms;

    // First check ownership
    const existing = await prisma.webhook.findFirst({
        where: { id, owner_address: ownerAddress.toLowerCase() }
    });
    
    if (!existing) {
        throw new Error('Webhook not found');
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData
    });

    return {
      ...webhook,
      events: webhook.events as WebhookEvent[],
      created_at: webhook.created_at.toISOString(),
      updated_at: webhook.updated_at.toISOString()
    };
  }

  /**
   * Delete a webhook
   */
  async delete(id: string, ownerAddress: string): Promise<void> {
    const existing = await prisma.webhook.findFirst({
        where: { id, owner_address: ownerAddress.toLowerCase() }
    });

    if (!existing) {
        throw new Error('Webhook not found or access denied');
    }

    await prisma.webhook.delete({
      where: { id }
    });
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

    const where: any = {
      webhook_id: webhookId
    };

    if (options.status) {
      where.status = options.status;
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options.limit
    });

    return deliveries.map((d: any) => ({
      ...d,
      event_type: d.event_type as WebhookEvent,
      status: d.status as any,
      created_at: d.created_at.toISOString(),
      delivered_at: d.delivered_at?.toISOString(),
      last_attempt_at: d.last_attempt_at?.toISOString(),
      next_retry_at: d.next_retry_at?.toISOString()
    }));
  }

  /**
   * Queue a webhook delivery
   */
  async queueDelivery(
    webhookId: string,
    event: WebhookEvent,
    payload: Record<string, any>
  ): Promise<WebhookDelivery> {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhook_id: webhookId,
        event_type: event,
        payload,
        status: 'pending',
        attempts: 0,
      }
    });

    return {
      ...delivery,
      event_type: delivery.event_type as WebhookEvent,
      status: delivery.status as any,
      created_at: delivery.created_at.toISOString(),
      delivered_at: delivery.delivered_at?.toISOString(),
      last_attempt_at: delivery.last_attempt_at?.toISOString(),
      next_retry_at: delivery.next_retry_at?.toISOString()
    };
  }

  /**
   * Get webhooks subscribed to an event for an owner
   */
  async getWebhooksForEvent(ownerAddress: string, event: WebhookEvent): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        owner_address: ownerAddress.toLowerCase(),
        is_active: true,
        events: {
          has: event
        }
      }
    });

    return webhooks.map(w => ({
      ...w,
      events: w.events as WebhookEvent[],
      created_at: w.created_at.toISOString(),
      updated_at: w.updated_at.toISOString()
    }));
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
    const updateData: any = {
      status,
      last_attempt_at: new Date(),
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
      updateData.delivered_at = new Date();
    }

    // Get current delivery to increment attempts
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      select: { attempts: true }
    });

    if (delivery) {
      updateData.attempts = delivery.attempts + 1;

      if (status === 'retrying') {
        updateData.next_retry_at = calculateNextRetryTime(delivery.attempts).toISOString();
      }
    }

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: updateData
    });
  }

  /**
   * Get pending deliveries for retry
   */
  async getPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
    const now = new Date();

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        OR: [
          { status: 'pending' },
          {
            status: 'retrying',
            next_retry_at: {
              lte: now
            }
          }
        ]
      },
      orderBy: { created_at: 'asc' },
      take: limit
    });

    return deliveries.map((d: any) => ({
      ...d,
      event_type: d.event_type as WebhookEvent,
      status: d.status as any,
      created_at: d.created_at.toISOString(),
      delivered_at: d.delivered_at?.toISOString(),
      last_attempt_at: d.last_attempt_at?.toISOString(),
      next_retry_at: d.next_retry_at?.toISOString()
    }));
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
