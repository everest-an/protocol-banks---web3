/**
 * Agent Webhook Service
 *
 * Delivers webhook events to agents with retry logic.
 *
 * @module lib/services/agent-webhook-service
 */

import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export type AgentWebhookEvent = 
  | 'proposal.created'
  | 'proposal.approved'
  | 'proposal.rejected'
  | 'payment.executing'
  | 'payment.executed'
  | 'payment.failed'
  | 'budget.depleted'
  | 'budget.reset'
  | 'agent.paused'
  | 'agent.resumed';

export interface AgentWebhookDelivery {
  id: string;
  agent_id: string;
  event_type: AgentWebhookEvent;
  payload: object;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  last_attempt_at?: Date;
  next_retry_at?: Date;
  response_status?: number;
  error_message?: string;
  created_at: Date;
  delivered_at?: Date;
}

// ============================================
// In-Memory Store
// ============================================

const deliveryStore = new Map<string, AgentWebhookDelivery>();

// Retry delays in milliseconds
const RETRY_DELAYS = [0, 60000, 300000]; // Immediate, 1 min, 5 min

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

function convertDbDelivery(data: any): AgentWebhookDelivery {
  return {
    ...data,
    created_at: new Date(data.created_at),
    last_attempt_at: data.last_attempt_at ? new Date(data.last_attempt_at) : undefined,
    next_retry_at: data.next_retry_at ? new Date(data.next_retry_at) : undefined,
    delivered_at: data.delivered_at ? new Date(data.delivered_at) : undefined,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// ============================================
// Agent Webhook Service
// ============================================

export class AgentWebhookService {
  /**
   * Trigger a webhook event for an agent
   */
  async trigger(
    agentId: string,
    webhookUrl: string,
    webhookSecret: string,
    event: AgentWebhookEvent,
    payload: object
  ): Promise<AgentWebhookDelivery> {
    const deliveryData = {
      agent_id: agentId,
      event_type: event,
      payload,
      status: 'pending' as const,
      attempts: 0,
    };

    let delivery: AgentWebhookDelivery;

    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from('agent_webhook_deliveries')
          .insert(deliveryData)
          .select()
          .single();

        if (error) {
          console.error('[Webhook Service] Insert error:', error);
          // Fall back to in-memory
          delivery = {
            id: randomUUID(),
            ...deliveryData,
            created_at: new Date(),
          };
          deliveryStore.set(delivery.id, delivery);
        } else {
          delivery = convertDbDelivery(data);
        }
      } catch (error) {
        console.error('[Webhook Service] Failed to create delivery:', error);
        delivery = {
          id: randomUUID(),
          ...deliveryData,
          created_at: new Date(),
        };
        deliveryStore.set(delivery.id, delivery);
      }
    } else {
      delivery = {
        id: randomUUID(),
        ...deliveryData,
        created_at: new Date(),
      };
      deliveryStore.set(delivery.id, delivery);
    }

    // Attempt delivery
    await this.processDelivery(delivery.id, webhookUrl, webhookSecret);

    // Return latest state
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from('agent_webhook_deliveries')
          .select('*')
          .eq('id', delivery.id)
          .single();
        if (data) return convertDbDelivery(data);
      } catch {
        // Fall through
      }
    }

    return deliveryStore.get(delivery.id) || delivery;
  }

  /**
   * Process a webhook delivery
   */
  async processDelivery(
    deliveryId: string,
    webhookUrl: string,
    webhookSecret: string
  ): Promise<void> {
    let delivery: AgentWebhookDelivery | null = null;

    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from('agent_webhook_deliveries')
          .select('*')
          .eq('id', deliveryId)
          .single();
        if (data) delivery = convertDbDelivery(data);
      } catch {
        // Fall through to in-memory
      }
    }

    if (!delivery) {
      delivery = deliveryStore.get(deliveryId) || null;
    }

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.status === 'delivered') {
      return;
    }

    if (delivery.attempts >= 3) {
      delivery.status = 'failed';
      await this.saveDelivery(delivery);
      return;
    }

    delivery.attempts++;
    delivery.last_attempt_at = new Date();

    try {
      const payloadString = JSON.stringify({
        event: delivery.event_type,
        data: delivery.payload,
        timestamp: new Date().toISOString(),
        delivery_id: delivery.id,
      });

      const signature = generateWebhookSignature(payloadString, webhookSecret);

      const response = await this.simulateDelivery(webhookUrl, payloadString, signature);

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.response_status = response.status;
        delivery.delivered_at = new Date();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      delivery.error_message = error instanceof Error ? error.message : 'Unknown error';

      if (delivery.attempts < 3) {
        // Schedule retry
        const retryDelay = RETRY_DELAYS[delivery.attempts] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        delivery.next_retry_at = new Date(Date.now() + retryDelay);
      } else {
        delivery.status = 'failed';
      }
    }

    await this.saveDelivery(delivery);
  }

  /**
   * Persist delivery state to database or in-memory store
   */
  private async saveDelivery(delivery: AgentWebhookDelivery): Promise<void> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        await supabase
          .from('agent_webhook_deliveries')
          .update({
            status: delivery.status,
            attempts: delivery.attempts,
            last_attempt_at: delivery.last_attempt_at?.toISOString(),
            next_retry_at: delivery.next_retry_at?.toISOString(),
            response_status: delivery.response_status,
            error_message: delivery.error_message,
            delivered_at: delivery.delivered_at?.toISOString(),
          })
          .eq('id', delivery.id);
      } catch (error) {
        console.error('[Webhook Service] Failed to save delivery:', error);
        // Fall back to in-memory
        deliveryStore.set(delivery.id, delivery);
      }
    } else {
      deliveryStore.set(delivery.id, delivery);
    }
  }

  /**
   * Simulate webhook delivery (for testing)
   * In production, this uses fetch() to make actual HTTP requests
   */
  private async simulateDelivery(
    url: string,
    payload: string,
    signature: string
  ): Promise<{ ok: boolean; status: number }> {
    // Check if we should use real HTTP delivery
    const useRealDelivery = process.env.WEBHOOK_REAL_DELIVERY === 'true'

    if (useRealDelivery) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': new Date().toISOString(),
            'User-Agent': 'ProtocolBanks-Webhook/1.0',
          },
          body: payload,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        return { ok: response.ok, status: response.status }
      } catch (error) {
        console.error('[WebhookService] Delivery failed:', error)
        if (error instanceof Error && error.name === 'AbortError') {
          return { ok: false, status: 408 } // Request Timeout
        }
        return { ok: false, status: 500 }
      }
    }

    // Fallback: simulate successful delivery in development
    console.log('[WebhookService] Simulating webhook delivery to:', url)
    return { ok: true, status: 200 }
  }

  /**
   * Get deliveries for an agent
   */
  async getDeliveries(agentId: string, limit: number = 50): Promise<AgentWebhookDelivery[]> {
    const deliveries: AgentWebhookDelivery[] = [];
    
    for (const delivery of deliveryStore.values()) {
      if (delivery.agent_id === agentId) {
        deliveries.push(delivery);
      }
    }

    return deliveries
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  /**
   * Get pending deliveries that need retry
   */
  async getPendingRetries(): Promise<AgentWebhookDelivery[]> {
    const now = new Date();
    const pending: AgentWebhookDelivery[] = [];
    
    for (const delivery of deliveryStore.values()) {
      if (
        delivery.status === 'pending' &&
        delivery.next_retry_at &&
        delivery.next_retry_at <= now
      ) {
        pending.push(delivery);
      }
    }

    return pending;
  }

  /**
   * Clear all deliveries (for testing)
   */
  _clearAll(): void {
    deliveryStore.clear();
  }

  /**
   * Get delivery count (for testing)
   */
  _getCount(): number {
    return deliveryStore.size;
  }

  /**
   * Set delivery for testing
   */
  _setDelivery(delivery: AgentWebhookDelivery): void {
    deliveryStore.set(delivery.id, delivery);
  }
}

// Export singleton instance
export const agentWebhookService = new AgentWebhookService();
