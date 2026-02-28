"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface EmailInputProps {
  onSubmit: (email: string) => Promise<void>
  onBack: () => void
  isLoading?: boolean
}

export function EmailInput({ onSubmit, onBack, isLoading = false }: EmailInputProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    try {
      await onSubmit(email)
      setSent(true)
    } catch (err: any) {
      setError(err.message || "Failed to send magic link")
    }
  }

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        <div className="h-16 w-16 rounded-full bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Check your email</h3>
        <p className="text-muted-foreground text-sm mb-4">
          We sent a magic link to <span className="text-cyan-600 dark:text-cyan-400">{email}</span>
        </p>
        <p className="text-muted-foreground/60 text-xs">
          Click the link in your email to sign in. The link expires in 15 minutes.
        </p>
        <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Use a different email
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>

      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-xl bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
          <Mail className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">Enter your email</h2>
        <p className="text-muted-foreground text-sm">We'll send you a magic link to sign in</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 border border-black/10 dark:border-white/15 bg-black/3 dark:bg-white/5 text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40"
            disabled={isLoading}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl font-semibold"
          disabled={isLoading || !email}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Magic Link"
          )}
        </Button>
      </form>
    </motion.div>
  )
}
