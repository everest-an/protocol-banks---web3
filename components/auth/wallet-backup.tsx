"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Copy, CheckCircle, AlertTriangle, Shield, Key } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WalletBackupProps {
  mnemonic: string
  recoveryCode: string
  walletAddress: string
  onComplete: () => void
}

export function WalletBackup({ mnemonic, recoveryCode, walletAddress, onComplete }: WalletBackupProps) {
  const [copiedMnemonic, setCopiedMnemonic] = useState(false)
  const [copiedRecovery, setCopiedRecovery] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const mnemonicWords = mnemonic.split(" ")

  const copyMnemonic = async () => {
    await navigator.clipboard.writeText(mnemonic)
    setCopiedMnemonic(true)
    setTimeout(() => setCopiedMnemonic(false), 2000)
  }

  const copyRecoveryCode = async () => {
    await navigator.clipboard.writeText(recoveryCode)
    setCopiedRecovery(true)
    setTimeout(() => setCopiedRecovery(false), 2000)
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
      {/* Success Header */}
      <div className="text-center mb-6">
        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Wallet Created!</h2>
        <p className="text-white/60 text-sm font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">Save your recovery phrase</p>
            <p className="text-amber-400/70 text-xs mt-1">
              This is the only way to recover your wallet if you lose access. Store it securely offline.
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Phrase */}
      <div className="bg-white/5 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Recovery Phrase</span>
          </div>
          <button
            onClick={copyMnemonic}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
          >
            {copiedMnemonic ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {mnemonicWords.map((word, index) => (
            <div key={index} className="bg-black/30 rounded-lg px-2 py-1.5 text-center">
              <span className="text-white/30 text-xs mr-1">{index + 1}.</span>
              <span className="text-white text-sm font-mono">{word}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recovery Code */}
      <div className="bg-white/5 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Recovery Code</span>
          </div>
          <button
            onClick={copyRecoveryCode}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
          >
            {copiedRecovery ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <p className="text-center font-mono text-lg text-cyan-400 tracking-wider">{recoveryCode}</p>
      </div>

      {/* Confirmation Checkbox */}
      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-white/60 text-sm">
          I have saved my recovery phrase and recovery code in a secure location. I understand that losing these means
          losing access to my wallet.
        </span>
      </label>

      {/* Continue Button */}
      <Button
        onClick={onComplete}
        className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
        disabled={!confirmed}
      >
        I've saved my backup
      </Button>
    </motion.div>
  )
}
