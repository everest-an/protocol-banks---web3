"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share, Plus, X, AlertCircle, Copy, Check } from "lucide-react"
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

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod|android|mobile/.test(userAgent)
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [browserType, setBrowserType] = useState<"safari" | "chrome" | "other">("safari")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const isMobile = isMobileDevice()
    const alreadyInstalled = isStandalone()
    const alreadyDismissed = localStorage.getItem("pwa-prompt-dismissed")

    console.log("[v0] PWA Prompt Check:", {
      isMobile,
      alreadyInstalled,
      alreadyDismissed,
      userAgent: navigator.userAgent,
    })

    // Detect browser type
    if (isSafari()) {
      setBrowserType("safari")
    } else if (isChrome()) {
      setBrowserType("chrome")
    } else {
      setBrowserType("other")
    }

    if (isMobile && !alreadyInstalled && !alreadyDismissed) {
      const timer = setTimeout(() => {
        console.log("[v0] Showing PWA prompt")
        setShowPrompt(true)
      }, 2000)
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  if (!showPrompt) return null

  const isIOSChrome = isIOS() && browserType === "chrome"
  const isIOSOther = isIOS() && browserType === "other"
  const needsSafari = isIOSChrome || isIOSOther

  return (
    <AnimatePresence>
      {!dismissed && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
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
            className="fixed bottom-0 left-0 right-0 z-[9999] px-3 pb-safe-bottom"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {/* Flowing Border Container */}
            <div className="relative rounded-[24px] p-[2px] overflow-hidden">
              {/* Animated Liquid Border */}
              <div
                className="absolute inset-0 rounded-[24px]"
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
                className="absolute inset-0 rounded-[24px] blur-xl opacity-30"
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
                className="relative rounded-[22px] px-4 py-5"
                style={{
                  background: "rgba(10, 10, 15, 0.98)",
                  backdropFilter: "blur(40px)",
                  WebkitBackdropFilter: "blur(40px)",
                }}
              >
                {/* Close Button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>

                {/* Header with Logo */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 102, 255, 0.2) 100%)",
                      border: "1px solid rgba(0, 212, 255, 0.3)",
                    }}
                  >
                    <Image src="/logo.png" alt="Protocol Banks" width={32} height={32} className="object-contain" />
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <h3 className="text-base font-bold text-white">Protocol Banks</h3>
                    <p className="text-sm text-zinc-400">Add to Home Screen</p>
                  </div>
                </div>

                {needsSafari ? (
                  <div className="space-y-4">
                    <div
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{
                        background: "rgba(255, 180, 0, 0.1)",
                        border: "1px solid rgba(255, 180, 0, 0.2)",
                      }}
                    >
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-white font-semibold">Open in Safari</p>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          To install, copy the link and open it in Safari browser.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleCopyLink}
                      className="w-full py-3 rounded-xl text-center text-white font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{
                        background: copied
                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                          : "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
                        boxShadow: "0 4px 20px rgba(0, 212, 255, 0.3)",
                      }}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Link Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  // Safari or Android - show direct install instructions
                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <motion.div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: "rgba(0, 212, 255, 0.15)",
                            border: "1px solid rgba(0, 212, 255, 0.3)",
                          }}
                          animate={{
                            boxShadow: ["0 0 0 0 rgba(0, 212, 255, 0.4)", "0 0 0 10px rgba(0, 212, 255, 0)"],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeOut",
                          }}
                        >
                          <Share className="w-4 h-4 text-cyan-400" />
                        </motion.div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">
                          Tap <span className="text-cyan-400 font-semibold">Share</span>
                        </p>
                        <p className="text-xs text-zinc-500">Bottom toolbar</p>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
                        }}
                      >
                        <span className="text-white font-bold text-xs">1</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px mx-4 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

                    {/* Step 2 */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: "rgba(255, 215, 0, 0.15)",
                          border: "1px solid rgba(255, 215, 0, 0.3)",
                        }}
                      >
                        <Plus className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">
                          <span className="text-amber-400 font-semibold">Add to Home Screen</span>
                        </p>
                        <p className="text-xs text-zinc-500">Scroll in menu</p>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                        }}
                      >
                        <span className="text-black font-bold text-xs">2</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Features row */}
                <div className="mt-5 pt-4 border-t border-zinc-800">
                  <div className="flex justify-around">
                    {[
                      { icon: "⚡", label: "Fast" },
                      { icon: "🔔", label: "Alerts" },
                      { icon: "📱", label: "Full Screen" },
                    ].map((feature) => (
                      <div key={feature.label} className="flex flex-col items-center gap-1">
                        <span className="text-lg">{feature.icon}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

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
