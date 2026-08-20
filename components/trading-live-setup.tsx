"use client"

import { useEffect, useState } from "react"
import { Wallet, KeyRound, PenLine, ShieldCheck, Loader2, ExternalLink } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"

interface LiveStatus {
  available: boolean
  keySecretConfigured: boolean
  agentAddress: string | null
  approved: boolean
}

interface ApprovePayload {
  agentAddress: string
  agentName: string
  nonce: number
  typedData: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
    message: Record<string, unknown>
  }
}

interface LiveState {
  accountValue: number
  positions: { coin: string; side: string; size: number; unrealizedPnl: number }[]
}

const HYPERLIQUID_URL = "https://app.hyperliquid.xyz"

export function TradingLiveSetup({ walletAddress }: { walletAddress: string | undefined }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [approvePayload, setApprovePayload] = useState<ApprovePayload | null>(null)
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [busy, setBusy] = useState<"generate" | "approve" | null>(null)
  const [riskAccepted, setRiskAccepted] = useState(false)

  const headers = authHeaders(walletAddress, { "Content-Type": "application/json" })

  const loadStatus = async () => {
    if (!walletAddress) return
    try {
      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "status" }),
      })
      if (res.ok) setStatus((await res.json()).live)
    } catch {
      /* backend unavailable — stay silent */
    }
  }

  const loadLiveState = async () => {
    if (!walletAddress) return
    try {
      const res = await fetch("/api/trading/live/state", { headers })
      if (res.ok) setLiveState(await res.json())
    } catch {
      /* no state yet */
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  useEffect(() => {
    if (status?.approved) loadLiveState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.approved])

  const handleGenerate = async () => {
    setBusy("generate")
    try {
      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "generate" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent wallet")
      setApprovePayload(data)
      toast({ title: "Agent wallet created", description: "Now sign the approval in your wallet." })
    } catch (e) {
      toast({ title: "Could not create agent wallet", description: e instanceof Error ? e.message : "Try again", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const handleApprove = async () => {
    if (!approvePayload || !walletAddress) return
    setBusy("approve")
    try {
      const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).ethereum
      if (!provider) throw new Error("No wallet extension found. Install MetaMask to continue.")

      // Ask the user's wallet to sign the Hyperliquid approveAgent typed data.
      const rawSig = await provider.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(approvePayload.typedData)],
      })
      if (!rawSig || rawSig.length < 132) throw new Error("Invalid wallet signature")

      const signature = {
        r: "0x" + rawSig.slice(2, 66),
        s: "0x" + rawSig.slice(66, 130),
        v: parseInt(rawSig.slice(130, 132), 16),
      }

      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "approve",
          agentAddress: approvePayload.agentAddress,
          agentName: approvePayload.agentName,
          nonce: approvePayload.nonce,
          signature,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Approval submission failed")

      toast({ title: "Agent approved", description: "Your AI agent can now trade on your behalf (no withdrawal rights)." })
      setApprovePayload(null)
      await loadStatus()
    } catch (e) {
      toast({ title: "Approval failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  if (!walletAddress) {
    return (
      <GlassCard>
        <GlassCardContent className="py-6 text-center">
          <Wallet className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Connect your wallet to start live trading.</p>
        </GlassCardContent>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-base">Go Live</GlassCardTitle>
          {status?.approved && (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Agent approved
            </Badge>
          )}
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Live mode lets the AI trade with real funds on Hyperliquid. The agent gets{" "}
          <span className="text-foreground font-medium">trading-only</span> rights — it can never
          withdraw. Paper mode keeps running alongside until you switch.
        </p>

        {/* Step 1 */}
        <StepRow
          index={1}
          title="Fund your Hyperliquid account"
          done={!!liveState}
          hint="Deposit USDC to your wallet address on Hyperliquid."
          action={
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
              <a href={HYPERLIQUID_URL} target="_blank" rel="noopener noreferrer">
                Open Hyperliquid <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          }
        />

        {/* Step 2 */}
        <StepRow
          index={2}
          title="Create the agent wallet"
          done={!!status?.agentAddress}
          hint={status?.agentAddress ? `Agent: ${status.agentAddress.slice(0, 10)}…${status.agentAddress.slice(-6)}` : "The platform generates a key for the agent."}
          action={
            status?.agentAddress ? undefined : (
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleGenerate} disabled={busy !== null}>
                {busy === "generate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                Create
              </Button>
            )
          }
        />

        {/* Step 3 */}
        <StepRow
          index={3}
          title="Sign the approval"
          done={status?.approved ?? false}
          hint={
            status?.approved
              ? "Approved — the agent can trade, not withdraw."
              : approvePayload
                ? "Your wallet will ask you to sign a Hyperliquid approval."
                : "One signature in MetaMask."
          }
          action={
            status?.approved ? undefined : (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleApprove}
                disabled={!approvePayload || busy !== null || !riskAccepted}
              >
                {busy === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                Sign & Approve
              </Button>
            )
          }
        />

        {!status?.approved && (
          <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-white/10 p-3 bg-white/30 dark:bg-black/20">
            <input
              type="checkbox"
              checked={riskAccepted}
              onChange={(e) => setRiskAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I have read and accept the{" "}
              <a href="/risk-disclosure" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Risk Disclosure
              </a>
              . I understand the AI can lose my entire trading wallet, and past performance does not guarantee future
              results.
            </span>
          </label>
        )}

        {liveState && (
          <div className="rounded-lg border border-white/10 p-3 bg-white/30 dark:bg-black/20">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Hyperliquid account value</p>
              <p className="text-sm font-mono font-semibold tabular-nums">
                ${liveState.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            {liveState.positions.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {liveState.positions.length} open position{liveState.positions.length === 1 ? "" : "s"} on Hyperliquid
              </p>
            )}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}

function StepRow({
  index,
  title,
  hint,
  done,
  action,
}: {
  index: number
  title: string
  hint: string
  done: boolean
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
          done ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary"
        }`}
      >
        {done ? "✓" : index}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{hint}</p>
      </div>
      {action}
    </div>
  )
}
