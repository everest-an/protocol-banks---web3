"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PinSetupProps {
  onSubmit: (pin: string) => Promise<void>
  isLoading?: boolean
  mode?: "setup" | "confirm" | "unlock"
  title?: string
  description?: string
}

export function PinSetup({ onSubmit, isLoading = false, mode = "setup", title, description }: PinSetupProps) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [step, setStep] = useState<"enter" | "confirm">(mode === "setup" ? "enter" : "enter")
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const currentPin = step === "enter" ? pin : confirmPin
  const setCurrentPin = step === "enter" ? setPin : setConfirmPin

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [step])

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPin = currentPin.split("")
    newPin[index] = value.slice(-1)
    const updatedPin = newPin.join("").slice(0, 6)
    setCurrentPin(updatedPin)
    setError("")

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !currentPin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    if (currentPin.length !== 6) {
      setError("Please enter all 6 digits")
      return
    }

    const weakPINs = ["000000", "111111", "123456", "654321", "123123"]
    if (mode === "setup" && weakPINs.includes(currentPin)) {
      setError("PIN is too weak. Please choose a stronger PIN.")
      return
    }

    if (mode === "setup" && step === "enter") {
      setStep("confirm")
      setConfirmPin("")
      return
    }

    if (mode === "setup" && step === "confirm") {
      if (pin !== confirmPin) {
        setError("PINs do not match. Please try again.")
        setConfirmPin("")
        return
      }
    }

    try {
      await onSubmit(pin || currentPin)
    } catch (err: any) {
      setError(err.message || "Failed to verify PIN")
    }
  }

  const displayTitle =
    title || (mode === "setup" ? (step === "enter" ? "Create your PIN" : "Confirm your PIN") : "Enter your PIN")

  const displayDescription =
    description ||
    (mode === "setup"
      ? step === "enter"
        ? "This PIN secures your wallet. You'll need it to sign transactions."
        : "Enter your PIN again to confirm"
      : "Enter your 6-digit PIN to continue")

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Shield className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">{displayTitle}</h2>
      <p className="text-muted-foreground text-sm mb-6">{displayDescription}</p>

      {/* PIN Input */}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            maxLength={1}
            value={currentPin[index] || ""}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-14 text-center text-2xl font-bold bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            disabled={isLoading}
          />
        ))}
      </div>

      {/* Show/Hide PIN */}
      <button
        type="button"
        onClick={() => setShowPin(!showPin)}
        className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground mx-auto mb-4 text-sm transition-colors"
      >
        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {showPin ? "Hide PIN" : "Show PIN"}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 justify-center text-red-500 text-sm mb-4">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 font-semibold"
        disabled={isLoading || currentPin.length !== 6}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {mode === "setup" ? "Creating wallet..." : "Verifying..."}
          </>
        ) : mode === "setup" && step === "enter" ? (
          "Continue"
        ) : (
          "Confirm"
        )}
      </Button>

      {/* Security Note */}
      {mode === "setup" && (
        <p className="text-muted-foreground/50 text-xs mt-4">Never share your PIN. Protocol Bank staff will never ask for it.</p>
      )}
    </motion.div>
  )
}
