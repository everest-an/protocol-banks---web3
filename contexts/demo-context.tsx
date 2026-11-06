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
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoModeBlocked, setDemoModeBlocked] = useState(false)
  const [demoBlockReason, setDemoBlockReason] = useState<string | null>(null)
  const [walletConnected, setWalletConnectedState] = useState(false)

  useEffect(() => {
    let hasSavedWallet = false
    try {
      const saved = JSON.parse(localStorage.getItem("connected_wallets") || "{}")
      hasSavedWallet = Object.values(saved).some(Boolean)
    } catch {
      hasSavedWallet = false
    }
    if (hasSavedWallet) {
      setIsDemoMode(false)
      localStorage.setItem(TEST_MODE_STORAGE_KEY, "false")
      return
    }
    const stored = localStorage.getItem(TEST_MODE_STORAGE_KEY)
    setIsDemoMode(stored === null ? true : stored === "true")
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
      // Wallet connected, switch to real mode and persist to localStorage
      setIsDemoMode(false)
      localStorage.setItem(TEST_MODE_STORAGE_KEY, "false")
    } else {
      // Wallet disconnected, auto-enable test mode
      setIsDemoMode(true)
      localStorage.setItem(TEST_MODE_STORAGE_KEY, "true")
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
