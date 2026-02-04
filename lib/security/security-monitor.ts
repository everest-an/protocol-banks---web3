/**
 * Real-time Security Monitor
 * Monitors for active attacks and suspicious patterns
 */

interface SecurityEvent {
  type: string
  severity: "info" | "warning" | "danger" | "critical"
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

interface SecurityMonitorConfig {
  onAlert: (event: SecurityEvent) => void
  walletAddress?: string
}

class SecurityMonitor {
  private events: SecurityEvent[] = []
  private config: SecurityMonitorConfig
  private intervalId?: NodeJS.Timeout
  private failedAttempts: Map<string, number> = new Map()
  private suspiciousIPs: Set<string> = new Set()

  constructor(config: SecurityMonitorConfig) {
    this.config = config
  }

  /**
   * Start monitoring
   */
  start() {
    // Monitor for rapid failed transactions
    this.intervalId = setInterval(() => {
      this.checkPatterns()
    }, 10000) // Every 10 seconds

    // Monitor clipboard changes
    if (typeof document !== "undefined") {
      document.addEventListener("copy", this.handleCopy.bind(this))
      document.addEventListener("paste", this.handlePaste.bind(this))
    }

    // Monitor for devtools (potential attack investigation)
    this.detectDevTools()
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("copy", this.handleCopy.bind(this))
      document.removeEventListener("paste", this.handlePaste.bind(this))
    }
  }

  /**
   * Record a security event
   */
  recordEvent(event: Omit<SecurityEvent, "timestamp">) {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    }
    this.events.push(fullEvent)

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events.shift()
    }

    // Alert on high severity events
    if (event.severity === "danger" || event.severity === "critical") {
      this.config.onAlert(fullEvent)
    }
  }

  /**
   * Record failed transaction attempt
   */
  recordFailedAttempt(key: string) {
    const current = this.failedAttempts.get(key) || 0
    this.failedAttempts.set(key, current + 1)

    if (current + 1 >= 3) {
      this.recordEvent({
        type: "BRUTE_FORCE_SUSPECTED",
        severity: "warning",
        message: `Multiple failed attempts detected for ${key}`,
        metadata: { attempts: current + 1 },
      })
    }

    if (current + 1 >= 5) {
      this.recordEvent({
        type: "BRUTE_FORCE_BLOCKED",
        severity: "critical",
        message: `Blocking ${key} due to excessive failed attempts`,
        metadata: { attempts: current + 1 },
      })
    }
  }

  /**
   * Check if action should be blocked
   */
  isBlocked(key: string): boolean {
    return (this.failedAttempts.get(key) || 0) >= 5
  }

  /**
   * Check for suspicious patterns
   */
  private checkPatterns() {
    // Check for rapid events
    const recentEvents = this.events.filter(
      (e) => Date.now() - e.timestamp < 60000, // Last minute
    )

    if (recentEvents.length > 20) {
      this.recordEvent({
        type: "RAPID_ACTIVITY",
        severity: "warning",
        message: `Unusual activity rate: ${recentEvents.length} events in 1 minute`,
      })
    }

    // Check for repeated failures
    const failures = recentEvents.filter((e) => e.type.includes("FAIL") || e.type.includes("ERROR"))

    if (failures.length > 5) {
      this.recordEvent({
        type: "REPEATED_FAILURES",
        severity: "danger",
        message: `${failures.length} failures in 1 minute - possible attack`,
      })
    }
  }

  /**
   * Handle copy events
   */
  private handleCopy(event: ClipboardEvent) {
    const selection = window.getSelection()?.toString()

    // Check if copying an address
    if (selection && /^0x[a-fA-F0-9]{40}$/.test(selection)) {
      this.recordEvent({
        type: "ADDRESS_COPIED",
        severity: "info",
        message: "Wallet address copied to clipboard",
        metadata: {
          address: selection.slice(0, 10) + "..." + selection.slice(-4),
        },
      })

      // Store for later verification
      sessionStorage.setItem("lastCopiedAddress", selection)
      sessionStorage.setItem("lastCopyTime", Date.now().toString())
    }
  }

  /**
   * Handle paste events
   */
  private handlePaste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData("text")
    const lastCopied = sessionStorage.getItem("lastCopiedAddress")
    const lastCopyTime = Number.parseInt(sessionStorage.getItem("lastCopyTime") || "0")

    // Check if pasting an address that differs from what was copied
    if (pasted && lastCopied && /^0x[a-fA-F0-9]{40}$/.test(pasted)) {
      if (pasted !== lastCopied && Date.now() - lastCopyTime < 300000) {
        // Within 5 minutes
        this.recordEvent({
          type: "CLIPBOARD_MISMATCH",
          severity: "critical",
          message: "Pasted address differs from copied address - possible clipboard hijacker!",
          metadata: {
            copied: lastCopied.slice(0, 10) + "...",
            pasted: pasted.slice(0, 10) + "...",
          },
        })
      }
    }
  }

  /**
   * Detect devtools opening (potential debugging by attacker)
   */
  private detectDevTools() {
    if (typeof window === "undefined") return

    const threshold = 160
    let detected = false

    const check = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold
      const heightThreshold = window.outerHeight - window.innerHeight > threshold

      if (!detected && (widthThreshold || heightThreshold)) {
        detected = true
        this.recordEvent({
          type: "DEVTOOLS_OPENED",
          severity: "info",
          message: "Developer tools opened - normal for debugging, but monitor for suspicious activity",
        })
      }
    }

    window.addEventListener("resize", check)
  }

  /**
   * Get recent security events
   */
  getRecentEvents(count = 10): SecurityEvent[] {
    return this.events.slice(-count)
  }

  /**
   * Get security summary
   */
  getSummary(): {
    totalEvents: number
    criticalEvents: number
    warningEvents: number
    blockedKeys: string[]
  } {
    return {
      totalEvents: this.events.length,
      criticalEvents: this.events.filter((e) => e.severity === "critical").length,
      warningEvents: this.events.filter((e) => e.severity === "warning" || e.severity === "danger").length,
      blockedKeys: Array.from(this.failedAttempts.entries())
        .filter(([_, count]) => count >= 5)
        .map(([key]) => key),
    }
  }
}

// Singleton instance
let monitorInstance: SecurityMonitor | null = null

export function getSecurityMonitor(config?: SecurityMonitorConfig): SecurityMonitor {
  if (!monitorInstance && config) {
    monitorInstance = new SecurityMonitor(config)
    monitorInstance.start()
  }
  return monitorInstance!
}

export function initSecurityMonitor(onAlert: (event: SecurityEvent) => void, walletAddress?: string) {
  if (monitorInstance) {
    monitorInstance.stop()
  }
  monitorInstance = new SecurityMonitor({ onAlert, walletAddress })
  monitorInstance.start()
  return monitorInstance
}

export type { SecurityEvent, SecurityMonitorConfig }
