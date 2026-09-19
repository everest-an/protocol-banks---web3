"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { useToast } from "@/hooks/use-toast"
import { LandingPage } from "@/components/landing-page"

export default function HomePage() {
  const router = useRouter()
  const { isConnected, connectWallet, isMetaMaskInstalled } = useUnifiedWallet()
  const { toggleDemoMode } = useDemo()
  const { toast } = useToast()
  const connectingRef = useRef(false)

  // Redirect to AI trading cockpit after wallet connects from the landing page
  useEffect(() => {
    if (isConnected && connectingRef.current) {
      connectingRef.current = false
      router.push("/trading")
    }
  }, [isConnected, router])

  return (
    <LandingPage
      onConnectWallet={() => {
        // Same guard as the header button: never attempt EVM connect without
        // MetaMask — otherwise TronLink (if installed) hijacks the flow.
        if (!isMetaMaskInstalled) {
          toast({
            title: "Wallet not found",
            description: "Install MetaMask (or another injected EVM wallet) to continue.",
            variant: "destructive",
          })
          return
        }
        connectingRef.current = true
        connectWallet()
      }}
      onTryDemo={() => {
        toggleDemoMode()
        router.push("/trading")
      }}
    />
  )
}
