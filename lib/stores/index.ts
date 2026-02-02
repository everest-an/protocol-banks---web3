/**
 * Zustand Stores
 * Centralized state management for Protocol Banks
 *
 * Usage:
 * ```tsx
 * import { useUIStore, useWalletStore } from "@/lib/stores"
 *
 * function MyComponent() {
 *   const { isLoading, setLoading } = useUIStore()
 *   const { address, isConnected } = useWalletStore()
 *   // ...
 * }
 * ```
 */

// UI Store
export {
  useUIStore,
  selectSidebarCollapsed,
  selectIsLoading,
  selectLoadingMessage,
  selectToasts,
  selectPreferredView,
  selectIsDemoMode,
} from "./ui-store"

// Wallet Store
export {
  useWalletStore,
  selectAddress,
  selectChainId,
  selectIsConnected,
  selectIsConnecting,
  selectBalances,
  selectIsLoadingBalances,
  selectRecentAddresses,
  formatAddress,
  isValidAddress,
} from "./wallet-store"

// Re-export types
export type { } from "./ui-store"
export type { } from "./wallet-store"
