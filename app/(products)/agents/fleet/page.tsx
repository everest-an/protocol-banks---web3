"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { useToast } from "@/hooks/use-toast"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ArrowLeft, Download, Pause, Play, RefreshCw, ShieldCheck, Users } from "lucide-react"

interface FleetBudget {
  id: string
  amount: string
  remaining: string
  used: string
  token: string
  period: string
}

interface FleetAgent {
  id: string
  name: string
  description: string | null
  type: string
  status: "active" | "paused" | "deactivated"
  lastActiveAt: string | null
  createdAt: string
  policy: Record<string, unknown> | null
  budgets: FleetBudget[]
  allocatedUsd: number
  remainingUsd: number
  usedUsd: number
  utilizationPct: number
  alerts: string[]
}

interface FleetResponse {
  totals: {
    agents: number
    active: number
    paused: number
    alerts: number
    allocatedUsd: number
    remainingUsd: number
    usedUsd: number
    spentTodayUsd: number
  }
  agents: FleetAgent[]
}

function usd(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
}

function policyNumber(policy: Record<string, unknown> | null, key: string) {
  const value = policy?.[key]
  return typeof value === "number" ? value : null
}

export default function AgentFleetPage() {
  const { address, isConnected } = useUnifiedWallet()
  const { toast } = useToast()
  const [data, setData] = useState<FleetResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [maxCall, setMaxCall] = useState("")
  const [dailyCap, setDailyCap] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!address) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/agents/fleet", { headers: authHeaders(address) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Could not load the agent fleet")
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the agent fleet")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [address])

  const visibleAgents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!data) return []
    if (!query) return data.agents
    return data.agents.filter((agent) => agent.name.toLowerCase().includes(query) || agent.id.toLowerCase().includes(query))
  }, [data, search])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((current) => {
      if (current.size === visibleAgents.length) return new Set()
      return new Set(visibleAgents.map((agent) => agent.id))
    })
  }

  const patch = async (agentIds: string[], payload: Record<string, unknown>) => {
    if (!address || !agentIds.length) return
    setBusy(true)
    try {
      const response = await fetch("/api/agents/fleet", {
        method: "PATCH",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ agentIds, ...payload }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Could not update agents")
      toast({ title: "Fleet updated", description: json.updated + " agent(s) updated." })
      setSelected(new Set())
      await load()
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const applyCaps = () => {
    const policy: Record<string, number> = {}
    if (maxCall) policy.maxNotionalUsd = Number(maxCall)
    if (dailyCap) policy.dailyCapUsd = Number(dailyCap)
    if (!Object.keys(policy).length) {
      toast({ title: "Enter a cap", description: "Set a max call or daily cap first.", variant: "destructive" })
      return
    }
    void patch([...selected], { policy })
  }

  const toggleStatus = (agent: FleetAgent) => {
    void patch([agent.id], { status: agent.status === "active" ? "paused" : "active" })
  }

  const exportCsv = () => {
    if (!data) return
    const header = ["id", "name", "status", "type", "allocatedUsd", "remainingUsd", "usedUsd", "lastActiveAt", "alerts"]
    const rows = data.agents.map((agent) => [
      agent.id,
      agent.name,
      agent.status,
      agent.type,
      agent.allocatedUsd,
      agent.remainingUsd,
      agent.usedUsd,
      agent.lastActiveAt || "",
      agent.alerts.join("; "),
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => JSON.stringify(String(cell))).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "agent-fleet.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!isConnected || !address) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <GlassCard>
          <GlassCardContent className="py-12 text-center text-sm text-muted-foreground">
            Connect your wallet to manage the agent fleet.
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/agents" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to agents
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Agent Fleet</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Budgets, caps, status and spend across every agent under this wallet.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.agents.length}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {error ? (
        <GlassCard>
          <GlassCardContent className="py-10 text-center text-sm text-destructive">{error}</GlassCardContent>
        </GlassCard>
      ) : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Agents", data.totals.agents],
            ["Active", data.totals.active],
            ["Paused", data.totals.paused],
            ["Allocated", usd(data.totals.allocatedUsd)],
            ["Remaining", usd(data.totals.remainingUsd)],
          ].map(([label, value]) => (
            <GlassCard key={String(label)}>
              <GlassCardContent className="py-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{value}</p>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      ) : null}

      {data && data.totals.alerts > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.totals.alerts} agent(s) need attention: paused/deactivated, missing budgets, over 80% used or no policy.</span>
        </div>
      ) : null}

      <GlassCard>
        <GlassCardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <GlassCardTitle>Fleet</GlassCardTitle>
              <GlassCardDescription>{selected.size ? selected.size + " selected" : "Select agents to apply caps in bulk."}</GlassCardDescription>
            </div>
            <Input className="w-full sm:w-64" placeholder="Search agents..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {selected.size > 0 ? (
            <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label>Max per call (USD)</Label>
                <Input type="number" min="1" placeholder="e.g. 500" value={maxCall} onChange={(event) => setMaxCall(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Daily cap (USD)</Label>
                <Input type="number" min="1" placeholder="e.g. 5000" value={dailyCap} onChange={(event) => setDailyCap(event.target.value)} />
              </div>
              <Button className="self-end" onClick={applyCaps} disabled={busy}>Apply caps</Button>
            </div>
          ) : null}

          {loading && !data ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading fleet...</p>
          ) : !visibleAgents.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agents yet. <Link href="/agents" className="underline">Create the first agent</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">
                      <input type="checkbox" checked={selected.size === visibleAgents.length && visibleAgents.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="py-2 pr-3 font-medium">Agent</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Caps</th>
                    <th className="py-2 pr-3 font-medium">Budget</th>
                    <th className="py-2 pr-3 font-medium">Used</th>
                    <th className="py-2 pr-3 font-medium">Alerts</th>
                    <th className="py-2 font-medium">Last active</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleAgents.map((agent) => (
                    <tr key={agent.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-2">
                        <input type="checkbox" checked={selected.has(agent.id)} onChange={() => toggle(agent.id)} />
                      </td>
                      <td className="py-3 pr-3">
                        <Link href={"/agents/" + agent.id} className="font-medium hover:underline">{agent.name}</Link>
                        <p className="font-mono text-[10px] text-muted-foreground">{agent.id.slice(0, 8)}...{agent.id.slice(-4)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={agent.status === "active" ? "secondary" : "outline"} className="text-[10px] h-5">{agent.status}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        <div>call {policyNumber(agent.policy, "maxNotionalUsd") ?? "-"}</div>
                        <div>day {policyNumber(agent.policy, "dailyCapUsd") ?? "-"}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        <div>{usd(agent.remainingUsd)} left</div>
                        <div className="text-muted-foreground">{usd(agent.allocatedUsd)} allocated</div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">{agent.utilizationPct}%</td>
                      <td className="py-3 pr-3">
                        {agent.alerts.length ? <Badge variant="outline" className="text-[10px] h-5 border-amber-500/30 text-amber-600">{agent.alerts.join(", ")}</Badge> : <span className="text-xs text-muted-foreground">ok</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">{agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleString() : "-"}</td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(agent)} disabled={busy || agent.status === "deactivated"}>
                          {agent.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}
