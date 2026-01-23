"use client"

import { useState, useEffect, useCallback } from "react"

// ============================================
// Types
// ============================================

export interface ActivityItem {
  id: string
  type: "sent" | "received"
  amount: string
  token: string
  chain_id: number
  counterparty: string
  counterparty_name?: string
  vendor_id?: string
  vendor_name?: string
  tx_hash?: string
  status: string
  created_at: string
}

export interface DashboardActivity {
  items: ActivityItem[]
  total_sent: number
  total_received: number
  has_more: boolean
}

export interface ActivitySummary {
  today_count: number
  week_count: number
  month_count: number
  pending_count: number
}

export interface UseDashboardActivityReturn {
  activity: DashboardActivity | null
  summary: ActivitySummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  formatItem: (item: ActivityItem) => FormattedActivityItem
}

export interface FormattedActivityItem {
  direction: string
  description: string
  amount_display: string
  time_ago: string
}

// ============================================
// API Helper
// ============================================

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed with status ${response.status}`,
      response.status
    )
  }

  return data as T
}

// ============================================
// Utility Functions
// ============================================

function truncateAddress(address: string): string {
  if (!address || address.length <= 10) return address || ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

// ============================================
// Hook Implementation
// ============================================

export function useDashboardActivity(limit: number = 5): UseDashboardActivityReturn {
  const [activity, setActivity] = useState<DashboardActivity | null>(null)
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load activity data
  const loadActivity = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [activityResponse, summaryResponse] = await Promise.all([
        apiRequest<{ success: boolean; activity: DashboardActivity }>(
          `/api/dashboard/activity?limit=${limit}`
        ),
        apiRequest<{ success: boolean; summary: ActivitySummary }>(
          `/api/dashboard/summary`
        ),
      ])

      setActivity(activityResponse.activity || null)
      setSummary(summaryResponse.summary || null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load activity"
      setError(message)
      console.error("[useDashboardActivity] Load error:", err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Format activity item for display
  const formatItem = useCallback((item: ActivityItem): FormattedActivityItem => {
    const direction = item.type === "sent" ? "Sent" : "Received"
    const counterpartyDisplay = item.vendor_name || truncateAddress(item.counterparty)
    const description = item.type === "sent"
      ? `To ${counterpartyDisplay}`
      : `From ${counterpartyDisplay}`

    return {
      direction,
      description,
      amount_display: `${item.type === "sent" ? "-" : "+"}${item.amount} ${item.token}`,
      time_ago: getTimeAgo(new Date(item.created_at)),
    }
  }, [])

  // Load on mount
  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadActivity()
    }, 30000)

    return () => clearInterval(interval)
  }, [loadActivity])

  return {
    activity,
    summary,
    loading,
    error,
    refresh: loadActivity,
    formatItem,
  }
}
