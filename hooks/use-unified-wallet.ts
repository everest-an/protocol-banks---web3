"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { useAppKitAccount } from "@reown/appkit/react"
import { useAuth } from "@/contexts/auth-provider"

/**
 * Unified wallet hook that aggregates all 3 connection sources:
 * 1. Reown AppKit (social/email login, hardware wallets)
 * 2. Web3Context (direct MetaMask/injected wallet)
 * 3. Auth Provider (email auth with embedded Shamir wallet)
 *
 * Use this instead of useWeb3() alone to ensure all connection methods work.
 */
export function useUnifiedWallet() {
  const {
    isConnected: isWeb3Connected,
    wallet,
    wallets,
    activeChain,
    connectWallet,
    disconnectWallet,
    chainId,
    isConnecting,
    signMessage,
    sendToken,
    signERC3009Authorization,
    switchNetwork,
    refreshBalances,
    isSupportedNetwork,
    usdtBalance,
    usdcBalance,
    daiBalance,
  } = useWeb3()

  const { address: reownAddress, isConnected: isReownConnected } = useAppKitAccount()
  const { isAuthenticated, user } = useAuth()

  const authWalletAddress = user?.walletAddress

  // Aggregated connection state (matches header UnifiedWalletButton logic)
  const isConnected = isWeb3Connected || isReownConnected || isAuthenticated
  const address = reownAddress || wallets[activeChain] || authWalletAddress || wallet || undefined

  return {
    // Unified state
    isConnected,
    address,

    // Individual connection states (for advanced use)
    isWeb3Connected,
    isReownConnected,
    isAuthenticated,

    // Pass-through from Web3Context
    wallets,
    activeChain,
    connectWallet,
    disconnectWallet,
    chainId,
    isConnecting,
    signMessage,
    sendToken,
    signERC3009Authorization,
    switchNetwork,
    refreshBalances,
    isSupportedNetwork,
    usdtBalance,
    usdcBalance,
    daiBalance,
  }
}
