/**
 * Custom Hooks
 * SWR-based data fetching hooks for Protocol Banks
 *
 * Usage:
 * ```tsx
 * import { usePayments, useMerchants, useOrders } from "@/lib/hooks"
 *
 * function MyComponent() {
 *   const { payments, isLoading } = usePayments()
 *   const { merchants } = useMerchants()
 *   const { orders, mutate } = useOrders()
 *   // ...
 * }
 * ```
 */

// Payment Hooks
export {
  usePayments,
  useBatchPayments,
  usePaymentStats,
  usePayment,
  useCreatePayment,
  useUpdatePaymentTags,
  PAYMENTS_CACHE_KEY,
  BATCH_PAYMENTS_CACHE_KEY,
  PAYMENT_STATS_CACHE_KEY,
} from "./use-payments"

// Merchant Hooks
export {
  useMerchants,
  useMerchant,
  useCreateMerchant,
  useUpdateMerchant,
  useRegenerateApiKey,
  useMerchantStats,
  MERCHANTS_CACHE_KEY,
} from "./use-merchants"

// Order Hooks
export {
  useOrders,
  useOrder,
  useCreateOrder,
  useCancelOrder,
  useOrderStats,
  useCheckout,
  ORDERS_CACHE_KEY,
} from "./use-orders"

// Re-export types
export type { Merchant } from "./use-merchants"
export type { AcquiringOrder } from "./use-orders"
