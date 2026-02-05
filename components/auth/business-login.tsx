"use client"

import { motion } from "framer-motion"
import { Mail, Wallet, Key, Lock, Fingerprint, ArrowRight } from "lucide-react"

export type BusinessConnectType = "hardware" | "email" | "wallet"

interface BusinessLoginProps {
  onConnect: (type: BusinessConnectType) => void
  isLoading?: boolean
}

export function BusinessLogin({ onConnect, isLoading = false }: BusinessLoginProps) {
  return (
    <motion.div
      key="business"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Enterprise Access</h2>
        <p className="text-white/60 text-sm">Infrastructure for global teams</p>
      </div>

      {/* Business Options */}
      <div className="space-y-3">
        {/* Hardware Wallet - Primary */}
        <button
          className="w-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 hover:from-amber-500/30 hover:to-amber-500/10 rounded-2xl p-4 transition-all group border border-amber-500/20 text-left disabled:opacity-50"
          onClick={() => onConnect("hardware")}
          disabled={isLoading}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Key className="h-7 w-7 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-lg">Hardware Wallet</p>
              <p className="text-sm text-white/60">Ledger, Trezor, GridPlus</p>
            </div>
            <ArrowRight className="h-6 w-6 text-amber-400/50 group-hover:text-amber-400 transition-colors flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-amber-400/70 text-xs">
            <Lock className="h-3 w-3" />
            <span>Maximum security for treasury</span>
          </div>
        </button>

        {/* Secondary Options Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Business Email */}
          <button
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group text-center disabled:opacity-50"
            onClick={() => onConnect("email")}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Business Email</p>
                <p className="text-xs text-white/50">Work account</p>
              </div>
            </div>
          </button>

          {/* Software Wallet */}
          <button
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group text-center disabled:opacity-50"
            onClick={() => onConnect("wallet")}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">EVM Wallet</p>
                <p className="text-xs text-white/50">MetaMask, etc.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Tron Wallet Option */}
        <button
          className="w-full bg-red-500/10 hover:bg-red-500/20 rounded-2xl p-3 transition-colors group text-left disabled:opacity-50 mt-3"
          onClick={() => onConnect("tron" as BusinessConnectType)}
          disabled={isLoading}
        >
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
               <span className="font-bold text-red-500 text-xs">TRX</span>
             </div>
             <div>
                <p className="font-medium text-white text-sm">Tron Network</p>
                <p className="text-xs text-white/50">Connect via TronLink</p>
             </div>
          </div>
        </button>
      </div>

      {/* Security Note */}
      <div className="mt-5 flex items-center gap-2 justify-center text-white/40 text-xs">
        <Fingerprint className="h-3 w-3" />
        <span>Multi-signature support available</span>
      </div>
    </motion.div>
  )
}
