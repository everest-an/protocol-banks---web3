"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

interface SecurityEvent {
  type: string
  severity: "info" | "warning" | "danger" | "critical"
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

interface UseSecurityMonitorOptions {
  walletAddress?: string
  enabled?: boolean
  onCriticalAlert?: (event: SecurityEvent) => void
}

export function useSecurityMonitor(options: UseSecurityMonitorOptions = {}) {
  const { walletAddress, enabled = true, onCriticalAlert } = options
  const { toast } = useToast()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const failedAttemptsRef = useRef<Map<string, number>>(new Map())
  const intervalRef = useRef<NodeJS.Timeout>()

  const addEvent = useCallback(
    (event: Omit<SecurityEvent, "timestamp">) => {
      const fullEvent: SecurityEvent = {
        ...event,
        timestamp: Date.now(),
      }
      setEvents((prev) => [...prev.slice(-99), fullEvent])

      // Show toast for warnings and above
      if (event.severity === "warning" || event.severity === "danger" || event.severity === "critical") {
        toast({
          title: `Security ${event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}`,
          description: event.message,
          variant: event.severity === "critical" ? "destructive" : "default",
        })
      }

      // Call critical alert handler
      if (event.severity === "critical" && onCriticalAlert) {
        onCriticalAlert(fullEvent)
      }
    },
    [toast, onCriticalAlert],
  )

  // Monitor clipboard for address hijacking
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text")
      if (pastedText && /^0x[a-fA-F0-9]{40}$/.test(pastedText)) {
        // Check if pasted address looks suspicious
        const lowerPasted = pastedText.toLowerCase()
        if (walletAddress && lowerPasted.startsWith(walletAddress.slice(0, 6).toLowerCase())) {
          if (lowerPasted !== walletAddress.toLowerCase()) {
            addEvent({
              type: "clipboard_hijack_attempt",
              severity: "critical",
              message: "Potential clipboard hijacking detected! Pasted address looks similar but different from expected.",
              metadata: { pastedAddress: pastedText, expectedPrefix: walletAddress.slice(0, 10) },
            })
          }
        }
      }
    },
    [walletAddress, addEvent],
  )

  // Monitor for rapid failed transactions
  const recordFailedAttempt = useCallback(
    (reason: string) => {
      const key = `${reason}_${Math.floor(Date.now() / 60000)}` // Per minute
      const count = (failedAttemptsRef.current.get(key) || 0) + 1
      failedAttemptsRef.current.set(key, count)

      if (count >= 3) {
        addEvent({
          type: "rapid_failures",
          severity: "warning",
          message: `Multiple failed attempts detected: ${reason}`,
          metadata: { count, reason },
        })
      }

      if (count >= 5) {
        addEvent({
          type: "attack_pattern",
          severity: "danger",
          message: "Potential attack pattern detected. Too many failures.",
          metadata: { count, reason },
        })
      }
    },
    [addEvent],
  )

  // Check for suspicious patterns periodically
  const checkPatterns = useCallback(() => {
    // Check if window focus changed rapidly (potential phishing)
    if (typeof document !== "undefined" && !document.hasFocus()) {
      // Window lost focus - could be phishing overlay
    }

    // Clean old failed attempts
    const now = Date.now()
    failedAttemptsRef.current.forEach((_, key) => {
      const timestamp = parseInt(key.split("_").pop() || "0", 10) * 60000
      if (now - timestamp > 300000) {
        // 5 minutes
        failedAttemptsRef.current.delete(key)
      }
    })
  }, [])

  // Start/stop monitoring
  useEffect(() => {
    if (!enabled) return

    setIsMonitoring(true)

    // Add clipboard listener
    if (typeof document !== "undefined") {
      document.addEventListener("paste", handlePaste)
    }

    // Start pattern checking
    intervalRef.current = setInterval(checkPatterns, 10000)

    addEvent({
      type: "monitor_started",
      severity: "info",
      message: "Security monitoring activated",
    })

    return () => {
      setIsMonitoring(false)
      if (typeof document !== "undefined") {
        document.removeEventListener("paste", handlePaste)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, handlePaste, checkPatterns, addEvent])

  return {
    events,
    isMonitoring,
    recordFailedAttempt,
    addEvent,
    clearEvents: () => setEvents([]),
  }
}
