"use client"

import { useEffect, useState } from "react"
import { Wallet, KeyRound, PenLine, ShieldCheck, Loader2, ExternalLink, Send } from "lucide-react"
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
  publicTrackRecord: boolean
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
  const [busy, setBusy] = useState<"generate" | "prepare" | "approve" | "revoke" | "public" | "telegram" | null>(null)
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [telegramBound, setTelegramBound] = useState<boolean | null>(null)
  const [telegramLink, setTelegramLink] = useState<string | null>(null)

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

  const loadTelegram = async () => {
    if (!walletAddress) return
    try {
      const res = await fetch("/api/trading/telegram-link", { headers })
      if (res.ok) {
        const data = await res.json()
        setTelegramBound(Boolean(data.bound))
      }
    } catch {
      /* optional channel */
    }
  }

  useEffect(() => {
    loadStatus()
    loadLiveState()
    loadTelegram()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  useEffect(() => {
    if (!telegramLink || telegramBound) return
    const timer = window.setInterval(() => void loadTelegram(), 5_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramLink, telegramBound])

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

  const handlePrepare = async () => {
    setBusy("prepare")
    try {
      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "prepare" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not prepare the approval")
      setApprovePayload(data)
      toast({ title: "Approval ready", description: "Sign it in your wallet to arm the agent." })
    } catch (e) {
      toast({
        title: "Could not prepare approval",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  const handleRevoke = async () => {
    if (!walletAddress) return
    if (!window.confirm("Revoke the AI agent? It will stop trading and lose its signing key.")) return
    setBusy("revoke")
    try {
      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "revoke" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not revoke the agent")
      setApprovePayload(null)
      setLiveState(null)
      await loadStatus()
      toast({
        title: "Agent revoked",
        description: "The platform deleted its key. Revoke the agent on Hyperliquid as well for a full cut-off.",
      })
    } catch (e) {
      toast({
        title: "Revoke failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
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

  const handleTelegram = async () => {
    if (!walletAddress) return
    if (telegramBound) {
      window.location.href = "/settings/telegram"
      return
    }
    setBusy("telegram")
    try {
      const res = await fetch("/api/trading/telegram-link", { method: "POST", headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not create the Telegram link")
      setTelegramLink(data.url as string)
      toast({ title: "Telegram link ready", description: "Open it and press Start to bind this wallet." })
    } catch (e) {
      toast({
        title: "Could not start Telegram binding",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  const handleTogglePublic = async () => {
    if (!walletAddress || !status) return
    setBusy("public")
    try {
      const res = await fetch("/api/trading/live/agent-wallet", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "set-public-track-record", public: !status.publicTrackRecord }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not update the track record visibility")
      await loadStatus()
      toast({
        title: data.public ? "Public track record enabled" : "Public track record disabled",
        description: data.public
          ? "Your address will appear on the public track record for on-chain verification."
          : "Your account shows as an anonymized id again.",
      })
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Try again", variant: "destructive" })
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
          hint="Native USDC on Arbitrum (min $5) — use the app's Deposit button, it walks you through it. Start with $50-100: whatever you deposit is your maximum possible loss."
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
              : !status?.agentAddress
                ? "Create the agent wallet first."
                : approvePayload
                  ? "Your wallet will ask you to sign a Hyperliquid approval."
                  : "Agent exists — prepare the signature to continue."
          }
          action={
            status?.approved ? undefined : !status?.agentAddress ? undefined : !approvePayload ? (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handlePrepare}
                disabled={busy !== null}
              >
                {busy === "prepare" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                Prepare
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleApprove}
                disabled={busy !== null || !riskAccepted}
              >
                {busy === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                Sign & Approve
              </Button>
            )
          }
        />

        {/* Step 4 */}
        <StepRow
          index={4}
          title="Bind Telegram (optional)"
          done={telegramBound === true}
          hint={
            telegramBound
              ? "Bound — live trade alerts and account Q&A go to your private chat."
              : "Get live trade alerts and ask the bot about this account. One-time code, 15 minutes."
          }
          action={
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleTelegram}
              disabled={busy !== null}
            >
              {busy === "telegram" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {telegramBound ? "Manage" : "Bind"}
            </Button>
          }
        />
        {telegramLink && !telegramBound ? (
          <a
            href={telegramLink}
            target="_blank"
            rel="noreferrer"
            className="block break-all rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary underline underline-offset-2"
          >
            {telegramLink}
          </a>
        ) : null}

        {status?.agentAddress ? (
          <div className="flex justify-end border-t border-white/10 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleRevoke}
              disabled={busy !== null}
            >
              {busy === "revoke" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Revoke agent access
            </Button>
          </div>
        ) : null}

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

        {status?.approved && (
          <div className="rounded-lg border border-white/10 p-3 bg-white/30 dark:bg-black/20 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Public track record</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Publish this account's address so anyone can verify your live results on-chain. Off by default — your
                  account shows as an anonymized id.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={handleTogglePublic}
                disabled={busy !== null}
              >
                {status.publicTrackRecord ? "Disable" : "Enable"}
              </Button>
            </div>
            {status.publicTrackRecord && (
              <p className="text-[11px] text-muted-foreground">
                Live on{" "}
                <a href="/live-track-record" className="text-primary underline">
                  the track record
                </a>{" "}
                with an explorer link.
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
