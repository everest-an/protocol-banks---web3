/**
 * ProtocolBanks MCP Server
 * 
 * MCP Server for AI Agent subscription payments via x402 protocol.
 * 
 * @packageDocumentation
 */

import { PaidServer, createPaidServer } from './server';
import type { MCPServerConfig } from './types';

// Core exports
export { PaidServer, createPaidServer } from './server';
export { 
  PaymentHandler, 
  createPaymentHandler,
  is402Response,
  extractPaymentRequirement,
  formatPaymentAmount,
} from './handler';
export { Logger, createLogger, defaultLogger } from './utils/logger';

// Service exports
export {
  SubscriptionService,
  createSubscriptionService,
  type SubscriptionServiceConfig,
} from './services/subscription.service';

export {
  PaymentService,
  PaymentError,
  createPaymentService,
  parsePrice,
  toUSDCUnits,
  fromUSDCUnits,
  isAmountSufficient,
  type PaymentServiceConfig,
  type PaymentPayload,
  type VerifyResult,
  type SettleResult,
} from './services/payment.service';

// Tool exports
export { registerSubscriptionTools } from './tools/subscriptions';

// Validation exports
export {
  ValidationError,
  isValidEthereumAddress,
  validateEthereumAddress,
  isValidAmount,
  validateAmount,
  validateAmountLimits,
  isNonEmptyString,
  validateRequiredString,
  isValidUUID,
  validateUUID,
  isValidNetwork,
  validateNetwork,
  isValidToken,
  validateToken,
  validatePaymentParams,
  validateSubscriptionParams,
  sanitizeString,
  sanitizeAddress,
} from './utils/validation';

// Error exports
export {
  MCPBaseError,
  PaymentRequiredError,
  PaymentInvalidError,
  PaymentExpiredError,
  PaymentInsufficientError,
  SubscriptionNotFoundError,
  PlanNotFoundError,
  InvalidWalletAddressError,
  InvalidParametersError,
  RateLimitedError,
  DatabaseError,
  InternalError,
  createErrorResponse,
  isMCPError,
  getErrorCode,
  getErrorMessage,
  getErrorDescription,
  ERROR_DESCRIPTIONS,
} from './utils/errors';

// Pricing exports
export {
  PricingCalculator,
  createPricingCalculator,
  formatPriceForDisplay,
  comparePrices,
  AI_PRICING_RULES,
  type PricingRule,
  type DynamicPriceParams,
  type PriceCalculation,
} from './utils/pricing';

// Type exports
export type {
  // Subscription types
  SubscriptionPlan,
  SubscriptionInterval,
  UserSubscription,
  UserSubscriptionWithPlan,
  SubscriptionStatus,
  
  // Payment types
  PaymentRecord,
  PaymentStatus,
  PaymentRequirement,
  
  // Configuration types
  MCPServerConfig,
  EVMRecipient,
  FacilitatorConfig,
  PaidToolConfig,
  
  // Tool types
  ToolDefinition,
  ToolHandler,
  ToolResponse,
  ToolResponseContent,
  
  // Error types
  MCPError,
  MCPErrorCode,
  
  // Response types
  PaymentRequiredResponse,
  ErrorResponse,
  SuccessResponse,
  
  // Database types
  DBSubscriptionPlan,
  DBUserSubscription,
  DBPaymentRecord,
  
  // Utility types
  LogLevel,
  LoggerConfig,
} from './types';

/**
 * Create a paid MCP handler with the given setup function and configuration.
 * 
 * @example
 * ```typescript
 * import { createPaidHandler } from '@protocolbanks/mcp-server';
 * 
 * const server = createPaidHandler(
 *   (server) => {
 *     server.tool('list_items', 'List all items', {}, async () => {
 *       return { items: [] };
 *     });
 *     
 *     server.paidTool('premium_feature', 'Premium feature', '$0.01', {}, async () => {
 *       return { result: 'success' };
 *     });
 *   },
 *   {
 *     name: 'my-mcp-server',
 *     version: '1.0.0',
 *     recipient: {
 *       evm: { address: '0x...', isTestnet: false },
 *     },
 *   }
 * );
 * ```
 */
export function createPaidHandler(
  setupFn: (server: PaidServer) => void | Promise<void>,
  config: MCPServerConfig
): PaidServer {
  const server = createPaidServer(config);
  setupFn(server);
  return server;
}

/** Package version */
export const VERSION = '0.1.0';
