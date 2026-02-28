"use client"

import { useState, useEffect, useCallback } from "react"
import type { PaymentGroup } from "@/types/payment"
import { authHeaders } from "@/lib/authenticated-fetch"

export function usePaymentGroups(ownerAddress: string) {
  const [groups, setGroups] = useState<PaymentGroup[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGroups = useCallback(async () => {
    if (!ownerAddress) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payment-groups?owner=${ownerAddress}`, {
        headers: authHeaders(ownerAddress),
      })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch {
      // silently fail — groups are optional
    } finally {
      setLoading(false)
    }
  }, [ownerAddress])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return { groups, setGroups, loading, refetch: fetchGroups }
}
