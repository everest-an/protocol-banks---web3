/**
 * ProtocolBanks MCP Server - Payment Handler
 * 
 * Generates and validates HTTP 402 Payment Required responses.
 */

import type {
  PaymentRequirement,
  PaymentRequiredResponse,
  ToolResponse,
  MCPServerConfig,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Default payment validity period (1 hour) */
const DEFAULT_VALIDITY_SECONDS = 3600;

/** Required fields in PaymentRequirement */
const REQUIRED_PAYMENT_FIELDS = [
  'version',
  'network',
  'paymentAddress',
  'amount',
  'token',
] as const;

// ============================================================================
// Payment Handler Class
// ============================================================================

export class PaymentHandler {
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Generate a 402 Payment Required response
   */
  generate402(
    amount: string,
    memo?: string,
    validitySeconds: number = DEFAULT_VALIDITY_SECONDS
  ): ToolResponse {
    const paymentRequirement = this.createPaymentRequirement(
      amount,
      memo,
      validitySeconds
    );

    const response: PaymentRequiredResponse = {
      status: 402,
      error: 'Payment Required',
      paymentRequired: paymentRequirement,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Generate a 402 response with custom error message
   */
  generate402WithError(
    amount: string,
    errorMessage: string,
    memo?: string
  ): ToolResponse {
    const paymentRequirement = this.createPaymentRequirement(amount, memo);

    const response: PaymentRequiredResponse = {
      status: 402,
      error: errorMessage,
      paymentRequired: paymentRequirement,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Create a PaymentRequirement object
   */
  createPaymentRequirement(
    amount: string,
    memo?: string,
    validitySeconds: number = DEFAULT_VALIDITY_SECONDS
  ): PaymentRequirement {
    return {
      version: '1.0',
      network: this.getNetwork(),
      paymentAddress: this.config.recipient.evm.address,
      amount,
      token: 'USDC',
      memo,
      validUntil: Math.floor(Date.now() / 1000) + validitySeconds,
    };
  }

  /**
   * Validate a PaymentRequirement object has all required fields
   */
  validatePaymentRequirement(requirement: Partial<PaymentRequirement>): boolean {
    for (const field of REQUIRED_PAYMENT_FIELDS) {
      if (!requirement[field]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a payment requirement has expired
   */
  isExpired(requirement: PaymentRequirement): boolean {
    if (!requirement.validUntil) {
      return false;
    }
    return Math.floor(Date.now() / 1000) > requirement.validUntil;
  }

  /**
   * Parse a 402 response to extract payment requirement
   */
  parse402Response(responseText: string): PaymentRequiredResponse | null {
    try {
      const parsed = JSON.parse(responseText);
      
      if (parsed.status !== 402 || !parsed.paymentRequired) {
        return null;
      }
      
      if (!this.validatePaymentRequirement(parsed.paymentRequired)) {
        return null;
      }
      
      return parsed as PaymentRequiredResponse;
    } catch {
      return null;
    }
  }

  /**
   * Get the network based on configuration
   */
  getNetwork(): string {
    return this.config.recipient.evm.isTestnet ? 'base-sepolia' : 'base';
  }

  /**
   * Get the payment address
   */
  getPaymentAddress(): string {
    return this.config.recipient.evm.address;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PaymentHandler instance
 */
export function createPaymentHandler(config: MCPServerConfig): PaymentHandler {
  return new PaymentHandler(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a response is a 402 Payment Required response
 */
export function is402Response(response: unknown): response is PaymentRequiredResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  
  const obj = response as Record<string, unknown>;
  return obj.status === 402 && typeof obj.paymentRequired === 'object';
}

/**
 * Extract payment requirement from a tool response
 */
export function extractPaymentRequirement(
  response: ToolResponse
): PaymentRequirement | null {
  if (!response.content || response.content.length === 0) {
    return null;
  }
  
  const content = response.content[0];
  if (content.type !== 'text' || !content.text) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(content.text);
    if (is402Response(parsed)) {
      return parsed.paymentRequired;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format payment amount for display
 */
export function formatPaymentAmount(amount: string, token: string = 'USDC'): string {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return `${amount} ${token}`;
  }
  
  // Format with appropriate decimal places
  if (num < 0.01) {
    return `${num.toFixed(6)} ${token}`;
  } else if (num < 1) {
    return `${num.toFixed(4)} ${token}`;
  } else {
    return `${num.toFixed(2)} ${token}`;
  }
}
