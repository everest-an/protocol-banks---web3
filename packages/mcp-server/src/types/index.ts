/**
 * ProtocolBanks MCP Server - Type Definitions
 */

// ============================================================================
// Subscription Plan Types
// ============================================================================

/** Subscription interval type */
export type SubscriptionInterval = 'monthly' | 'yearly' | 'one-time';

/** Subscription plan definition */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;           // USDC amount, e.g., "9.99"
  token: string;           // Token symbol, e.g., "USDC"
  interval: SubscriptionInterval;
  features: string[];
  maxApiCalls?: number;    // API call limit per period
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// User Subscription Types
// ============================================================================

/** Subscription status */
export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired';

/** User subscription record */
export interface UserSubscription {
  id: string;
  userId: string;          // Wallet address
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

/** User subscription with plan details */
export interface UserSubscriptionWithPlan extends UserSubscription {
  plan: SubscriptionPlan;
  paymentHistory: PaymentRecord[];
}

// ============================================================================
// Payment Types
// ============================================================================

/** Payment status */
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

/** Payment record */
export interface PaymentRecord {
  id: string;
  subscriptionId: string;
  amount: string;
  token: string;
  txHash: string;
  network: string;
  timestamp: string;
  status: PaymentStatus;
}

/** 402 Payment requirement */
export interface PaymentRequirement {
  version: string;
  network: string;
  paymentAddress: string;
  amount: string;
  token: string;
  memo?: string;
  validUntil?: number;
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

/** EVM recipient configuration */
export interface EVMRecipient {
  address: string;
  isTestnet?: boolean;
}

/** Facilitator configuration */
export interface FacilitatorConfig {
  url: string;
}

/** MCP Server configuration */
export interface MCPServerConfig {
  name: string;
  version: string;
  recipient: {
    evm: EVMRecipient;
  };
  facilitator?: FacilitatorConfig;
  supabaseUrl?: string;
  supabaseKey?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/** Tool handler function */
export type ToolHandler<T = unknown, R = unknown> = (args: T) => Promise<R>;

/** Tool definition */
export interface ToolDefinition<T = unknown, R = unknown> {
  name: string;
  description: string;
  inputSchema: object;
  handler: ToolHandler<T, R>;
  isPaid: boolean;
  price?: string;
}

/** Tool response content */
export interface ToolResponseContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** Tool response */
export interface ToolResponse {
  content: ToolResponseContent[];
  isError?: boolean;
}

/** Paid tool configuration */
export interface PaidToolConfig {
  price: string;           // e.g., "$0.001" or "0.001 USDC"
  recipient?: string;      // Override default recipient
  network?: string;        // Default "base"
  token?: string;          // Default "USDC"
  description?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/** MCP Error codes */
export enum MCPErrorCode {
  // Payment related
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_INVALID = 'PAYMENT_INVALID',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAYMENT_INSUFFICIENT = 'PAYMENT_INSUFFICIENT',
  
  // Subscription related
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  
  // Validation related
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // System related
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/** MCP Error structure */
export interface MCPError {
  code: MCPErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// API Response Types
// ============================================================================

/** 402 Response structure */
export interface PaymentRequiredResponse {
  status: 402;
  error: string;
  paymentRequired: PaymentRequirement;
}

/** Error response structure */
export interface ErrorResponse {
  error: true;
  code: MCPErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Success response structure */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

// ============================================================================
// Database Types (Supabase)
// ============================================================================

/** Database subscription plan row */
export interface DBSubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  token: string;
  interval: SubscriptionInterval;
  features: string[];
  max_api_calls: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Database user subscription row */
export interface DBUserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

/** Database payment record row */
export interface DBPaymentRecord {
  id: string;
  subscription_id: string;
  amount: number;
  token: string;
  tx_hash: string | null;
  network: string;
  status: PaymentStatus;
  created_at: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Log level */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Logger configuration */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  sensitiveFields?: string[];
}
