"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-provider"
import { PinSetup } from "@/components/auth/pin-setup"
import { WalletBackup } from "@/components/auth/wallet-backup"
import { useState } from "react"

export default function SetupPinPage() {
  const router = useRouter()
  const { isAuthenticated, hasWallet, isLoading, createWallet } = useAuth()
  const [isPinLoading, setIsPinLoading] = useState(false)
  const [backupData, setBackupData] = useState<{
    mnemonic: string
    recoveryCode: string
    address: string
  } | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/")
    }
    if (!isLoading && isAuthenticated && hasWallet && !backupData) {
      router.push("/")
    }
  }, [isAuthenticated, hasWallet, isLoading, router, backupData])

  const handlePinSetup = async (pin: string) => {
    setIsPinLoading(true)
    try {
      const result = await createWallet(pin)
      if (!result.success) {
        throw new Error(result.error)
      }
      setBackupData({
        mnemonic: result.mnemonic!,
        recoveryCode: result.recoveryCode!,
        address: result.address!,
      })
    } finally {
      setIsPinLoading(false)
    }
  }

  const handleBackupComplete = () => {
    router.push("/?login=success")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        {backupData ? (
          <WalletBackup
            mnemonic={backupData.mnemonic}
            recoveryCode={backupData.recoveryCode}
            walletAddress={backupData.address}
            onComplete={handleBackupComplete}
          />
        ) : (
          <PinSetup onSubmit={handlePinSetup} isLoading={isPinLoading} mode="setup" />
        )}
      </div>
    </div>
  )
}
