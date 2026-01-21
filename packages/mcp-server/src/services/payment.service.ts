/**
 * ProtocolBanks MCP Server - Payment Service
 * 
 * Handles payment verification and settlement via CDP Facilitator.
 */

import { MCPErrorCode } from '../types';
import { Logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface PaymentServiceConfig {
  facilitatorUrl?: string;
  relayerUrl?: string;
  network: 'base' | 'base-sepolia';
}

export interface PaymentPayload {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
  };
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export interface SettleResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Payment Service
// ============================================================================

export class PaymentService {
  private config: PaymentServiceConfig;
  private logger: Logger;

  constructor(config: PaymentServiceConfig) {
    this.config = config;
    this.logger = new Logger({ level: 'info', prefix: 'PaymentService' });
  }

  // ==========================================================================
  // Payment Verification
  // ==========================================================================

  /**
   * Verify a payment payload
   */
  async verifyPayment(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<VerifyResult> {
    this.logger.debug('Verifying payment', { 
      from: paymentPayload.authorization.from,
      amount: expectedAmount 
    });

    // Try CDP Facilitator first
    if (this.config.facilitatorUrl) {
      const result = await this.verifyWithFacilitator(paymentPayload, expectedAmount);
      if (result.valid) {
        return result;
      }
      this.logger.warn('CDP Facilitator verification failed, trying relayer');
    }

    // Fallback to relayer
    if (this.config.relayerUrl) {
      return this.verifyWithRelayer(paymentPayload, expectedAmount);
    }

    return {
      valid: false,
      error: 'No payment verification service configured',
      errorCode: 'PAYMENT_INVALID',
    };
  }

  /**
   * Verify payment with CDP Facilitator
   */
  private async verifyWithFacilitator(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<VerifyResult> {
    try {
      const response = await fetch(`${this.config.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements: {
            scheme: 'exact',
            network: this.config.network,
            maxAmountRequired: expectedAmount,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: error.message || 'Verification failed',
          errorCode: error.code,
        };
      }

      const result = await response.json();
      return {
        valid: result.valid === true,
        error: result.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Facilitator verification error: ${message}`);
      return {
        valid: false,
        error: message,
        errorCode: 'PAYMENT_INVALID',
      };
    }
  }

  /**
   * Verify payment with self-built relayer
   */
  private async verifyWithRelayer(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<VerifyResult> {
    try {
      const response = await fetch(`${this.config.relayerUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: paymentPayload,
          expectedAmount,
          network: this.config.network,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: error.message || 'Verification failed',
          errorCode: error.code,
        };
      }

      const result = await response.json();
      return {
        valid: result.valid === true,
        error: result.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Relayer verification error: ${message}`);
      return {
        valid: false,
        error: message,
        errorCode: 'PAYMENT_INVALID',
      };
    }
  }

  // ==========================================================================
  // Payment Settlement
  // ==========================================================================

  /**
   * Settle a payment on-chain
   */
  async settlePayment(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<SettleResult> {
    this.logger.info('Settling payment', {
      from: paymentPayload.authorization.from,
      amount: expectedAmount,
    });

    // Verify first
    const verifyResult = await this.verifyPayment(paymentPayload, expectedAmount);
    if (!verifyResult.valid) {
      return {
        success: false,
        error: verifyResult.error || 'Payment verification failed',
        errorCode: verifyResult.errorCode,
      };
    }

    // Try CDP Facilitator first
    if (this.config.facilitatorUrl) {
      const result = await this.settleWithFacilitator(paymentPayload, expectedAmount);
      if (result.success) {
        return result;
      }
      this.logger.warn('CDP Facilitator settlement failed, trying relayer');
    }

    // Fallback to relayer
    if (this.config.relayerUrl) {
      return this.settleWithRelayer(paymentPayload, expectedAmount);
    }

    return {
      success: false,
      error: 'No payment settlement service configured',
      errorCode: 'INTERNAL_ERROR',
    };
  }

  /**
   * Settle payment with CDP Facilitator
   */
  private async settleWithFacilitator(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<SettleResult> {
    try {
      const response = await fetch(`${this.config.facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements: {
            scheme: 'exact',
            network: this.config.network,
            maxAmountRequired: expectedAmount,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          error: error.message || 'Settlement failed',
          errorCode: error.code,
        };
      }

      const result = await response.json();
      return {
        success: true,
        transactionHash: result.transactionHash || result.txHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Facilitator settlement error: ${message}`);
      return {
        success: false,
        error: message,
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Settle payment with self-built relayer
   */
  private async settleWithRelayer(
    paymentPayload: PaymentPayload,
    expectedAmount: string
  ): Promise<SettleResult> {
    try {
      const response = await fetch(`${this.config.relayerUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: paymentPayload,
          expectedAmount,
          network: this.config.network,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          error: error.message || 'Settlement failed',
          errorCode: error.code,
        };
      }

      const result = await response.json();
      return {
        success: true,
        transactionHash: result.transactionHash || result.txHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Relayer settlement error: ${message}`);
      return {
        success: false,
        error: message,
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if CDP Facilitator is available
   */
  async isFacilitatorAvailable(): Promise<boolean> {
    if (!this.config.facilitatorUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.facilitatorUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current network
   */
  getNetwork(): string {
    return this.config.network;
  }

  /**
   * Check if using testnet
   */
  isTestnet(): boolean {
    return this.config.network === 'base-sepolia';
  }
}

// ============================================================================
// Payment Error
// ============================================================================

export class PaymentError extends Error {
  code: MCPErrorCode;

  constructor(code: MCPErrorCode, message: string) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPaymentService(config: PaymentServiceConfig): PaymentService {
  return new PaymentService(config);
}

// ============================================================================
// Amount Utilities
// ============================================================================

/**
 * Parse price string to numeric amount
 * Supports: "$0.001", "0.001 USDC", "0.001"
 */
export function parsePrice(price: string): string {
  const cleaned = price.replace(/[$\s]/g, '');
  const match = cleaned.match(/^([\d.]+)/);
  
  if (!match) {
    return '0';
  }
  
  const numericValue = match[1];
  const parsed = parseFloat(numericValue);
  
  if (isNaN(parsed) || parsed < 0) {
    return '0';
  }
  
  return numericValue;
}

/**
 * Convert USDC amount to smallest unit (6 decimals)
 */
export function toUSDCUnits(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.floor(num * 1_000_000).toString();
}

/**
 * Convert from USDC smallest unit to decimal
 */
export function fromUSDCUnits(units: string | number): string {
  const num = typeof units === 'string' ? parseInt(units, 10) : units;
  return (num / 1_000_000).toFixed(6);
}

/**
 * Compare two amounts (returns true if actual >= expected)
 */
export function isAmountSufficient(actual: string, expected: string): boolean {
  const actualNum = parseFloat(actual);
  const expectedNum = parseFloat(expected);
  
  if (isNaN(actualNum) || isNaN(expectedNum)) {
    return false;
  }
  
  // Allow small floating point tolerance
  return actualNum >= expectedNum - 0.000001;
}
