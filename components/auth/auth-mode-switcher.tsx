"use client"

import { motion } from "framer-motion"
import { User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type AuthMode = "personal" | "business"

interface AuthModeSwitcherProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

export function AuthModeSwitcher({ mode, onModeChange }: AuthModeSwitcherProps) {
  const handleModeChange = (newMode: AuthMode) => {
    if (newMode === mode) return
    onModeChange(newMode)
  }

  return (
    <div className="flex justify-center mb-7">
      <div className="relative flex overflow-hidden rounded-full border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-1 py-1 backdrop-blur-md shadow-sm">
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-white dark:bg-white/20 shadow-sm"
          animate={{
            left: mode === "personal" ? 4 : "50%",
            right: mode === "personal" ? "50%" : 4,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        />

        <button
          onClick={() => handleModeChange("personal")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
            mode === "personal"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <User className="h-4 w-4" />
          Personal
        </button>

        <button
          onClick={() => handleModeChange("business")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
            mode === "business"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Building2 className="h-4 w-4" />
          Business
        </button>
      </div>
    </div>
  )
}
