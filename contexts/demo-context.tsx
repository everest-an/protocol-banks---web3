"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { secureDemoModeToggle } from "@/lib/security/cross-function-security"

interface DemoContextType {
  isDemoMode: boolean
  toggleDemoMode: () => void
  demoModeBlocked: boolean
  demoBlockReason: string | null
  setWalletConnected: (connected: boolean) => void
}

const DemoContext = createContext<DemoContextType | undefined>(undefined)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoModeBlocked, setDemoModeBlocked] = useState(false)
  const [demoBlockReason, setDemoBlockReason] = useState<string | null>(null)
  const [walletConnected, setWalletConnectedState] = useState(false)

  useEffect(() => {
    const allowDemoMode = process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE
    // Only completely disable demo mode if explicitly set to "false"
    if (allowDemoMode === "false") {
      setDemoModeBlocked(true)
      setDemoBlockReason("Demo mode is disabled in production")
      setIsDemoMode(false)
    }
  }, [])

  const setWalletConnected = (connected: boolean) => {
    setWalletConnectedState(connected)
    if (connected) {
      // Wallet connected, switch to real mode
      setIsDemoMode(false)
    }
  }

  const toggleDemoMode = () => {
    if (walletConnected && !isDemoMode) {
      console.warn("[v0] Cannot enable demo mode when wallet is connected")
      return
    }

    const result = secureDemoModeToggle(
      isDemoMode,
      "client",
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    )

    if (!result.allowed) {
      console.warn("[v0] Demo mode toggle blocked:", result.error)
      setDemoModeBlocked(true)
      setDemoBlockReason(result.error || "Demo mode toggle not allowed")
      return
    }

    setIsDemoMode((prev) => !prev)
    setDemoModeBlocked(false)
    setDemoBlockReason(null)
  }

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        demoModeBlocked,
        demoBlockReason,
        setWalletConnected,
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (context === undefined) {
    throw new Error("useDemo must be used within a DemoProvider")
  }
  return context
}
