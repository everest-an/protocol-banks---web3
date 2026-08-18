"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { LandingPage } from "@/components/landing-page"

export default function HomePage() {
  const router = useRouter()
  const { isConnected, connectWallet } = useUnifiedWallet()
  const { toggleDemoMode } = useDemo()
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
