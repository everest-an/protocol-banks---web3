"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth"

interface PrivyProviderProps {
  children: ReactNode
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const [mounted, setMounted] = useState(false)
  const [hasError, setHasError] = useState(false)
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!appId || !mounted) {
    if (!appId) {
      console.warn("[Privy] NEXT_PUBLIC_PRIVY_APP_ID not set, Privy features disabled")
    }
    return <>{children}</>
  }

  if (hasError) {
    return <>{children}</>
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#06b6d4",
          logo: "/logo.png",
        },
        loginMethods: ["email", "google", "apple"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
      onError={(error) => {
        console.error("[Privy] Initialization error:", error)
        setHasError(true)
      }}
    >
      {children}
    </PrivyProviderBase>
  )
}
