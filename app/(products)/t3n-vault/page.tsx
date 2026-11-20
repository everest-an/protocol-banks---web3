"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"

type CheckResult = {
  answers: Record<string, boolean>
  allPassed: boolean
  configured: boolean
  customerDid: string | null
  contractId: string | null
}

export default function T3nVaultPage() {
  const { address, isConnected } = useUnifiedWallet()
  const [status, setStatus] = useState<{ configured: boolean } | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState({
    kyc_verified: true,
    id_not_expired: true,
    residency_in: "HK,SG,GB",
    account_open_min_months: 12,
  })

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/t3n/status")
      const body = await response.json()
      if (response.ok) setStatus(body)
    } catch {
      /* optional integration */
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const check = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const endpoint = address ? "/api/t3n/vendor-check" : "/api/t3n/demo"
      const response = await fetch(
        endpoint,
        address
          ? {
              method: "POST",
              headers: authHeaders(address, { "Content-Type": "application/json" }),
              body: JSON.stringify({
                rules: {
                  kyc_verified: rules.kyc_verified,
                  id_not_expired: rules.id_not_expired,
                  residency_in: rules.residency_in
                    .split(",")
                    .map((value) => value.trim().toUpperCase())
                    .filter(Boolean),
                  account_open_min_months: Number(rules.account_open_min_months),
                },
              }),
            }
          : { cache: "no-store" },
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setResult(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3">
          <LockKeyhole className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">T3N Private Vendor Vault</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The agent asks yes/no eligibility questions. The vendor&apos;s bank and identity data never enter
            Protocol Bank&apos;s logs, model context, or application memory.
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Runtime</span>
          <span className={`text-xs ${status?.configured ? "text-emerald-600" : "text-amber-600"}`}>
            {status?.configured ? "T3N agent configured" : "T3N credentials not configured"}
          </span>
        </div>
        {!isConnected ? (
          <p className="mt-2 text-xs text-muted-foreground">Connect a wallet to call the authenticated check.</p>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">Ask the vault</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>KYC verified</span>
              <input
                type="checkbox"
                checked={rules.kyc_verified}
                onChange={(event) => setRules((current) => ({ ...current, kyc_verified: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>ID not expired</span>
              <input
                type="checkbox"
                checked={rules.id_not_expired}
                onChange={(event) => setRules((current) => ({ ...current, id_not_expired: event.target.checked }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Allowed residence countries</span>
              <input
                value={rules.residency_in}
                onChange={(event) => setRules((current) => ({ ...current, residency_in: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Account open at least (months)</span>
              <input
                type="number"
                value={rules.account_open_min_months}
                onChange={(event) =>
                  setRules((current) => ({ ...current, account_open_min_months: Number(event.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <button
            onClick={() => void check()}
            disabled={busy || !status?.configured}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {address ? "Check vendor" : "Run demo check"}
          </button>
          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">Answers</h2>
          {result ? (
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(result.answers).map(([rule, passed]) => (
                <div key={rule} className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-0">
                  <span className="text-muted-foreground">{rule}</span>
                  <span className={passed ? "text-emerald-600" : "text-red-600"}>{passed ? "pass" : "fail"}</span>
                </div>
              ))}
              <p className={`pt-2 text-xs ${result.allPassed ? "text-emerald-600" : "text-red-600"}`}>
                {result.allPassed ? "All requested rules passed." : "At least one rule failed."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No answers yet. The response contains booleans, not the underlying vendor record.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border p-5 text-xs text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">Trust boundary</h2>
        <p className="mt-2">
          The data owner stores the record in a T3N vault and grants the agent only <code>check</code>. The agent
          cannot call <code>store</code> or <code>forget</code>, cannot read raw fields, and cannot reach any external
          host through this contract.
        </p>
      </div>
    </div>
  )
}
