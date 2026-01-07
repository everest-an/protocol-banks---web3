"use client"

import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useAuth } from "@/contexts/auth-provider"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
import { useSonicBranding } from "@/lib/sonic-branding"
import { AuthModal } from "./auth-modal"
import { AuthModeSwitcher, type AuthMode } from "./auth-mode-switcher"
import { PersonalLogin, type PersonalLoginMethod } from "./personal-login"
import { BusinessLogin, type BusinessConnectType } from "./business-login"
import { EmailInput } from "./email-input"
import { PinSetup } from "./pin-setup"
import { WalletBackup } from "./wallet-backup"

type AuthStep = "select" | "email" | "pin-setup" | "backup"

interface AuthGatewayProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthGateway({ isOpen, onClose, onSuccess }: AuthGatewayProps) {
  const [mode, setMode] = useState<AuthMode>("personal")
  const [step, setStep] = useState<AuthStep>("select")
  const [isLoading, setIsLoading] = useState(false)
  const [backupData, setBackupData] = useState<{
    mnemonic: string
    recoveryCode: string
    address: string
  } | null>(null)

  const { connectWallet, isConnected: isWeb3Connected } = useWeb3()
  const { setUserType } = useUserType()
  const { open: openAppKit } = useAppKit()
  const { isConnected: isReownConnected } = useAppKitAccount()
  const { isAuthenticated, hasWallet, needsPinSetup, sendMagicLink, createWallet, refreshSession } = useAuth()

  const { play } = useSonicBranding()

  // Check for successful login redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get("login") === "success") {
        refreshSession()
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [refreshSession])

  // Handle successful connection
  useEffect(() => {
    if (isOpen && (isWeb3Connected || isReownConnected)) {
      play("personal-success")
      onSuccess?.()
      onClose()
    }
  }, [isWeb3Connected, isReownConnected, isOpen, onSuccess, onClose, play])

  // Handle auth state changes
  useEffect(() => {
    if (isAuthenticated && needsPinSetup) {
      setStep("pin-setup")
    } else if (isAuthenticated && hasWallet) {
      play("personal-success")
      onSuccess?.()
      onClose()
    }
  }, [isAuthenticated, hasWallet, needsPinSetup, onSuccess, onClose, play])

  // Reset step when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("select")
      setBackupData(null)
    }
  }, [isOpen])

  const handlePersonalLogin = async (method: PersonalLoginMethod) => {
    setUserType("web2")

    if (method === "email") {
      setStep("email")
    } else if (method === "google") {
      // Redirect to Google OAuth
      window.location.href = "/api/auth/oauth/google"
    }
  }

  const handleEmailSubmit = async (email: string) => {
    setIsLoading(true)
    try {
      const result = await sendMagicLink(email)
      if (!result.success) {
        play("error")
        throw new Error(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinSetup = async (pin: string) => {
    setIsLoading(true)
    try {
      const result = await createWallet(pin)
      if (!result.success) {
        play("error")
        throw new Error(result.error)
      }

      play("personal-success")

      // Show backup screen
      setBackupData({
        mnemonic: result.mnemonic!,
        recoveryCode: result.recoveryCode!,
        address: result.address!,
      })
      setStep("backup")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackupComplete = () => {
    setBackupData(null)
    onSuccess?.()
    onClose()
  }

  const handleBusinessConnect = async (type: BusinessConnectType) => {
    setIsLoading(true)
    setUserType("web3")

    try {
      if (type === "hardware") {
        play("business-connect")
        openAppKit({ view: "Connect" })
      } else if (type === "email") {
        // Use our custom email auth for business too
        setStep("email")
      } else {
        play("business-connect")
        await connectWallet("EVM")
      }
    } catch (error: any) {
      if (error?.code !== 4001 && !error?.message?.includes("rejected")) {
        console.error("Connection error:", error)
        play("error")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (step) {
      case "email":
        return <EmailInput onSubmit={handleEmailSubmit} onBack={() => setStep("select")} isLoading={isLoading} />
      case "pin-setup":
        return <PinSetup onSubmit={handlePinSetup} isLoading={isLoading} mode="setup" />
      case "backup":
        return backupData ? (
          <WalletBackup
            mnemonic={backupData.mnemonic}
            recoveryCode={backupData.recoveryCode}
            walletAddress={backupData.address}
            onComplete={handleBackupComplete}
          />
        ) : null
      default:
        return (
          <>
            <AuthModeSwitcher mode={mode} onModeChange={setMode} />
            <AnimatePresence mode="wait">
              {mode === "personal" ? (
                <PersonalLogin onLogin={handlePersonalLogin} isLoading={isLoading} />
              ) : (
                <BusinessLogin onConnect={handleBusinessConnect} isLoading={isLoading} />
              )}
            </AnimatePresence>
          </>
        )
    }
  }

  return (
    <AuthModal isOpen={isOpen} onClose={onClose} glowColor={mode === "personal" ? "cyan" : "amber"}>
      {renderContent()}
    </AuthModal>
  )
}
