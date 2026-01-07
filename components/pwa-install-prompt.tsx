"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share, Plus, X } from "lucide-react"

// iOS detection
function isIOS(): boolean {
  if (typeof window === "undefined") return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

// Check if running as standalone PWA
function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches
}

// Check if Safari browser
function isSafari(): boolean {
  if (typeof window === "undefined") return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /safari/.test(userAgent) && !/chrome|chromium|crios/.test(userAgent)
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari when not already installed
    const shouldShow = isIOS() && isSafari() && !isStandalone() && !localStorage.getItem("pwa-prompt-dismissed")

    // Delay showing prompt for better UX
    if (shouldShow) {
      const timer = setTimeout(() => setShowPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    setTimeout(() => {
      setShowPrompt(false)
      localStorage.setItem("pwa-prompt-dismissed", "true")
    }, 300)
  }

  if (!showPrompt) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
            onClick={handleDismiss}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-8 pt-2"
          >
            {/* Flowing Border Container */}
            <div className="relative rounded-[32px] p-[2px] overflow-hidden">
              {/* Animated Liquid Border */}
              <div
                className="absolute inset-0 rounded-[32px]"
                style={{
                  background: `
                    linear-gradient(
                      90deg,
                      #00D4FF 0%,
                      #00FFFF 20%,
                      #FFD700 40%,
                      #FFA500 60%,
                      #00FFFF 80%,
                      #00D4FF 100%
                    )
                  `,
                  backgroundSize: "200% 100%",
                  animation: "liquidFlow 3s ease-in-out infinite",
                }}
              />

              {/* Glow Effect */}
              <div
                className="absolute inset-0 rounded-[32px] blur-xl opacity-50"
                style={{
                  background: `
                    linear-gradient(
                      90deg,
                      #00D4FF 0%,
                      #FFD700 50%,
                      #00D4FF 100%
                    )
                  `,
                  backgroundSize: "200% 100%",
                  animation: "liquidFlow 3s ease-in-out infinite",
                }}
              />

              {/* Glassmorphism Content */}
              <div
                className="relative rounded-[30px] px-6 py-8"
                style={{
                  background: `
                    linear-gradient(
                      135deg,
                      rgba(255, 255, 255, 0.1) 0%,
                      rgba(255, 255, 255, 0.05) 50%,
                      rgba(0, 212, 255, 0.05) 100%
                    )
                  `,
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  boxShadow: `
                    inset 0 1px 1px rgba(255, 255, 255, 0.2),
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    0 0 40px rgba(0, 212, 255, 0.1)
                  `,
                }}
              >
                {/* Close Button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>

                {/* Header with App Icon */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `
                        linear-gradient(
                          135deg,
                          #00D4FF 0%,
                          #0066FF 50%,
                          #00D4FF 100%
                        )
                      `,
                      boxShadow: "0 8px 32px rgba(0, 212, 255, 0.4)",
                    }}
                  >
                    <span className="text-3xl font-bold text-white">P</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Protocol Banks</h3>
                    <p className="text-sm text-white/60">Add to Home Screen for the best experience</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {/* Pulsing Share Icon */}
                      <motion.div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: "rgba(255, 255, 255, 0.1)",
                        }}
                        animate={{
                          boxShadow: ["0 0 0 0 rgba(0, 212, 255, 0.4)", "0 0 0 12px rgba(0, 212, 255, 0)"],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeOut",
                        }}
                      >
                        <Share className="w-6 h-6 text-cyan-400" />
                      </motion.div>

                      {/* Pulsing Arrow */}
                      <motion.div
                        className="absolute -bottom-8 left-1/2 -translate-x-1/2"
                        animate={{
                          y: [0, -8, 0],
                          opacity: [1, 0.5, 1],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                      >
                        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                          <path
                            d="M12 0L12 28M12 28L4 20M12 28L20 20"
                            stroke="url(#arrowGradient)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <defs>
                            <linearGradient id="arrowGradient" x1="12" y1="0" x2="12" y2="28">
                              <stop stopColor="#00D4FF" />
                              <stop offset="1" stopColor="#FFD700" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </motion.div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        Tap the <span className="text-cyan-400">Share</span> button
                      </p>
                      <p className="text-white/50 text-sm">In Safari's bottom toolbar</p>
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #00D4FF 0%, #FFD700 100%)",
                      }}
                    >
                      <span className="text-black font-bold text-sm">1</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className="h-px mx-4"
                    style={{
                      background: `
                        linear-gradient(
                          90deg,
                          transparent 0%,
                          rgba(255, 255, 255, 0.2) 50%,
                          transparent 100%
                        )
                      `,
                    }}
                  />

                  {/* Step 2 */}
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <Plus className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        Tap <span className="text-amber-400">Add to Home Screen</span>
                      </p>
                      <p className="text-white/50 text-sm">Scroll down in the share menu</p>
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                      }}
                    >
                      <span className="text-black font-bold text-sm">2</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-around">
                    {[
                      { icon: "⚡", label: "Faster" },
                      { icon: "🔔", label: "Notifications" },
                      { icon: "📱", label: "Full Screen" },
                    ].map((feature) => (
                      <div key={feature.label} className="flex flex-col items-center gap-1">
                        <span className="text-xl">{feature.icon}</span>
                        <span className="text-xs text-white/50">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CSS Animation */}
          <style jsx global>{`
            @keyframes liquidFlow {
              0% {
                background-position: 0% 50%;
              }
              50% {
                background-position: 100% 50%;
              }
              100% {
                background-position: 0% 50%;
              }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  )
}
