"use client"

import { useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"

/**
 * Syncs wallet connection state with demo mode context.
 * When a wallet is connected, demo mode is automatically disabled.
 * Renders nothing â€” placed in the products layout for global effect.
 */
export function WalletDemoSync() {
  const { isConnected } = useUnifiedWallet()
  const { setWalletConnected } = useDemo()

  useEffect(() => {
    if (isConnected) {
      setWalletConnected(true)
      return
    }
    let hasSavedWallet = false
    try {
      const saved = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
      hasSavedWallet = Object.values(saved).some(Boolean)
    } catch {
      hasSavedWallet = false
    }
    if (!hasSavedWallet) setWalletConnected(false)
  }, [isConnected, setWalletConnected])

  return null
}
