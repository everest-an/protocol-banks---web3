"use client"

import { useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"

/**
 * Syncs wallet connection state with demo mode context.
 * When a wallet is connected, demo mode is automatically disabled.
 * Renders nothing — placed in the products layout for global effect.
 */
export function WalletDemoSync() {
  const { isConnected } = useUnifiedWallet()
  const { setWalletConnected } = useDemo()

  useEffect(() => {
    setWalletConnected(isConnected)
  }, [isConnected, setWalletConnected])

  return null
}
