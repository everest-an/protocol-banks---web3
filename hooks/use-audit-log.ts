"use client"

import { useCallback, useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"

export interface AuditLogEntry {
  id: string
  action: string
  actor: string
  target_type: string
  target_id: string
  details: Record<string, any>
  ip_address: string
  user_agent: string
  created_at: string
}

export type AuditAction =
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "BATCH_PAYMENT_STARTED"
  | "BATCH_PAYMENT_COMPLETED"
  | "VENDOR_CREATED"
  | "VENDOR_UPDATED"
  | "VENDOR_DELETED"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_CANCELLED"
  | "WALLET_CONNECTED"
  | "WALLET_DISCONNECTED"
  | "API_KEY_CREATED"
  | "API_KEY_REVOKED"
  | "MULTISIG_CREATED"
  | "MULTISIG_SIGNED"
  | "MULTISIG_EXECUTED"
  | "SECURITY_ALERT"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"

export interface UseAuditLogReturn {
  isLogging: boolean
  isFetching: boolean
  logs: AuditLogEntry[]
  logAction: (
    action: AuditAction,
    targetType: string,
    targetId: string,
    details?: Record<string, any>
  ) => Promise<void>
  fetchLogs: (options?: { action?: AuditAction; limit?: number }) => Promise<void>
}

export function useAuditLog(): UseAuditLogReturn {
  const { wallets, activeChain } = useWeb3()
  const [isLogging, setIsLogging] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])

  const logAction = useCallback(
    async (
      action: AuditAction,
      targetType: string,
      targetId: string,
      details: Record<string, any> = {}
    ) => {
      const actor = wallets[activeChain] || "ANONYMOUS"
      setIsLogging(true)

      try {
        const response = await fetch("/api/audit-log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            actor,
            target_type: targetType,
            target_id: targetId,
            details: {
              ...details,
              timestamp: new Date().toISOString(),
              chain: activeChain,
            },
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("[AuditLog] Failed to log action:", error)
        }
      } catch (error) {
        console.error("[AuditLog] Error logging action:", error)
      } finally {
        setIsLogging(false)
      }
    },
    [wallets, activeChain]
  )

  const fetchLogs = useCallback(
    async (options: { action?: AuditAction; limit?: number } = {}) => {
      const actor = wallets[activeChain]
      if (!actor) {
        console.warn("[AuditLog] No wallet connected, cannot fetch logs")
        return
      }

      setIsFetching(true)

      try {
        const params = new URLSearchParams({ actor })
        if (options.action) params.set("action", options.action)
        if (options.limit) params.set("limit", options.limit.toString())

        const response = await fetch(`/api/audit-log?${params.toString()}`)

        if (!response.ok) {
          const error = await response.json()
          console.error("[AuditLog] Failed to fetch logs:", error)
          return
        }

        const data = await response.json()
        setLogs(data.logs || [])
      } catch (error) {
        console.error("[AuditLog] Error fetching logs:", error)
      } finally {
        setIsFetching(false)
      }
    },
    [wallets, activeChain]
  )

  return {
    isLogging,
    isFetching,
    logs,
    logAction,
    fetchLogs,
  }
}
