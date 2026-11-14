"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const ROWS: Array<{ key: string; label: string; description: string }> = [
  { key: "payment_received", label: "Payment received", description: "Incoming payments" },
  { key: "payment_sent", label: "Payment sent", description: "Outgoing payments" },
  { key: "subscription_reminder", label: "Subscription reminder", description: "Upcoming recurring charge" },
  { key: "subscription_payment", label: "Subscription paid", description: "Recurring charge settled" },
  { key: "trade_opened", label: "Trade opened", description: "AI trading entry" },
  { key: "trade_closed", label: "Trade closed", description: "AI trading exit with P&L" },
  { key: "trade_guard", label: "Risk guardrail", description: "Circuit breaker or protective action" },
  { key: "finance_budget", label: "Budget alerts", description: "80% and 100% budget thresholds" },
]

export function NotificationPreferences() {
  const { address, isConnected } = useUnifiedWallet()
  const [preferences, setPreferences] = useState<Record<string, boolean> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    try {
      const response = await fetch("/api/notifications/preferences", { headers: authHeaders(address) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.message || body?.error || `HTTP ${response.status}`)
      setPreferences(body.preferences ?? {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notification preferences.")
    }
  }, [address])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(key: string, value: boolean) {
    if (!address) return
    setBusy(key)
    setError(null)
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { ...authHeaders(address), "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.message || body?.error || `HTTP ${response.status}`)
      setPreferences(body.preferences ?? preferences)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update preference.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose which push, email and Telegram alerts you receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <p className="text-sm text-muted-foreground">Connect your wallet to manage notification preferences.</p>
        ) : !preferences ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </div>
        ) : (
          ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={`notify-${row.key}`} className="text-sm">{row.label}</Label>
                <p className="text-xs text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                id={`notify-${row.key}`}
                checked={preferences[row.key] ?? true}
                disabled={busy === row.key}
                onCheckedChange={(value) => void toggle(row.key, value)}
              />
            </div>
          ))
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
