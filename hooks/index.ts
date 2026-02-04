// Core hooks
export { useToast, toast } from "./use-toast"
// export { useMobile } from "./use-mobile" // File not found

// Payment hooks
export { useBatchPayment } from "./use-batch-payment"
export { usePaymentHistory } from "./use-payment-history"

// Security hooks
export { useSecurityCheck } from "./use-security-check"
export { useClientSecurity } from "./use-client-security"

// Integration hooks
export { useX402 } from "./use-x402"
export { useX402Payment } from "./use-x402-payment"
export { useOffRamp } from "./use-offramp"
export { useSubscription } from "./use-subscription"

// Audit and logging
export { useAuditLog } from "./use-audit-log"

// Invoice and merchant tools
export { useInvoice } from "./use-invoice"

// MCP and monetization hooks
export { useMCPSubscriptions } from "./use-mcp-subscriptions"
export { useMonetizeConfig } from "./use-monetize-config"

// Payment confirmation with biometric and security
export { usePaymentConfirmation } from "./use-payment-confirmation"

// Security monitoring
export { useSecurityMonitor } from "./use-security-monitor"

// Re-export useful utilities from lib for convenience
export {
  isValidEVMAddress,
  isValidPaymentAmount,
  createPaymentConfirmation,
  verifyTransactionParameters,
} from "@/lib/security/client-security"

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
export { calculateFee, recordFee } from "@/lib/protocol-fees"
