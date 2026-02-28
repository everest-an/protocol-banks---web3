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
        <h2 className="text-2xl font-bold text-foreground mb-1">Enterprise Access</h2>
        <p className="text-muted-foreground text-sm">Infrastructure for global teams</p>
      </div>

      {/* Business Options */}
      <div className="space-y-3">
        {/* Hardware Wallet - Primary */}
        <button
          className="group relative w-full overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-50/60 dark:bg-amber-500/10 p-5 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:opacity-50"
          onClick={() => onConnect("hardware")}
          disabled={isLoading}
        >
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 dark:bg-amber-500/25">
              <Key className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-foreground">Hardware Wallet</p>
              <p className="text-sm text-muted-foreground">Ledger, Trezor, GridPlus</p>
            </div>
            <ArrowRight className="h-6 w-6 text-amber-500/50 group-hover:text-amber-500 transition-colors flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-amber-600/70 dark:text-amber-400/70 text-xs">
            <Lock className="h-3 w-3" />
            <span>Maximum security for treasury</span>
          </div>
        </button>

        {/* Secondary Options Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Business Email */}
          <button
            className="group relative rounded-2xl border border-black/8 dark:border-white/10 bg-black/3 dark:bg-white/5 p-4 text-center shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-black/15 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
            onClick={() => onConnect("email")}
            disabled={isLoading}
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 dark:bg-blue-500/20">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Business Email</p>
                <p className="text-xs text-muted-foreground">Work account</p>
              </div>
            </div>
          </button>

          {/* Software Wallet */}
          <button
            className="group relative rounded-2xl border border-black/8 dark:border-white/10 bg-black/3 dark:bg-white/5 p-4 text-center shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-black/15 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
            onClick={() => onConnect("wallet")}
            disabled={isLoading}
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10 dark:bg-purple-500/20">
                <Wallet className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">EVM Wallet</p>
                <p className="text-xs text-muted-foreground">MetaMask, etc.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Tron Wallet Option */}
        <button
          className="group relative mt-3 w-full overflow-hidden rounded-2xl border border-red-400/30 bg-red-50/60 dark:bg-red-500/10 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-red-400/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:opacity-50"
          onClick={() => onConnect("tron" as BusinessConnectType)}
          disabled={isLoading}
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15 dark:bg-red-500/25">
              <span className="text-xs font-bold text-red-600 dark:text-red-400">TRX</span>
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Tron Network</p>
              <p className="text-xs text-muted-foreground">Connect via TronLink</p>
            </div>
          </div>
        </button>
      </div>

      {/* Security Note */}
      <div className="mt-5 flex items-center gap-2 justify-center text-muted-foreground text-xs">
        <Fingerprint className="h-3 w-3" />
        <span>Multi-signature support available</span>
      </div>
    </motion.div>
  )
}
