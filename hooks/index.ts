/**
 * Protocol Banks Hooks
 * 
 * Centralized exports for all React hooks used in the application.
 * Import from "@/hooks" for cleaner imports.
 */

// ============================================
// Core Hooks
// ============================================
export { useToast, toast } from "./use-toast"
export { useMobile } from "./use-mobile"
export { useMediaQuery } from "./use-media-query"

// ============================================
// Auth & Wallet Hooks
// ============================================
export { useAuth } from "./use-auth"
export { useBalance } from "./use-balance"
export { useSafeAppkit } from "./use-safe-appkit"

// ============================================
// Payment Hooks
// ============================================
export { useBatchPayment } from "./use-batch-payment"
export { useBatchTransfer } from "./use-batch-transfer"
export { usePaymentHistory } from "./use-payment-history"
export { usePaymentConfirmation } from "./use-payment-confirmation"

// ============================================
// Subscription & Recurring Payment Hooks
// ============================================
export { useSubscriptions } from "./use-subscriptions"
export { useMCPSubscriptions } from "./use-mcp-subscriptions"

// ============================================
// Security Hooks
// ============================================
export { useSecurityCheck } from "./use-security-check"
export { useClientSecurity } from "./use-client-security"
export { useSecurityMonitor } from "./use-security-monitor"

// ============================================
// Integration Hooks (X402, Off-ramp, etc.)
// ============================================
export { useX402 } from "./use-x402"
export { useOfframp } from "./use-offramp"
export { useRainCard } from "./use-rain-card"

// ============================================
// Developer & API Hooks
// ============================================
export { useApiKeys } from "./use-api-keys"
export { useWebhooks } from "./use-webhooks"
export { useMonetizeConfig } from "./use-monetize-config"

// ============================================
// Business & Analytics Hooks
// ============================================
export { useAuditLog } from "./use-audit-log"
export { useInvoice } from "./use-invoice"
export { useVendors } from "./use-vendors"
export { useDashboardActivity } from "./use-dashboard-activity"
export { useTokenPrices } from "./use-token-prices"

// Re-export useful utilities from lib for convenience
export {
  isValidEVMAddress,
  isValidPaymentAmount,
  createPaymentConfirmation,
  verifyTransactionParameters,
} from "@/lib/client-security"

export {
  categorizeTransaction,
  calculateMonthlyBurnRate,
  calculateRunway,
  getTopCategories,
  CATEGORIES,
  CATEGORY_COLORS,
} from "@/lib/business-logic"

// Token and chain configuration
export {
  SUPPORTED_CHAINS,
  COMMON_TOKENS,
  getTokensForChain,
  getChainInfo,
  type SupportedChainId,
} from "@/lib/tokens"

// Protocol fees
export { calculateFee, recordFee, getProtocolFeeAddress } from "@/lib/protocol-fees"
