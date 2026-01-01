"use client"

import type React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  glowColor?: "cyan" | "amber"
}

export function AuthModal({ isOpen, onClose, children, glowColor = "cyan" }: AuthModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - covers below header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed left-0 right-0 bottom-0 top-14 sm:top-16 bg-black/50 backdrop-blur-sm z-[90]"
          />

          {/* Modal - centered in viewport */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-[100]",
              "left-1/2 -translate-x-1/2",
              "top-[30%] sm:top-[35%]",
              "w-[calc(100%-32px)] max-w-[380px] sm:w-[380px]",
              "bg-gray-900/95 backdrop-blur-xl",
              "border border-white/10 rounded-2xl",
              "shadow-2xl shadow-black/50",
              "max-h-[calc(100vh-120px)] overflow-y-auto",
            )}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
            >
              <X className="h-4 w-4 text-white/70" />
            </button>

            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{
                background:
                  glowColor === "cyan"
                    ? "linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, transparent 50%, rgba(34, 211, 238, 0.05) 100%)"
                    : "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, transparent 50%, rgba(59, 130, 246, 0.1) 100%)",
              }}
              transition={{ duration: 0.5 }}
            />

            {/* Content */}
            <div className="relative z-10 p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
