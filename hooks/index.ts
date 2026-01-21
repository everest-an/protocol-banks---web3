// Core hooks
export { useToast, toast } from "./use-toast"
export { useMobile } from "./use-mobile"

// Payment hooks
export { useBatchPayment } from "./use-batch-payment"
export { usePaymentHistory } from "./use-payment-history"

// Security hooks
export { useSecurityCheck } from "./use-security-check"
export { useClientSecurity } from "./use-client-security"

// Integration hooks
export { useX402 } from "./use-x402"
export { useOfframp } from "./use-offramp"

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
