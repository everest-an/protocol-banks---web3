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
  return (
    <div className="flex justify-center mb-6">
      <div className="relative bg-white/5 rounded-full p-1 flex">
        <motion.div
          className={cn(
            "absolute top-1 bottom-1 rounded-full",
            mode === "personal" ? "bg-cyan-500/30" : "bg-amber-500/30",
          )}
          animate={{
            left: mode === "personal" ? 4 : "50%",
            right: mode === "personal" ? "50%" : 4,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />

        <button
          onClick={() => onModeChange("personal")}
          className={cn(
            "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors",
            mode === "personal" ? "text-cyan-300" : "text-white/50 hover:text-white/70",
          )}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal
          </div>
        </button>

        <button
          onClick={() => onModeChange("business")}
          className={cn(
            "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors",
            mode === "business" ? "text-amber-300" : "text-white/50 hover:text-white/70",
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </div>
        </button>
      </div>
    </div>
  )
}
