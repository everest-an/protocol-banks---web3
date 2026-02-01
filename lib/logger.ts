/**
 * Logger utility for Protocol Banks
 * 
 * Features:
 * - Environment-aware logging (dev/debug/prod)
 * - Structured logging with timestamps
 * - Module-specific loggers
 * - Production-safe (suppresses debug logs)
 * 
 * Usage:
 * ```
 * import { paymentLogger as logger } from "@/lib/logger"
 * logger.info("Payment processed", { amount: 100, token: "USDC" })
 * ```
 */

const isDev = process.env.NODE_ENV === "development"
const isDebug = process.env.NEXT_PUBLIC_DEBUG === "true"
const isServer = typeof window === "undefined"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  [key: string]: unknown
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext | Error) => void
  child: (childPrefix: string) => Logger
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatMessage(prefix: string, level: LogLevel, message: string, context?: LogContext | Error): string {
  const timestamp = formatTimestamp()
  const contextStr = context 
    ? context instanceof Error 
      ? ` | Error: ${context.message}` 
      : ` | ${JSON.stringify(context)}`
    : ""
  return `[${timestamp}] [${prefix}] [${level.toUpperCase()}] ${message}${contextStr}`
}

function createLogger(prefix: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    if (level === "error") return true // Always log errors
    if (level === "warn") return true // Always log warnings
    return isDev || isDebug
  }

  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog("debug")) {
        if (isServer) {
          console.log(formatMessage(prefix, "debug", message, context))
        } else {
          console.log(`[${prefix}]`, message, context || "")
        }
      }
    },
    info: (message: string, context?: LogContext) => {
      if (shouldLog("info")) {
        if (isServer) {
          console.info(formatMessage(prefix, "info", message, context))
        } else {
          console.info(`[${prefix}]`, message, context || "")
        }
      }
    },
    warn: (message: string, context?: LogContext) => {
      if (shouldLog("warn")) {
        if (isServer) {
          console.warn(formatMessage(prefix, "warn", message, context))
        } else {
          console.warn(`[${prefix}]`, message, context || "")
        }
      }
    },
    error: (message: string, context?: LogContext | Error) => {
      if (shouldLog("error")) {
        if (isServer) {
          console.error(formatMessage(prefix, "error", message, context))
          if (context instanceof Error && context.stack) {
            console.error(context.stack)
          }
        } else {
          console.error(`[${prefix}]`, message, context || "")
        }
      }
    },
    child: (childPrefix: string) => createLogger(`${prefix}:${childPrefix}`),
  }
}

// Pre-configured loggers for different modules
export const walletLogger = createLogger("Wallet")
export const paymentLogger = createLogger("Payment")
export const authLogger = createLogger("Auth")
export const apiLogger = createLogger("API")
export const pwaLogger = createLogger("PWA")

// New loggers for all major modules
export const subscriptionLogger = createLogger("Subscription")
export const agentLogger = createLogger("Agent")
export const merchantLogger = createLogger("Merchant")
export const webhookLogger = createLogger("Webhook")
export const crossChainLogger = createLogger("CrossChain")
export const multisigLogger = createLogger("Multisig")
export const securityLogger = createLogger("Security")
export const cacheLogger = createLogger("Cache")
export const dbLogger = createLogger("Database")
export const notificationLogger = createLogger("Notification")

// Generic logger factory
export { createLogger }

// Default logger for general use
export const logger = createLogger("App")
