"use client"

import { useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import type { FinanceBudgetView } from "@/lib/finance/overview"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"

interface BudgetsProps {
  wallet: string
  budgets: FinanceBudgetView[]
  onChanged: () => void
}

function usd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
}

export function Budgets({ wallet, budgets, onChanged }: BudgetsProps) {
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!category.trim() || !amount) {
      setError("Enter a category and amount.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/finance/budgets", {
        method: "POST",
        headers: { ...authHeaders(wallet), "Content-Type": "application/json" },
        body: JSON.stringify({ category: category.trim(), amountUsd: Number(amount) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setCategory("")
      setAmount("")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save budget.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/finance/budgets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(wallet),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete budget.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No budgets for this month yet.</p>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{budget.category}</span>
                  <button
                    type="button"
                    onClick={() => void remove(budget.id)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label={`Remove ${budget.category} budget`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {usd(budget.spentUsd)} / {usd(budget.amountUsd)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${budget.percent >= 100 ? "bg-red-500" : budget.percent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, budget.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category (e.g. Software)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="Amount USD"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Set budget
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
