/**
 * Agent Webhook Service
 * 
 * Delivers webhook events to agents with retry logic.
 * 
 * @module lib/services/agent-webhook-service
 */

import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';

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
    const delivery: AgentWebhookDelivery = {
      id: randomUUID(),
      agent_id: agentId,
      event_type: event,
      payload,
      status: 'pending',
      attempts: 0,
      created_at: new Date(),
    };

    deliveryStore.set(delivery.id, delivery);

    // Attempt delivery
    await this.processDelivery(delivery.id, webhookUrl, webhookSecret);

    return deliveryStore.get(delivery.id)!;
  }

  /**
   * Process a webhook delivery
   */
  async processDelivery(
    deliveryId: string,
    webhookUrl: string,
    webhookSecret: string
  ): Promise<void> {
    const delivery = deliveryStore.get(deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.status === 'delivered') {
      return;
    }

    if (delivery.attempts >= 3) {
      delivery.status = 'failed';
      deliveryStore.set(deliveryId, delivery);
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

      // In production, this would make an actual HTTP request
      // For now, simulate the delivery
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

    deliveryStore.set(deliveryId, delivery);
  }

  /**
   * Simulate webhook delivery (for testing)
   * In production, this would use fetch() to make actual HTTP requests
   */
  private async simulateDelivery(
    url: string,
    payload: string,
    signature: string
  ): Promise<{ ok: boolean; status: number }> {
    // Simulate successful delivery
    // In production, this would be:
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Webhook-Signature': signature,
    //   },
    //   body: payload,
    // });
    // return { ok: response.ok, status: response.status };

    return { ok: true, status: 200 };
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
