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

export function AuthModal({ isOpen, onClose, children }: AuthModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed left-0 right-0 bottom-0 top-14 sm:top-16 z-[90] bg-black/40 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-[100]",
              "left-1/2 -translate-x-1/2",
              "top-[30%] sm:top-[45%]",
              "w-[calc(100%-32px)] max-w-[420px] sm:w-[420px]",
              "overflow-hidden rounded-3xl",
              "border border-white/20 dark:border-white/10",
              "bg-white/80 dark:bg-black/50 backdrop-blur-[28px]",
              "shadow-[0_32px_80px_rgba(0,0,0,0.18)] dark:shadow-[0_32px_80px_rgba(7,15,43,0.55)]",
              "max-h-[calc(100vh-120px)] overflow-y-auto",
            )}
          >
            {/* Subtle top edge highlight */}
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-white/60 dark:bg-white/40" />
            <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-black/5 dark:bg-white/10" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 rounded-full border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/10 p-2 text-foreground/60 dark:text-white/70 transition-all hover:border-black/20 dark:hover:border-white/40 hover:bg-black/10 dark:hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content */}
            <div className="relative z-10 p-6 sm:p-7">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
