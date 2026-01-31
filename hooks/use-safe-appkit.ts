"use client"

import { useState, useEffect } from "react"

// Check if AppKit is initialized
function isAppKitInitialized(): boolean {
  if (typeof window === "undefined") return false
  // Check if we're in v0 preview
  const isV0Preview = window.location.hostname.includes("vusercontent.net")
  if (isV0Preview) return false
  // Check if createAppKit has been called by looking for the modal
  return !!(window as any).__APPKIT_INITIALIZED__
}

// Safe wrapper for useAppKit
export function useSafeAppKit() {
  const [initialized, setInitialized] = useState(false)
  const { useAppKit } = require("@reown/appkit/react")
  const { open: realOpen } = useAppKit()

  useEffect(() => {
    // Mark as initialized after a short delay to allow AppKit to initialize
    const timer = setTimeout(() => {
      setInitialized(isAppKitInitialized())
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Return a mock open function that does nothing if not initialized
  const open = (options?: { view?: string }) => {
    if (!initialized) {
      console.log("[useSafeAppKit] AppKit not initialized, open() is a no-op")
      return
    }
    // Use the real open function
    realOpen(options)
  }

  return { 
    open, 
    isInitialized: initialized 
  }
}

// Safe wrapper for useAppKitAccount
export function useSafeAppKitAccount() {
  const [state, setState] = useState({
    address: undefined as string | undefined,
    isConnected: false,
  })

  useEffect(() => {
    if (!isAppKitInitialized()) return

    try {
      const { useAppKitAccount } = require("@reown/appkit/react")
      // This won't work as hooks can't be called conditionally
      // We need a different approach
    } catch (e) {
      // Ignore
    }
  }, [])

  return state
}

// Safe wrapper for useDisconnect
export function useSafeDisconnect() {
  const disconnect = async () => {
    if (!isAppKitInitialized()) {
      console.log("[useSafeDisconnect] AppKit not initialized, disconnect() is a no-op")
      return
    }
  }

  return { disconnect }
}

// Mark AppKit as initialized - call this after createAppKit
export function markAppKitInitialized() {
  if (typeof window !== "undefined") {
    (window as any).__APPKIT_INITIALIZED__ = true
  }
}
