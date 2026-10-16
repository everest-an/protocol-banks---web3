"use client"

import { useState } from "react"
import { CornerDownLeft, Loader2, ShieldAlert, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { toAgentAction, type ValidatedRoute } from "@/lib/trading/nl-router"

interface Props {
  walletAddress: string | null | undefined
  authFetch: (url: string, init?: RequestInit) => Promise<Response>
  onRefresh: () => Promise<unknown>
}

/**
 * Ask-the-agent command bar.
 *
 * The sentence goes to POST /api/trading/nl-route, which answers with a
 * *proposed* action and a confirmation the server generated — nothing runs
 * until the user confirms here, and the confirmed action goes through the same
 * /api/trading/actions endpoint the buttons use, with the same server checks.
 * Read-only requests need no execution at all.
 */
export function TradingCommandBar({ walletAddress, authFetch, onRefresh }: Props) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [route, setRoute] = useState<ValidatedRoute | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const { toast } = useToast()

  // The router call spends a model request, so it stays behind a signed-in wallet.
  if (!walletAddress) return null

  const ask = async () => {
    const request = text.trim()
    if (!request || busy) return
    setBusy(true)
    setRoute(null)
    setRefusal(null)
    try {
      const res = await authFetch(`/api/trading/nl-route?wallet=${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; route?: ValidatedRoute; refused?: string; error?: string }
        | null
      if (!res.ok || !body) throw new Error(body?.error || `Router unavailable (${res.status})`)
      if (body.ok && body.route) setRoute(body.route)
      else setRefusal(body.refused ?? "That request does not map to a cockpit action.")
    } catch (e) {
      toast({
        title: "Could not route that",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!route || busy) return
    const payload = toAgentAction(route)
    setBusy(true)
    try {
      if (!payload) {
        // Read-only (or clarify/unsupported): nothing to execute.
        setRoute(null)
        setText("")
        await onRefresh()
        return
      }
      const res = await authFetch(`/api/trading/actions?wallet=${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || `Action failed (${res.status})`)
      }
      await onRefresh()
      toast({ title: "Done", description: route.confirmation })
      setRoute(null)
      setText("")
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 dark:border-white/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask()
          }}
          placeholder="Ask the agent — “pause trading”, “switch to manual approval”"
          maxLength={400}
          disabled={busy}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          aria-label="Ask the agent"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => void ask()}
          disabled={busy || !text.trim()}
          aria-label="Send"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CornerDownLeft className="h-3 w-3" />}
        </Button>
      </div>

      {route && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
          <p className="text-[11px] text-foreground">{route.confirmation}</p>
          {route.warnings.length > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-500">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {route.warnings.join(" ")}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => void confirm()} disabled={busy}>
              {toAgentAction(route) ? "Confirm" : "OK"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setRoute(null)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {refusal && <p className="text-[11px] text-muted-foreground">{refusal}</p>}
    </div>
  )
}
