"use client"

import { motion } from "framer-motion"
import { Mail, Globe, Smartphone, Shield, ArrowRight } from "lucide-react"

export type PersonalLoginMethod = "email" | "google" | "apple"

interface PersonalLoginProps {
  onLogin: (method: PersonalLoginMethod) => void
  isLoading?: boolean
}

export function PersonalLogin({ onLogin, isLoading = false }: PersonalLoginProps) {
  return (
    <motion.div
      key="personal"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
        <p className="text-white/60 text-sm">Banking for your daily life</p>
      </div>

      {/* Login Options */}
      <div className="space-y-3">
        {/* Email */}
        <button
          className="w-full bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group text-left disabled:opacity-50"
          onClick={() => onLogin("email")}
          disabled={isLoading}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Mail className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">Email Login / Sign up</p>
              <p className="text-sm text-white/50">Continue with your email</p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </div>
        </button>

        {/* Google */}
        <button
          className="w-full bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group text-left disabled:opacity-50"
          onClick={() => onLogin("google")}
          disabled={isLoading}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">Continue with Google</p>
              <p className="text-sm text-white/50">Quick and secure</p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </div>
        </button>

        {/* Apple */}
        <button
          className="w-full bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition-colors group text-left disabled:opacity-50"
          onClick={() => onLogin("apple")}
          disabled={isLoading}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">Continue with Apple</p>
              <p className="text-sm text-white/50">Use Face ID or Touch ID</p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </div>
        </button>
      </div>

      {/* Security Note */}
      <div className="mt-5 flex items-center gap-2 justify-center text-white/40 text-xs">
        <Shield className="h-3 w-3" />
        <span>No crypto experience needed</span>
      </div>
    </motion.div>
  )
}
