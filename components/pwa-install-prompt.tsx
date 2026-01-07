"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share, Plus, X, AlertCircle } from "lucide-react"
import Image from "next/image"

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

function isChrome(): boolean {
  if (typeof window === "undefined") return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /crios/.test(userAgent) // CriOS = Chrome on iOS
}

// Check if any iOS browser (Safari, Chrome, Firefox, etc.)
function isIOSBrowser(): boolean {
  return isIOS() && !isStandalone()
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [browserType, setBrowserType] = useState<"safari" | "chrome" | "other">("safari")

  useEffect(() => {
    const shouldShow = isIOSBrowser() && !localStorage.getItem("pwa-prompt-dismissed")

    // Detect browser type
    if (isSafari()) {
      setBrowserType("safari")
    } else if (isChrome()) {
      setBrowserType("chrome")
    } else {
      setBrowserType("other")
    }

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

  const isChromeUser = browserType === "chrome" || browserType === "other"

  return (
    <AnimatePresence>
      {!dismissed && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
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
            className="fixed bottom-0 left-0 right-0 z-[9999] px-3 pb-6 pt-2 safe-area-pb"
          >
            {/* Flowing Border Container */}
            <div className="relative rounded-[28px] p-[2px] overflow-hidden">
              {/* Animated Liquid Border */}
              <div
                className="absolute inset-0 rounded-[28px]"
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
                className="absolute inset-0 rounded-[28px] blur-xl opacity-40"
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

              <div
                className="relative rounded-[26px] px-5 py-6"
                style={{
                  background: `
                    linear-gradient(
                      135deg,
                      rgba(15, 15, 20, 0.98) 0%,
                      rgba(20, 20, 30, 0.95) 50%,
                      rgba(10, 15, 25, 0.98) 100%
                    )
                  `,
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  boxShadow: `
                    inset 0 1px 1px rgba(255, 255, 255, 0.08),
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 0 40px rgba(0, 212, 255, 0.1)
                  `,
                }}
              >
                {/* Close Button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>

                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative"
                    style={{
                      background: "linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 102, 255, 0.2) 100%)",
                      border: "1px solid rgba(0, 212, 255, 0.3)",
                      boxShadow: "0 8px 32px rgba(0, 212, 255, 0.2)",
                    }}
                  >
                    <Image src="/logo.png" alt="Protocol Banks" width={36} height={36} className="object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white">Protocol Banks</h3>
                    <p className="text-sm text-gray-400">Install for the best experience</p>
                  </div>
                </div>

                {isChromeUser ? (
                  <div className="space-y-4">
                    {/* Chrome Warning */}
                    <div
                      className="flex items-start gap-3 p-4 rounded-xl"
                      style={{
                        background: "rgba(255, 180, 0, 0.1)",
                        border: "1px solid rgba(255, 180, 0, 0.2)",
                      }}
                    >
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-white font-semibold">Open in Safari to Install</p>
                        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                          Chrome on iOS doesn't support app installation. Open this page in Safari to add to Home
                          Screen.
                        </p>
                      </div>
                    </div>

                    {/* Copy Link Button */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                      }}
                      className="w-full py-3.5 rounded-xl text-center text-white font-semibold transition-all active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
                        boxShadow: "0 4px 20px rgba(0, 212, 255, 0.3)",
                      }}
                    >
                      Copy Link to Open in Safari
                    </button>
                  </div>
                ) : (
                  /* Safari Instructions */
                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        {/* Pulsing Share Icon */}
                        <motion.div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            background: "rgba(0, 212, 255, 0.15)",
                            border: "1px solid rgba(0, 212, 255, 0.3)",
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
                          <Share className="w-5 h-5 text-cyan-400" />
                        </motion.div>

                        {/* Pulsing Arrow pointing down to Safari toolbar */}
                        <motion.div
                          className="absolute -bottom-7 left-1/2 -translate-x-1/2"
                          animate={{
                            y: [0, -6, 0],
                            opacity: [1, 0.5, 1],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }}
                        >
                          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                            <path
                              d="M10 0L10 20M10 20L3 13M10 20L17 13"
                              stroke="url(#arrowGradient)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <defs>
                              <linearGradient id="arrowGradient" x1="10" y1="0" x2="10" y2="20">
                                <stop stopColor="#00D4FF" />
                                <stop offset="1" stopColor="#FFD700" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </motion.div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-white font-medium">
                          Tap the <span className="text-cyan-400 font-semibold">Share</span> button
                        </p>
                        <p className="text-sm text-gray-500">In Safari's bottom toolbar</p>
                      </div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
                        }}
                      >
                        <span className="text-white font-bold text-sm">1</span>
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
                            rgba(255, 255, 255, 0.15) 50%,
                            transparent 100%
                          )
                        `,
                      }}
                    />

                    {/* Step 2 */}
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: "rgba(255, 215, 0, 0.15)",
                          border: "1px solid rgba(255, 215, 0, 0.3)",
                        }}
                      >
                        <Plus className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-white font-medium">
                          Tap <span className="text-amber-400 font-semibold">Add to Home Screen</span>
                        </p>
                        <p className="text-sm text-gray-500">Scroll down in share menu</p>
                      </div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                        }}
                      >
                        <span className="text-black font-bold text-sm">2</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Features - improved contrast */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-around">
                    {[
                      { icon: "⚡", label: "Faster", desc: "Native speed" },
                      { icon: "🔔", label: "Alerts", desc: "Get notified" },
                      { icon: "📱", label: "Full Screen", desc: "No browser UI" },
                    ].map((feature) => (
                      <div key={feature.label} className="flex flex-col items-center gap-1.5">
                        <span className="text-xl">{feature.icon}</span>
                        <span className="text-xs text-white font-medium">{feature.label}</span>
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
            .safe-area-pb {
              padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  )
}
