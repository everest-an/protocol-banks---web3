"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { secureDemoModeToggle } from "@/lib/cross-function-security"

interface DemoContextType {
  isDemoMode: boolean
  toggleDemoMode: () => void
  demoModeBlocked: boolean
  demoBlockReason: string | null
}

const DemoContext = createContext<DemoContextType | undefined>(undefined)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoModeBlocked, setDemoModeBlocked] = useState(false)
  const [demoBlockReason, setDemoBlockReason] = useState<string | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE) {
      setDemoModeBlocked(true)
      setDemoBlockReason("Demo mode is disabled in production")
      setIsDemoMode(false)
    }
  }, [])

  const toggleDemoMode = () => {
    const result = secureDemoModeToggle(
      isDemoMode,
      "client", // In real implementation, get from request
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
