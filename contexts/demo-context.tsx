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

const TEST_MODE_STORAGE_KEY = "protocol-bank-test-mode"

export function DemoProvider({ children }: { children: ReactNode }) {
  // Default to test mode when no wallet is connected; restore from localStorage if available
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [demoModeBlocked, setDemoModeBlocked] = useState(false)
  const [demoBlockReason, setDemoBlockReason] = useState<string | null>(null)
  const [walletConnected, setWalletConnectedState] = useState(false)

  // Restore persisted test mode preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(TEST_MODE_STORAGE_KEY)
    if (stored !== null) {
      setIsDemoMode(stored === "true")
    }
  }, [])

  // Persist test mode changes to localStorage
  useEffect(() => {
    localStorage.setItem(TEST_MODE_STORAGE_KEY, String(isDemoMode))
  }, [isDemoMode])

  useEffect(() => {
    const allowDemoMode = process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE
    // Only completely disable test mode if explicitly set to "false"
    if (allowDemoMode === "false") {
      setDemoModeBlocked(true)
      setDemoBlockReason("Test mode is disabled in production")
      setIsDemoMode(false)
    }
  }, [])

  const setWalletConnected = (connected: boolean) => {
    setWalletConnectedState(connected)
    if (connected) {
      // Wallet connected, switch to real mode
      setIsDemoMode(false)
    } else {
      // Wallet disconnected, auto-enable test mode
      setIsDemoMode(true)
    }
  }

  const toggleDemoMode = () => {
    if (walletConnected && !isDemoMode) {
      console.warn("[v0] Cannot enable test mode when wallet is connected")
      return
    }

    const result = secureDemoModeToggle(
      isDemoMode,
      "client",
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    )

    if (!result.allowed) {
      console.warn("[v0] Test mode toggle blocked:", result.error)
      setDemoModeBlocked(true)
      setDemoBlockReason(result.error || "Test mode toggle not allowed")
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
