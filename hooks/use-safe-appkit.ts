"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// Check if we're in v0 preview environment
function isV0Preview(): boolean {
  if (typeof window === "undefined") return false
  return window.location.hostname.includes("vusercontent.net")
}

interface SafeAppKitState {
  address: string | undefined
  isConnected: boolean
  isReady: boolean
}

/**
 * Safe wrapper for AppKit that works in all environments
 * including v0 preview where AppKit is not initialized
 */
export function useSafeAppKit() {
  const [state, setState] = useState<SafeAppKitState>({
    address: undefined,
    isConnected: false,
    isReady: false,
  })
  const appKitRef = useRef<any>(null)

  useEffect(() => {
    // Skip in v0 preview or SSR
    if (isV0Preview() || typeof window === "undefined") {
      return
    }

    let mounted = true
    let intervalId: NodeJS.Timeout | null = null

    const init = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const appkitModule = await import("@reown/appkit/react")
        
        if (!mounted) return
        
        appKitRef.current = appkitModule
        
        // Poll for connection state (since we can't use hooks here)
        intervalId = setInterval(() => {
          try {
            // Access the modal state if available
            const modal = (appkitModule as any).modal
            if (modal) {
              const account = modal.getAccount?.()
              if (account) {
                setState({
                  address: account.address,
                  isConnected: account.isConnected || false,
                  isReady: true,
                })
              } else {
                setState(prev => ({ ...prev, isReady: true }))
              }
            } else {
              setState(prev => ({ ...prev, isReady: true }))
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 1000)
        
        setState(prev => ({ ...prev, isReady: true }))
      } catch (e) {
        console.log("[useSafeAppKit] Failed to load AppKit:", e)
      }
    }

    init()

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const open = useCallback(async (options?: { view?: string }) => {
    if (isV0Preview()) {
      console.log("[useSafeAppKit] AppKit not available in v0 preview")
      return
    }

    try {
      if (appKitRef.current) {
        const modal = (appKitRef.current as any).modal
        if (modal?.open) {
          await modal.open(options)
        }
      }
    } catch (e) {
      console.log("[useSafeAppKit] Failed to open modal:", e)
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (isV0Preview()) {
      return
    }

    try {
      if (appKitRef.current) {
        const modal = (appKitRef.current as any).modal
        if (modal?.disconnect) {
          await modal.disconnect()
          setState({
            address: undefined,
            isConnected: false,
            isReady: true,
          })
        }
      }
    } catch (e) {
      console.log("[useSafeAppKit] Failed to disconnect:", e)
    }
  }, [])

  return {
    open,
    disconnect,
    address: state.address,
    isConnected: state.isConnected,
    isReady: state.isReady,
  }
}
