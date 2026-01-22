/**
 * Webhook Trigger Service
 * Triggers webhook events for various system events
 */

import { WebhookService, type WebhookEvent, generateWebhookSignature } from './webhook-service';

// ============================================
// Types
// ============================================

export interface PaymentEventData {
  payment_id: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_symbol: string;
  chain_id: number;
  tx_hash?: string;
  status: string;
  created_at: string;
}

export interface BatchPaymentEventData {
  batch_id: string;
  from_address: string;
  total_amount: string;
  total_items: number;
  token: string;
  chain_id: number;
  status: string;
  created_at: string;
}

export interface MultisigEventData {
  transaction_id: string;
  multisig_id: string;
  wallet_address: string;
  to_address: string;
  value: string;
  status: string;
  threshold: number;
  confirmations: number;
  execution_tx_hash?: string;
  created_at: string;
}

export interface SubscriptionEventData {
  subscription_id: string;
  owner_address: string;
  service_name: string;
  wallet_address: string;
  amount: string;
  token: string;
  frequency: string;
  status: string;
  next_payment_date?: string;
  created_at: string;
}

// ============================================
// Webhook Trigger Service
// ============================================

export class WebhookTriggerService {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  /**
   * Trigger webhooks for an event
   */
  private async triggerEvent(
    ownerAddress: string,
    event: WebhookEvent,
    data: Record<string, any>
  ): Promise<void> {
    try {
      // Get all webhooks subscribed to this event
      const webhooks = await this.webhookService.getWebhooksForEvent(ownerAddress, event);

      if (webhooks.length === 0) {
        return;
      }

      // Queue delivery for each webhook
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      await Promise.all(
        webhooks.map(webhook =>
          this.webhookService.queueDelivery(webhook.id, event, payload)
        )
      );

      console.log(`[WebhookTrigger] Queued ${webhooks.length} deliveries for event ${event}`);
    } catch (error) {
      console.error(`[WebhookTrigger] Failed to trigger event ${event}:`, error);
      // Don't throw - webhook failures shouldn't break the main flow
    }
  }

  // ============================================
  // Payment Events
  // ============================================

  async triggerPaymentCreated(ownerAddress: string, data: PaymentEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'payment.created', data);
  }

  async triggerPaymentCompleted(ownerAddress: string, data: PaymentEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'payment.completed', data);
  }

  async triggerPaymentFailed(ownerAddress: string, data: PaymentEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'payment.failed', data);
  }

  // ============================================
  // Batch Payment Events
  // ============================================

  async triggerBatchPaymentCreated(ownerAddress: string, data: BatchPaymentEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'batch_payment.created', data);
  }

  async triggerBatchPaymentCompleted(ownerAddress: string, data: BatchPaymentEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'batch_payment.completed', data);
  }

  // ============================================
  // Multisig Events
  // ============================================

  async triggerMultisigProposalCreated(ownerAddress: string, data: MultisigEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'multisig.proposal_created', data);
  }

  async triggerMultisigExecuted(ownerAddress: string, data: MultisigEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'multisig.executed', data);
  }

  // ============================================
  // Subscription Events
  // ============================================

  async triggerSubscriptionCreated(ownerAddress: string, data: SubscriptionEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'subscription.created', data);
  }

  async triggerSubscriptionPaymentDue(ownerAddress: string, data: SubscriptionEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'subscription.payment_due', data);
  }

  async triggerSubscriptionPaymentCompleted(ownerAddress: string, data: SubscriptionEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'subscription.payment_completed', data);
  }

  async triggerSubscriptionCancelled(ownerAddress: string, data: SubscriptionEventData): Promise<void> {
    await this.triggerEvent(ownerAddress, 'subscription.cancelled', data);
  }
}

// Export singleton instance
export const webhookTriggerService = new WebhookTriggerService();

// ============================================
// Webhook Delivery Worker
// ============================================

/**
 * Process pending webhook deliveries
 * This should be called by a cron job or background worker
 */
export async function processWebhookDeliveries(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const webhookService = new WebhookService();
  const results = { processed: 0, succeeded: 0, failed: 0 };

  try {
    // Get pending deliveries
    const deliveries = await webhookService.getPendingDeliveries(50);
    results.processed = deliveries.length;

    for (const delivery of deliveries) {
      try {
        // Get webhook details
        const { data: webhook } = await webhookService['supabase']
          .from('webhooks')
          .select('*')
          .eq('id', delivery.webhook_id)
          .single();

        if (!webhook || !webhook.is_active) {
          await webhookService.updateDeliveryStatus(delivery.id, 'failed', {
            errorMessage: 'Webhook not found or inactive',
          });
          results.failed++;
          continue;
        }

        // Prepare payload
        const payloadStr = JSON.stringify(delivery.payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signaturePayload = `${timestamp}.${payloadStr}`;
        
        // Note: In production, we'd need to retrieve the actual secret
        // For now, we sign with the hash (this is a simplification)
        const signature = generateWebhookSignature(signaturePayload, webhook.secret_hash);

        // Send webhook
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_ms);

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Timestamp': timestamp,
              'X-Webhook-Event': delivery.event_type,
              'X-Webhook-ID': delivery.id,
            },
            body: payloadStr,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const responseBody = await response.text().catch(() => '');

          if (response.ok) {
            await webhookService.updateDeliveryStatus(delivery.id, 'delivered', {
              responseStatus: response.status,
              responseBody: responseBody.slice(0, 1000),
            });
            results.succeeded++;
          } else {
            // Check if we should retry
            const shouldRetry = delivery.attempts < webhook.retry_count;
            await webhookService.updateDeliveryStatus(
              delivery.id,
              shouldRetry ? 'retrying' : 'failed',
              {
                responseStatus: response.status,
                responseBody: responseBody.slice(0, 1000),
                errorMessage: `HTTP ${response.status}`,
              }
            );
            if (!shouldRetry) results.failed++;
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          const shouldRetry = delivery.attempts < webhook.retry_count;
          await webhookService.updateDeliveryStatus(
            delivery.id,
            shouldRetry ? 'retrying' : 'failed',
            {
              errorMessage: fetchError.name === 'AbortError' ? 'Request timeout' : fetchError.message,
            }
          );
          if (!shouldRetry) results.failed++;
        }
      } catch (deliveryError) {
        console.error(`[WebhookWorker] Failed to process delivery ${delivery.id}:`, deliveryError);
        results.failed++;
      }
    }
  } catch (error) {
    console.error('[WebhookWorker] Failed to process deliveries:', error);
  }

  return results;
}
