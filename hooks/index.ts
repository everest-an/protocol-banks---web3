// Core hooks
export { useToast, toast } from "./use-toast"
export { useMobile } from "./use-mobile"
export { useMediaQuery } from "./use-media-query"

// Auth and user hooks
export { useAuth } from "./use-auth"

// Balance and token hooks
export { useBalance } from "./use-balance"
export { useTokenPrices } from "./use-token-prices"

// Payment hooks
export { useBatchPayment } from "./use-batch-payment"
export { useBatchTransfer } from "./use-batch-transfer"
export { usePaymentHistory } from "./use-payment-history"

// Vendor and dashboard hooks
export { useVendors } from "./use-vendors"
export { useDashboardActivity } from "./use-dashboard-activity"

// Security hooks
export { useSecurityCheck } from "./use-security-check"
export { useClientSecurity } from "./use-client-security"
export { useSecurityMonitor } from "./use-security-monitor"

// Integration hooks
export { useX402 } from "./use-x402"
export { useOfframp } from "./use-offramp"
export { useWebhooks } from "./use-webhooks"
export { useApiKeys } from "./use-api-keys"

// Subscriptions
export { useSubscriptions } from "./use-subscriptions"
export { useMCPSubscriptions } from "./use-mcp-subscriptions"
export { useMonetizeConfig } from "./use-monetize-config"

// Audit and logging
export { useAuditLog } from "./use-audit-log"

// Invoice and merchant tools
export { useInvoice } from "./use-invoice"

// Payment confirmation with biometric and security
export { usePaymentConfirmation } from "./use-payment-confirmation"

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
