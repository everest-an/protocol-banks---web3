"use client"

import useSWR from "swr"

// ============================================================
// Types (mirrored from dashboard-activity component)
// ============================================================

export type ActivityType =
  | "payment_sent"
  | "payment_received"
  | "batch_payment"
  | "subscription_charged"
  | "subscription_created"
  | "subscription_cancelled"
  | "multisig_proposed"
  | "multisig_signed"
  | "multisig_executed"
  | "webhook_triggered"
  | "api_key_created"
  | "vendor_added"
  | "vendor_updated"

export interface Activity {
  id: string
  type: ActivityType
  timestamp: string
  title: string
  description: string
  amount?: number
  token?: string
  status: "success" | "pending" | "failed"
  metadata?: {
    tx_hash?: string
    vendor_name?: string
    recipient_count?: number
    subscription_name?: string
    webhook_event?: string
    signer_address?: string
    threshold?: string
  }
}

// ============================================================
// Fetcher
// ============================================================

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch activities")
  return res.json() as Promise<{ activities: Activity[]; total: number }>
}

// ============================================================
// Hook
// ============================================================

export function useActivities(walletAddress?: string, limit = 15) {
  const key = walletAddress
    ? `/api/activities?wallet=${walletAddress}&limit=${limit}`
    : null

  const { data, error, isLoading, mutate } = useSWR<{ activities: Activity[]; total: number }>(
    key,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  )

  return {
    activities: data?.activities,
    total: data?.total,
    error,
    isLoading,
    refresh: mutate,
  }
}
