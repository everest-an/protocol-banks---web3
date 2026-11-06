"use client"

import { useCallback, useEffect, useState } from "react"
import { authHeaders } from "@/lib/authenticated-fetch"

export interface AgentPayment {
  id: string
  txHash: string | null
  status: "pending" | "submitted" | "confirmed" | "failed" | string
  from: string
  to: string
  amountUsd: number
  token: string
  chain: string
  memo: string | null
  error: string | null
  createdAt: string
  confirmedAt: string | null
}

export function useAgentPayments(walletAddress?: string | null, enabled = true) {
  const [payments, setPayments] = useState<AgentPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!walletAddress || !enabled) {
      setPayments([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/agent-payments?limit=20", {
        headers: authHeaders(walletAddress),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPayments(Array.isArray(data.payments) ? data.payments : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agent payments")
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [walletAddress, enabled])

  useEffect(() => {
    load()
  }, [load])

  return { payments, loading, error, refresh: load }
}
