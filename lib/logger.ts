/**
 * Logger utility for Protocol Banks
 * Only logs in development mode or when DEBUG env is set
 */

const isDev = process.env.NODE_ENV === "development"
const isDebug = process.env.NEXT_PUBLIC_DEBUG === "true"

type LogLevel = "debug" | "info" | "warn" | "error"

interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function createLogger(prefix: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    if (level === "error") return true // Always log errors
    if (level === "warn") return true // Always log warnings
    return isDev || isDebug
  }

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.log(`[${prefix}]`, ...args)
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) {
        console.info(`[${prefix}]`, ...args)
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) {
        console.warn(`[${prefix}]`, ...args)
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) {
        console.error(`[${prefix}]`, ...args)
      }
    },
  }
}

// Pre-configured loggers for different modules
export const walletLogger = createLogger("Wallet")
export const paymentLogger = createLogger("Payment")
export const authLogger = createLogger("Auth")
export const apiLogger = createLogger("API")
export const pwaLogger = createLogger("PWA")

// Generic logger factory
export { createLogger }
