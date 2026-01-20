/**
 * ProtocolBanks SDK - Batch Payment Module
 * 
 * 批量支付，支持:
 * - 批量验证 (最多 500 收款人)
 * - 批量提交
 * - 状态追踪
 * - 失败重试
 */

import type {
  BatchRecipient,
  BatchValidationError,
  BatchSubmitResult,
  BatchStatus,
  BatchItemStatus,
  BatchOptions,
  ChainId,
  TokenSymbol,
  IBatchModule,
} from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';
import { generateUUID } from '../utils/crypto';
import {
  isValidAddress,
  isValidAmount,
  isValidToken,
  validateBatchSize,
  detectHomoglyphs,
} from '../utils/validation';
import { MAX_BATCH_SIZE, getTokenDecimals, parseAmount } from '../config/chains';
import type { HttpClient } from '../utils/http';

// ============================================================================
// Batch Module Implementation
// ============================================================================

export class BatchModule implements IBatchModule {
  private http: HttpClient;
  private batches: Map<string, BatchStatus> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(http: HttpClient) {
    this.http = http;
  }
  
  // ============================================================================
  // Public Methods
  // ============================================================================
  
  /**
   * Validate batch recipients
   * Returns errors for ALL invalid entries (not just first)
   */
  async validate(recipients: BatchRecipient[]): Promise<BatchValidationError[]> {
    const errors: BatchValidationError[] = [];
    
    // Check batch size
    if (recipients.length > MAX_BATCH_SIZE) {
      throw new ProtocolBanksError({
        code: ErrorCodes.BATCH_SIZE_EXCEEDED,
        category: 'BATCH',
        message: `Batch size ${recipients.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
        details: { size: recipients.length, maxSize: MAX_BATCH_SIZE },
        retryable: false,
      });
    }
    
    if (recipients.length === 0) {
      throw new ProtocolBanksError({
        code: ErrorCodes.BATCH_VALIDATION_FAILED,
        category: 'BATCH',
        message: 'Batch cannot be empty',
        retryable: false,
      });
    }
    
    // Validate each recipient
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]!;
      const recipientErrors: string[] = [];
      
      // Validate address
      if (!recipient.address) {
        recipientErrors.push('Address is required');
      } else {
        // Check for homoglyphs
        const homoglyphDetails = detectHomoglyphs(recipient.address);
        if (homoglyphDetails) {
          recipientErrors.push('Address contains suspicious characters (possible homoglyph attack)');
        } else if (!isValidAddress(recipient.address)) {
          recipientErrors.push('Invalid address format');
        }
      }
      
      // Validate amount
      if (!recipient.amount) {
        recipientErrors.push('Amount is required');
      } else if (!isValidAmount(recipient.amount)) {
        recipientErrors.push('Invalid amount (must be positive, max 1 billion)');
      }
      
      // Validate token
      if (!recipient.token) {
        recipientErrors.push('Token is required');
      } else if (!isValidToken(recipient.token)) {
        recipientErrors.push(`Unsupported token: ${recipient.token}`);
      }
      
      // Validate memo length
      if (recipient.memo && recipient.memo.length > 256) {
        recipientErrors.push('Memo exceeds maximum length of 256 characters');
      }
      
      // Add errors if any
      if (recipientErrors.length > 0) {
        errors.push({
          index: i,
          address: recipient.address || '',
          errors: recipientErrors,
        });
      }
    }
    
    // Check for duplicate addresses
    const addressCounts = new Map<string, number[]>();
    for (let i = 0; i < recipients.length; i++) {
      const address = recipients[i]!.address?.toLowerCase();
      if (address) {
        const indices = addressCounts.get(address) ?? [];
        indices.push(i);
        addressCounts.set(address, indices);
      }
    }
    
    for (const [address, indices] of addressCounts) {
      if (indices.length > 1) {
        // Add warning for duplicates (not error, just warning)
        for (const index of indices) {
          const existing = errors.find(e => e.index === index);
          if (existing) {
            existing.errors.push(`Duplicate address (appears ${indices.length} times)`);
          } else {
            errors.push({
              index,
              address,
              errors: [`Duplicate address (appears ${indices.length} times)`],
            });
          }
        }
      }
    }
    
    return errors.sort((a, b) => a.index - b.index);
  }
  
  /**
   * Submit batch payment
   */
  async submit(
    recipients: BatchRecipient[],
    options?: BatchOptions
  ): Promise<BatchSubmitResult> {
    // Validate batch
    const validationErrors = await this.validate(recipients);
    
    // Filter out warnings (duplicates) vs errors
    const criticalErrors = validationErrors.filter(e => 
      !e.errors.every(err => err.includes('Duplicate'))
    );
    
    if (criticalErrors.length > 0) {
      return {
        batchId: '',
        status: 'failed',
        validCount: recipients.length - criticalErrors.length,
        invalidCount: criticalErrors.length,
        errors: criticalErrors,
      };
    }
    
    // Generate batch ID
    const batchId = `batch_${generateUUID().replace(/-/g, '')}`;
    
    // Calculate total amount
    const totalAmount = recipients.reduce((sum, r) => {
      return sum + parseFloat(r.amount);
    }, 0);
    
    // Prepare batch items
    const items: BatchItemStatus[] = recipients.map((r, index) => ({
      index,
      address: r.address,
      amount: r.amount,
      status: 'pending' as const,
    }));
    
    // Create batch status
    const batchStatus: BatchStatus = {
      batchId,
      status: 'pending',
      progress: {
        total: recipients.length,
        completed: 0,
        failed: 0,
        pending: recipients.length,
      },
      items,
      totalAmount: totalAmount.toString(),
      createdAt: new Date(),
    };
    
    // Store locally
    this.batches.set(batchId, batchStatus);
    
    // Submit to backend
    try {
      const response = await this.http.post<BatchSubmitResult>('/batch/submit', {
        batchId,
        recipients: recipients.map(r => ({
          address: r.address,
          amount: r.amount,
          token: r.token,
          memo: r.memo,
          orderId: r.orderId,
        })),
        chain: options?.chain,
        priority: options?.priority ?? 'medium',
        webhookUrl: options?.webhookUrl,
        idempotencyKey: options?.idempotencyKey,
      });
      
      // Update local status
      batchStatus.status = response.status;
      
      return {
        batchId,
        status: response.status,
        validCount: recipients.length,
        invalidCount: 0,
        errors: [],
        estimatedFee: response.estimatedFee,
      };
      
    } catch (error) {
      batchStatus.status = 'failed';
      throw error;
    }
  }
  
  /**
   * Get batch status
   */
  async getStatus(batchId: string): Promise<BatchStatus> {
    // Check local cache first
    const localBatch = this.batches.get(batchId);
    
    // Fetch from backend
    try {
      const response = await this.http.get<BatchStatus>(`/batch/${batchId}`);
      
      // Update local cache
      if (localBatch) {
        Object.assign(localBatch, response);
      } else {
        this.batches.set(batchId, response);
      }
      
      return response;
      
    } catch (error) {
      // Return local state if available
      if (localBatch) {
        return localBatch;
      }
      
      throw new ProtocolBanksError({
        code: ErrorCodes.BATCH_NOT_FOUND,
        category: 'BATCH',
        message: `Batch ${batchId} not found`,
        retryable: false,
      });
    }
  }
  
  /**
   * Retry failed items in batch
   */
  async retry(batchId: string, itemIndices?: number[]): Promise<BatchSubmitResult> {
    const batch = await this.getStatus(batchId);
    
    // Check if batch can be retried
    if (batch.status === 'processing') {
      throw new ProtocolBanksError({
        code: ErrorCodes.BATCH_ALREADY_PROCESSING,
        category: 'BATCH',
        message: 'Batch is currently processing, cannot retry',
        retryable: false,
      });
    }
    
    // Get failed items
    const failedItems = batch.items.filter(item => 
      item.status === 'failed' && 
      (itemIndices === undefined || itemIndices.includes(item.index))
    );
    
    if (failedItems.length === 0) {
      return {
        batchId,
        status: batch.status as 'pending' | 'processing' | 'completed' | 'failed',
        validCount: 0,
        invalidCount: 0,
        errors: [],
      };
    }
    
    // Submit retry request
    const response = await this.http.post<BatchSubmitResult>(`/batch/${batchId}/retry`, {
      itemIndices: failedItems.map(i => i.index),
    });
    
    return response;
  }
  
  /**
   * Poll batch status with callback
   */
  poll(
    batchId: string,
    callback: (status: BatchStatus) => void,
    interval: number = 5000
  ): () => void {
    // Clear existing polling for this batch
    const existingInterval = this.pollingIntervals.get(batchId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Start polling
    const pollFn = async () => {
      try {
        const status = await this.getStatus(batchId);
        callback(status);
        
        // Stop polling if batch is complete
        if (this.isFinalStatus(status.status)) {
          this.stopPolling(batchId);
        }
      } catch (error) {
        // Continue polling on error
        console.warn(`Batch polling error for ${batchId}:`, error);
      }
    };
    
    // Initial poll
    pollFn();
    
    // Set up interval
    const intervalId = setInterval(pollFn, interval);
    this.pollingIntervals.set(batchId, intervalId);
    
    // Return stop function
    return () => this.stopPolling(batchId);
  }
  
  /**
   * Stop polling for a batch
   */
  stopPolling(batchId: string): void {
    const intervalId = this.pollingIntervals.get(batchId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(batchId);
    }
  }
  
  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const [batchId] of this.pollingIntervals) {
      this.stopPolling(batchId);
    }
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Calculate total amount for batch
   */
  calculateTotal(recipients: BatchRecipient[]): {
    byToken: Record<string, string>;
    totalUSD: string;
  } {
    const byToken: Record<string, number> = {};
    
    for (const recipient of recipients) {
      const amount = parseFloat(recipient.amount);
      if (!isNaN(amount)) {
        byToken[recipient.token] = (byToken[recipient.token] ?? 0) + amount;
      }
    }
    
    // Convert to string
    const byTokenStr: Record<string, string> = {};
    for (const [token, amount] of Object.entries(byToken)) {
      byTokenStr[token] = amount.toFixed(6);
    }
    
    // Estimate USD total (assuming stablecoins = $1)
    const stablecoins = ['USDC', 'USDT', 'DAI'];
    let totalUSD = 0;
    for (const [token, amount] of Object.entries(byToken)) {
      if (stablecoins.includes(token)) {
        totalUSD += amount;
      }
    }
    
    return {
      byToken: byTokenStr,
      totalUSD: totalUSD.toFixed(2),
    };
  }
  
  /**
   * Get batch progress percentage
   */
  getProgress(status: BatchStatus): number {
    if (status.progress.total === 0) return 0;
    return Math.round(
      ((status.progress.completed + status.progress.failed) / status.progress.total) * 100
    );
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private isFinalStatus(status: string): boolean {
    return ['completed', 'failed'].includes(status);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new BatchModule instance
 */
export function createBatchModule(http: HttpClient): BatchModule {
  return new BatchModule(http);
}
