/**
 * Wallet Store
 * Centralized wallet state management using Zustand
 * Works alongside web3-context for a unified wallet experience
 */

import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

// ============================================
// Types
// ============================================

interface WalletBalance {
  token: string
  symbol: string
  balance: string
  balanceUSD: number
  decimals: number
}

interface WalletState {
  // Connection state
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean

  // Balances
  balances: WalletBalance[]
  isLoadingBalances: boolean
  lastBalanceUpdate: number | null

  // Recent addresses (for quick access)
  recentAddresses: string[]

  // Actions
  setWallet: (address: string | null, chainId?: number | null) => void
  setConnecting: (connecting: boolean) => void
  disconnect: () => void

  setBalances: (balances: WalletBalance[]) => void
  setLoadingBalances: (loading: boolean) => void

  addRecentAddress: (address: string) => void
  clearRecentAddresses: () => void

  // Derived
  getBalance: (symbol: string) => WalletBalance | undefined
  getTotalBalanceUSD: () => number
}

// ============================================
// Constants
// ============================================

const MAX_RECENT_ADDRESSES = 10

// ============================================
// Store
// ============================================

export const useWalletStore = create<WalletState>()(
  devtools(
    persist(
      (set, get) => ({
        // Connection state
        address: null,
        chainId: null,
        isConnected: false,
        isConnecting: false,

        // Balances
        balances: [],
        isLoadingBalances: false,
        lastBalanceUpdate: null,

        // Recent addresses
        recentAddresses: [],

        // Actions
        setWallet: (address, chainId = null) =>
          set({
            address,
            chainId,
            isConnected: !!address,
            isConnecting: false,
          }),

        setConnecting: (connecting) => set({ isConnecting: connecting }),

        disconnect: () =>
          set({
            address: null,
            chainId: null,
            isConnected: false,
            isConnecting: false,
            balances: [],
            lastBalanceUpdate: null,
          }),

        setBalances: (balances) =>
          set({
            balances,
            isLoadingBalances: false,
            lastBalanceUpdate: Date.now(),
          }),

        setLoadingBalances: (loading) => set({ isLoadingBalances: loading }),

        addRecentAddress: (address) =>
          set((state) => {
            const normalized = address.toLowerCase()
            const filtered = state.recentAddresses.filter(
              (a) => a.toLowerCase() !== normalized
            )
            return {
              recentAddresses: [address, ...filtered].slice(0, MAX_RECENT_ADDRESSES),
            }
          }),

        clearRecentAddresses: () => set({ recentAddresses: [] }),

        // Derived
        getBalance: (symbol) => {
          return get().balances.find(
            (b) => b.symbol.toUpperCase() === symbol.toUpperCase()
          )
        },

        getTotalBalanceUSD: () => {
          return get().balances.reduce((sum, b) => sum + b.balanceUSD, 0)
        },
      }),
      {
        name: "protocol-banks-wallet",
        partialize: (state) => ({
          recentAddresses: state.recentAddresses,
        }),
      }
    ),
    { name: "WalletStore" }
  )
)

// ============================================
// Selectors
// ============================================

export const selectAddress = (state: WalletState) => state.address
export const selectChainId = (state: WalletState) => state.chainId
export const selectIsConnected = (state: WalletState) => state.isConnected
export const selectIsConnecting = (state: WalletState) => state.isConnecting
export const selectBalances = (state: WalletState) => state.balances
export const selectIsLoadingBalances = (state: WalletState) => state.isLoadingBalances
export const selectRecentAddresses = (state: WalletState) => state.recentAddresses

// ============================================
// Utility
// ============================================

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
