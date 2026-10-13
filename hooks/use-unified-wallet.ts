"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { useAuth } from "@/contexts/auth-provider"

/**
 * Unified wallet hook that aggregates connection sources:
 * 1. Web3Context (direct MetaMask/injected wallet)
 * 2. Auth Provider (email auth with embedded Shamir wallet)
 *
 * Reown AppKit was retired from the login flow — see lib/reown-safe.ts.
 */
export function useUnifiedWallet() {
  const {
    isConnected: isWeb3Connected,
    wallet,
    wallets,
    activeChain,
    setActiveChain,
    connectWallet,
    disconnectWallet,
    chainId,
    isConnecting,
    isMetaMaskInstalled,
    signer,
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

  const { isAuthenticated, user } = useAuth()

  // The auth session exposes the wallet under `walletAddress`, but some login
  // paths (SIWE restore/embedded flows) only populate `address` — reading just
  // one of them left authenticated users with no address, so the trading
  // cockpit fell back to the shared guest demo account (the "$520 while logged
  // in" bug). Accept either.
  const authWalletAddress = user?.walletAddress || user?.address

  // Aggregated connection state
  const isConnected = isWeb3Connected || isAuthenticated
  const address = wallets[activeChain] || authWalletAddress || wallet || undefined

  return {
    // Unified state
    isConnected,
    address,

    // Individual connection states (for advanced use)
    isWeb3Connected,
    isAuthenticated,

    // Pass-through from Web3Context
    wallets,
    activeChain,
    setActiveChain,
    connectWallet,
    disconnectWallet,
    chainId,
    isConnecting,
    isMetaMaskInstalled,
    signer,
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
