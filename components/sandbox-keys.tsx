"use client"

import { useState } from "react"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import { track } from "@/lib/analytics/events"

interface SandboxSession {
  sandbox: true
  source: string
  expiresAt: string
  serviceId: string
  quoteId: string
  buyer: { address: string; key: string }
  seller: { address: string; key: string }
}

function CopyButton({
  value,
  label,
  copied,
  onCopy,
}: {
  value: string
  label: string
  copied: string | null
  onCopy: (label: string, value: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(label, value)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#E4E2DD] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#6F6B64] hover:border-[#111111] hover:text-[#111111] transition"
      aria-label={`Copy ${label}`}
    >
      {copied === label ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied === label ? "copied" : "copy"}
    </button>
  )
}

export function SandboxKeys() {
  const [session, setSession] = useState<SandboxSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setError("Copy failed. Select the value and copy it manually.")
    }
  }

  async function createSession() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams(window.location.search)
      let stored: string | null = null
      try {
        stored = localStorage.getItem("pb_ref")
      } catch {
        stored = null
      }
      const source = params.get("ref") || params.get("utm_source") || stored || "direct"
      const response = await fetch("/api/sandbox/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Could not create sandbox keys.")
      setSession(body as SandboxSession)
      track("sandbox_key_created", { source: (body as SandboxSession).source })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create sandbox keys.")
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-[#E4E2DD] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6F6B64]">[ no wallet required ]</p>
            <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-[#6F6B64]">
              Get a disposable buyer key, a seller key and a live $1 quote. They work against the real API and the
              real database for 24 hours.
            </p>
          </div>
          <button
            type="button"
            onClick={createSession}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Creating keys" : "Create sandbox keys"}
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <p className="mt-4 text-xs text-[#6F6B64]">
          Three sessions per network per day. Keys expire automatically. The demo wallets are not controlled by anyone.
        </p>
      </div>
    )
  }

  const stateCommand = `curl -s https://www.protocolbanks.com/api/v1/agent/state \\
  -H "Authorization: Bearer ${session.buyer.key}"`

  const acceptCommand = `curl -s https://www.protocolbanks.com/api/v1/agent/commerce/quotes/accept \\
  -H "Authorization: Bearer ${session.buyer.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"quoteId":"${session.quoteId}"}'`

  const deliverCommand = `curl -s https://www.protocolbanks.com/api/v1/agent/commerce/orders/deliver \\
  -H "Authorization: Bearer ${session.seller.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId":"ORDER_ID","deliveryHash":"sha256:REPLACE_WITH_64_HEX"}'`

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E4E2DD] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6F6B64]">[ sandbox ready ]</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6F6B64]">
              Expires {new Date(session.expiresAt).toLocaleString()}. Quote{" "}
              <span className="font-mono text-xs text-[#111111]">{session.quoteId}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={createSession}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] px-3 py-2 text-xs text-[#6F6B64] transition hover:bg-[#F7F6F3] hover:text-[#111111] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            New session
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#E4E2DD] bg-[#F7F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">buyer key</p>
              <CopyButton value={session.buyer.key} label="buyer key" copied={copied} onCopy={copy} />
            </div>
            <code className="mt-2 block break-all font-mono text-[11px] leading-relaxed text-[#111111]">
              {session.buyer.key}
            </code>
            <p className="mt-2 break-all font-mono text-[10px] text-[#6F6B64]">{session.buyer.address}</p>
          </div>
          <div className="rounded-lg border border-[#E4E2DD] bg-[#F7F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">seller key</p>
              <CopyButton value={session.seller.key} label="seller key" copied={copied} onCopy={copy} />
            </div>
            <code className="mt-2 block break-all font-mono text-[11px] leading-relaxed text-[#111111]">
              {session.seller.key}
            </code>
            <p className="mt-2 break-all font-mono text-[10px] text-[#6F6B64]">{session.seller.address}</p>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#111111]">1. Read the buyer account</p>
            <CopyButton value={stateCommand} label="state command" copied={copied} onCopy={copy} />
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-4 font-mono text-xs leading-relaxed text-[#111111]">
            {stateCommand}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#111111]">2. Accept the $1 quote as the buyer</p>
            <CopyButton value={acceptCommand} label="accept command" copied={copied} onCopy={copy} />
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-4 font-mono text-xs leading-relaxed text-[#111111]">
            {acceptCommand}
          </pre>
          <p className="mt-2 text-xs text-[#6F6B64]">
            The response creates an order. Copy its <span className="font-mono">id</span> for the next step.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#111111]">3. Deliver as the seller</p>
            <CopyButton value={deliverCommand} label="deliver command" copied={copied} onCopy={copy} />
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-4 font-mono text-xs leading-relaxed text-[#111111]">
            {deliverCommand}
          </pre>
          <p className="mt-2 text-xs text-[#6F6B64]">
            Replace <span className="font-mono">ORDER_ID</span> and the hash. The order moves to delivered.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        Payment is not simulated. Sandbox wallets hold no funds and are not controlled by anyone — never send funds to
        them. A real payment needs a funded wallet and a signed EIP-3009 authorization.
      </div>
    </div>
  )
}
