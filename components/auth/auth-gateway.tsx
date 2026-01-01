"use client"

import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
import { AuthModal } from "./auth-modal"
import { AuthModeSwitcher, type AuthMode } from "./auth-mode-switcher"
import { PersonalLogin, type PersonalLoginMethod } from "./personal-login"
import { BusinessLogin, type BusinessConnectType } from "./business-login"

let usePrivy: () => { login: (options?: any) => void; authenticated: boolean; ready: boolean }
try {
  usePrivy = require("@privy-io/react-auth").usePrivy
} catch {
  // Fallback when Privy is not installed
  usePrivy = () => ({
    login: () => console.warn("[Auth] Privy not available"),
    authenticated: false,
    ready: false,
  })
}

interface AuthGatewayProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthGateway({ isOpen, onClose, onSuccess }: AuthGatewayProps) {
  const [mode, setMode] = useState<AuthMode>("personal")
  const [isLoading, setIsLoading] = useState(false)
  const { connectWallet, isConnected: isWeb3Connected } = useWeb3()
  const { setUserType } = useUserType()
  const { open: openAppKit } = useAppKit()
  const { isConnected: isReownConnected } = useAppKitAccount()

  const { login: privyLogin, authenticated: isPrivyAuthenticated, ready: isPrivyReady } = usePrivy()

  useEffect(() => {
    if (isOpen && (isWeb3Connected || isReownConnected || isPrivyAuthenticated)) {
      onSuccess?.()
      onClose()
    }
  }, [isWeb3Connected, isReownConnected, isPrivyAuthenticated, isOpen, onSuccess, onClose])

  const handlePersonalLogin = async (method: PersonalLoginMethod) => {
    setIsLoading(true)
    setUserType("web2")

    try {
      if (isPrivyReady && privyLogin) {
        if (method === "email") {
          privyLogin({ loginMethods: ["email"] })
        } else if (method === "google") {
          privyLogin({ loginMethods: ["google"] })
        } else if (method === "apple") {
          privyLogin({ loginMethods: ["apple"] })
        }
      } else {
        console.warn("[Auth] Privy not ready, falling back to Reown")
        openAppKit({ view: "Connect" })
      }
    } catch (error: any) {
      if (error?.code !== 4001 && !error?.message?.includes("rejected")) {
        console.error("Login error:", error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBusinessConnect = async (type: BusinessConnectType) => {
    setIsLoading(true)
    setUserType("web3")

    try {
      if (type === "hardware") {
        openAppKit({ view: "Connect" })
      } else if (type === "email") {
        if (isPrivyReady && privyLogin) {
          privyLogin({ loginMethods: ["email"] })
        } else {
          openAppKit({ view: "Connect" })
        }
      } else {
        await connectWallet("EVM")
      }
    } catch (error: any) {
      if (error?.code !== 4001 && !error?.message?.includes("rejected")) {
        console.error("Connection error:", error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthModal isOpen={isOpen} onClose={onClose} glowColor={mode === "personal" ? "cyan" : "amber"}>
      <AuthModeSwitcher mode={mode} onModeChange={setMode} />

      <AnimatePresence mode="wait">
        {mode === "personal" ? (
          <PersonalLogin onLogin={handlePersonalLogin} isLoading={isLoading} />
        ) : (
          <BusinessLogin onConnect={handleBusinessConnect} isLoading={isLoading} />
        )}
      </AnimatePresence>
    </AuthModal>
  )
}
