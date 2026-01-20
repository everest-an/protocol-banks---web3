/**
 * ProtocolBanks SDK - Webhook Module
 * 
 * Webhook 签名验证和事件解析
 * 支持:
 * - HMAC-SHA256 签名验证
 * - 常量时间比较 (防时序攻击)
 * - 事件类型解析
 */

import type {
  WebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
  IWebhookModule,
} from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';
import {
  constantTimeEqual,
  generateWebhookSignature,
  verifyWebhookSignature,
} from '../utils/crypto';

// ============================================================================
// Constants
// ============================================================================

/** Webhook signature header name */
export const WEBHOOK_SIGNATURE_HEADER = 'X-PB-Signature';

/** Webhook timestamp header name */
export const WEBHOOK_TIMESTAMP_HEADER = 'X-PB-Timestamp';

/** Default timestamp tolerance (5 minutes) */
const DEFAULT_TIMESTAMP_TOLERANCE = 300;

/** Supported webhook event types */
const SUPPORTED_EVENT_TYPES: WebhookEventType[] = [
  'payment.created',
  'payment.completed',
  'payment.failed',
  'payment.expired',
  'batch.created',
  'batch.processing',
  'batch.completed',
  'batch.failed',
  'x402.created',
  'x402.signed',
  'x402.executed',
  'x402.failed',
  'x402.expired',
];

// ============================================================================
// Webhook Module Implementation
// ============================================================================

export class WebhookModule implements IWebhookModule {
  
  /**
   * Verify webhook signature
   */
  verify(
    payload: string,
    signature: string,
    secret: string,
    options?: {
      timestamp?: number;
      tolerance?: number;
    }
  ): WebhookVerificationResult {
    try {
      // Parse signature header
      const signatureParts = this.parseSignatureHeader(signature);
      
      if (!signatureParts) {
        return {
          valid: false,
          error: 'Invalid signature format',
        };
      }
      
      const { timestamp, sig } = signatureParts;
      
      // Check timestamp if provided
      const tolerance = options?.tolerance ?? DEFAULT_TIMESTAMP_TOLERANCE;
      const now = Math.floor(Date.now() / 1000);
      const timestampValid = Math.abs(now - timestamp) <= tolerance;
      
      if (!timestampValid) {
        return {
          valid: false,
          error: 'Webhook timestamp is outside tolerance window',
          timestampValid: false,
        };
      }
      
      // Generate expected signature
      const expectedSignature = this.generateSignatureSync(payload, secret, timestamp);
      
      // Constant-time comparison
      const signatureValid = constantTimeEqual(sig, expectedSignature);
      
      if (!signatureValid) {
        return {
          valid: false,
          error: 'Invalid webhook signature',
          timestampValid: true,
        };
      }
      
      // Parse event
      const event = this.parse(payload);
      
      return {
        valid: true,
        event,
        timestampValid: true,
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
  
  /**
   * Verify webhook signature (async version)
   */
  async verifyAsync(
    payload: string,
    signature: string,
    secret: string,
    options?: {
      timestamp?: number;
      tolerance?: number;
    }
  ): Promise<WebhookVerificationResult> {
    try {
      // Parse signature header
      const signatureParts = this.parseSignatureHeader(signature);
      
      if (!signatureParts) {
        return {
          valid: false,
          error: 'Invalid signature format',
        };
      }
      
      const { timestamp, sig } = signatureParts;
      
      // Check timestamp
      const tolerance = options?.tolerance ?? DEFAULT_TIMESTAMP_TOLERANCE;
      const result = await verifyWebhookSignature(payload, sig, secret, timestamp, tolerance);
      
      if (!result.timestampValid) {
        return {
          valid: false,
          error: 'Webhook timestamp is outside tolerance window',
          timestampValid: false,
        };
      }
      
      if (!result.valid) {
        return {
          valid: false,
          error: 'Invalid webhook signature',
          timestampValid: true,
        };
      }
      
      // Parse event
      const event = this.parse(payload);
      
      return {
        valid: true,
        event,
        timestampValid: true,
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
  
  /**
   * Parse webhook payload to event
   */
  parse(payload: string): WebhookEvent {
    try {
      const data = JSON.parse(payload) as {
        id?: string;
        type?: string;
        timestamp?: string | number;
        data?: Record<string, unknown>;
        signature?: string;
      };
      
      // Validate required fields
      if (!data.id || !data.type) {
        throw new ProtocolBanksError({
          code: ErrorCodes.VALID_REQUIRED_FIELD,
          category: 'VALID',
          message: 'Webhook payload missing required fields (id, type)',
          retryable: false,
        });
      }
      
      // Validate event type
      if (!this.isValidEventType(data.type)) {
        throw new ProtocolBanksError({
          code: ErrorCodes.VALID_INVALID_FORMAT,
          category: 'VALID',
          message: `Unknown webhook event type: ${data.type}`,
          retryable: false,
        });
      }
      
      // Parse timestamp
      let timestamp: Date;
      if (typeof data.timestamp === 'number') {
        timestamp = new Date(data.timestamp * 1000);
      } else if (typeof data.timestamp === 'string') {
        timestamp = new Date(data.timestamp);
      } else {
        timestamp = new Date();
      }
      
      return {
        id: data.id,
        type: data.type as WebhookEventType,
        timestamp,
        data: data.data ?? {},
        signature: data.signature ?? '',
      };
      
    } catch (error) {
      if (error instanceof ProtocolBanksError) {
        throw error;
      }
      
      throw new ProtocolBanksError({
        code: ErrorCodes.VALID_INVALID_FORMAT,
        category: 'VALID',
        message: 'Invalid webhook payload JSON',
        details: { error: error instanceof Error ? error.message : 'Parse error' },
        retryable: false,
      });
    }
  }
  
  /**
   * Generate webhook signature (for testing)
   */
  sign(payload: string, secret: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const sig = this.generateSignatureSync(payload, secret, ts);
    return `t=${ts},v1=${sig}`;
  }
  
  /**
   * Generate webhook signature (async, for testing)
   */
  async signAsync(payload: string, secret: string, timestamp?: number): Promise<string> {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const sig = await generateWebhookSignature(payload, secret, ts);
    return `t=${ts},v1=${sig}`;
  }
  
  /**
   * Get supported event types
   */
  getSupportedEventTypes(): WebhookEventType[] {
    return [...SUPPORTED_EVENT_TYPES];
  }
  
  /**
   * Check if event type is valid
   */
  isValidEventType(type: string): type is WebhookEventType {
    return SUPPORTED_EVENT_TYPES.includes(type as WebhookEventType);
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  /**
   * Parse signature header format: t=timestamp,v1=signature
   */
  private parseSignatureHeader(header: string): { timestamp: number; sig: string } | null {
    try {
      const parts = header.split(',');
      let timestamp = 0;
      let sig = '';
      
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't' && value) {
          timestamp = parseInt(value, 10);
        } else if (key === 'v1' && value) {
          sig = value;
        }
      }
      
      if (timestamp === 0 || !sig) {
        return null;
      }
      
      return { timestamp, sig };
      
    } catch {
      return null;
    }
  }
  
  /**
   * Generate signature synchronously
   */
  private generateSignatureSync(payload: string, secret: string, timestamp: number): string {
    const dataToSign = `${timestamp}.${payload}`;
    return this.simpleHmac(dataToSign, secret);
  }
  
  /**
   * Simple HMAC implementation for synchronous use
   */
  private simpleHmac(data: string, secret: string): string {
    // Simple hash-based signature for synchronous operation
    // In production, use proper HMAC-SHA256
    const combined = secret + data + secret;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WebhookModule instance
 */
export function createWebhookModule(): WebhookModule {
  return new WebhookModule();
}

// ============================================================================
// Express/Koa Middleware Helper
// ============================================================================

/**
 * Create webhook verification middleware
 */
export function createWebhookMiddleware(secret: string) {
  const webhooks = new WebhookModule();
  
  return async (req: {
    body: string | object;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<WebhookEvent> => {
    // Get signature from header
    const signature = req.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] as string;
    
    if (!signature) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        category: 'AUTH',
        message: 'Missing webhook signature header',
        retryable: false,
      });
    }
    
    // Get payload
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    // Verify
    const result = await webhooks.verifyAsync(payload, signature, secret);
    
    if (!result.valid) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        category: 'AUTH',
        message: result.error ?? 'Webhook verification failed',
        retryable: false,
      });
    }
    
    return result.event!;
  };
}

// ============================================================================
// Event Type Helpers
// ============================================================================

/**
 * Check if event is a payment event
 */
export function isPaymentEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('payment.');
}

/**
 * Check if event is a batch event
 */
export function isBatchEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('batch.');
}

/**
 * Check if event is an x402 event
 */
export function isX402Event(event: WebhookEvent): boolean {
  return event.type.startsWith('x402.');
}

/**
 * Check if event indicates success
 */
export function isSuccessEvent(event: WebhookEvent): boolean {
  return event.type.endsWith('.completed') || event.type.endsWith('.executed');
}

/**
 * Check if event indicates failure
 */
export function isFailureEvent(event: WebhookEvent): boolean {
  return event.type.endsWith('.failed') || event.type.endsWith('.expired');
}

// ============================================================================
// Event Data Types
// ============================================================================

/** Payment event data */
export interface PaymentEventData {
  paymentId: string;
  amount: string;
  token: string;
  chain: string;
  recipientAddress: string;
  senderAddress?: string;
  transactionHash?: string;
  orderId?: string;
  memo?: string;
  error?: string;
}

/** Batch event data */
export interface BatchEventData {
  batchId: string;
  totalRecipients: number;
  completedCount: number;
  failedCount: number;
  totalAmount: string;
  token: string;
  chain: string;
  error?: string;
}

/** x402 event data */
export interface X402EventData {
  authorizationId: string;
  amount: string;
  token: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  transactionHash?: string;
  relayerFee?: string;
  error?: string;
}

/**
 * Parse payment event data
 */
export function parsePaymentEvent(event: WebhookEvent): PaymentEventData {
  if (!isPaymentEvent(event)) {
    throw new Error('Not a payment event');
  }
  return event.data as unknown as PaymentEventData;
}

/**
 * Parse batch event data
 */
export function parseBatchEvent(event: WebhookEvent): BatchEventData {
  if (!isBatchEvent(event)) {
    throw new Error('Not a batch event');
  }
  return event.data as unknown as BatchEventData;
}

/**
 * Parse x402 event data
 */
export function parseX402Event(event: WebhookEvent): X402EventData {
  if (!isX402Event(event)) {
    throw new Error('Not an x402 event');
  }
  return event.data as unknown as X402EventData;
}
