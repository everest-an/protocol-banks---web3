"use client"

/**
 * Auth Provider
 *
 * Replaces Privy with custom authentication
 * Supports Email Magic Link, Google, Apple login
 * Manages embedded wallet with Shamir secret sharing
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

let deviceStorage: typeof import("@/lib/auth/device-storage") | null = null

if (typeof window !== "undefined") {
  import("@/lib/auth/device-storage").then((module) => {
    deviceStorage = module
  })
}

export interface AuthUser {
  id: string
  email: string
  walletAddress?: string
}

export interface AuthContextType {
  // State
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasWallet: boolean
  needsPinSetup: boolean

  // Auth methods
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>

  // Wallet methods
  createWallet: (pin: string) => Promise<{
    success: boolean
    address?: string
    mnemonic?: string
    recoveryCode?: string
    error?: string
  }>
  signMessage: (message: string, pin: string) => Promise<{ success: boolean; signature?: string; error?: string }>
  signTransaction: (tx: any, pin: string) => Promise<{ success: boolean; signedTx?: string; error?: string }>

  // Refresh
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsPinSetup, setNeedsPinSetup] = useState(false)

  // Check session on mount
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session")

      if (!response.ok) {
        console.log("[Auth] Session check returned non-ok status:", response.status)
        setUser(null)
        setIsLoading(false)
        return
      }

      const data = await response.json()

      if (data.authenticated) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          walletAddress: data.user.walletAddress,
        })
        setNeedsPinSetup(!data.user.walletAddress)
      } else {
        setUser(null)
        setNeedsPinSetup(false)
      }
    } catch (error) {
      console.log("[Auth] Session check failed (this is normal on first load):", error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Send magic link
  const sendMagicLink = useCallback(async (email: string) => {
    try {
      const response = await fetch("/api/auth/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to send magic link" }
      }

      return { success: true }
    } catch (error) {
      console.error("[Auth] Send magic link failed:", error)
      return { success: false, error: "Network error" }
    }
  }, [])

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" })
      if (deviceStorage) {
        await deviceStorage.clearAllDeviceShares()
      }
      setUser(null)
      setNeedsPinSetup(false)
    } catch (error) {
      console.error("[Auth] Logout failed:", error)
    }
  }, [])

  // Create wallet
  const createWallet = useCallback(
    async (pin: string) => {
      if (!user) {
        return { success: false, error: "Not authenticated" }
      }

      try {
        const response = await fetch("/api/auth/wallet/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || "Failed to create wallet" }
        }

        if (deviceStorage) {
          await deviceStorage.storeDeviceShare(data.address, data.deviceShare)
        }

        // Update user state
        setUser((prev) => (prev ? { ...prev, walletAddress: data.address } : null))
        setNeedsPinSetup(false)

        return {
          success: true,
          address: data.address,
          mnemonic: data.mnemonic,
          recoveryCode: data.recoveryCode,
        }
      } catch (error) {
        console.error("[Auth] Create wallet failed:", error)
        return { success: false, error: "Network error" }
      }
    },
    [user],
  )

  // Sign message
  const signMessage = useCallback(
    async (message: string, pin: string) => {
      if (!user?.walletAddress) {
        return { success: false, error: "No wallet" }
      }

      try {
        let deviceShare = null
        if (deviceStorage) {
          deviceShare = await deviceStorage.getDeviceShare(user.walletAddress)
        }

        if (!deviceShare) {
          return { success: false, error: "Device share not found. Please recover your wallet." }
        }

        const response = await fetch("/api/auth/wallet/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin,
            type: "message",
            data: message,
            deviceShare,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || "Signing failed" }
        }

        return { success: true, signature: data.signature }
      } catch (error) {
        console.error("[Auth] Sign message failed:", error)
        return { success: false, error: "Network error" }
      }
    },
    [user],
  )

  // Sign transaction
  const signTransaction = useCallback(
    async (tx: any, pin: string) => {
      if (!user?.walletAddress) {
        return { success: false, error: "No wallet" }
      }

      try {
        let deviceShare = null
        if (deviceStorage) {
          deviceShare = await deviceStorage.getDeviceShare(user.walletAddress)
        }

        if (!deviceShare) {
          return { success: false, error: "Device share not found. Please recover your wallet." }
        }

        const response = await fetch("/api/auth/wallet/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin,
            type: "transaction",
            data: tx,
            deviceShare,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || "Signing failed" }
        }

        return { success: true, signedTx: data.signature }
      } catch (error) {
        console.error("[Auth] Sign transaction failed:", error)
        return { success: false, error: "Network error" }
      }
    },
    [user],
  )

  // Refresh session
  const refreshSession = useCallback(async () => {
    await checkSession()
  }, [checkSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        hasWallet: !!user?.walletAddress,
        needsPinSetup,
        sendMagicLink,
        logout,
        createWallet,
        signMessage,
        signTransaction,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
