/**
 * Protocol Banks Type Definitions
 * 
 * Centralized exports for all TypeScript types used in the application.
 * Import from "@/types" for cleaner imports.
 */

// ============================================
// Core Domain Types
// ============================================
export * from "./vendor"
export * from "./payment"
export * from "./subscription"
export * from "./balance"

// ============================================
// Database Types (Generated from Supabase)
// ============================================
export type { Database, Tables, Enums } from "./supabase"

// ============================================
// Agent & Automation Types
// ============================================
export type {
  Agent,
  AgentType,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput,
  AutoExecuteRules,
} from "@/lib/services/agent-service"

export type {
  AgentProposal,
  ProposalStatus,
  CreateProposalInput,
} from "@/lib/services/proposal-service"

export type {
  AgentBudget,
  BudgetPeriod,
  CreateBudgetInput,
} from "@/lib/services/budget-service"

// ============================================
// Webhook & API Types
// ============================================
export type {
  Webhook,
  WebhookEvent,
  WebhookDelivery,
  CreateWebhookInput,
} from "@/lib/services/webhook-service"

export type {
  APIKey,
  CreateAPIKeyInput,
} from "@/lib/api-keys"

// ============================================
// Notification Types
// ============================================
export type {
  NotificationPreferences,
  NotificationPayload,
  NotificationType,
  PushSubscription,
} from "@/lib/services/notification-service"

// ============================================
// Multisig Types
// ============================================
export type {
  MultisigWallet,
  MultisigTransaction,
  CreateMultisigInput,
} from "@/lib/multisig"

// ============================================
// Payment Service Types
// ============================================
export type {
  PaymentBatch,
  PaymentEstimate,
} from "@/lib/services/payment-service"

// ============================================
// Logger Types
// ============================================
export type {
  LogLevel,
  LogContext,
  Logger,
} from "@/lib/logger"
