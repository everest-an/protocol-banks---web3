"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authHeaders } from "@/lib/authenticated-fetch"

interface RiskAssessment {
  id: string
  reference_type: string
  reference_id: string
  user_address: string
  recipient: string | null
  amount: string
  token: string
  chain: string
  risk_score: number
  risk_level: string
  decision: string
  factors: Array<{ name: string; score: number; weight: number; reason: string }>
  reviewed_by: string | null
  created_at: string
}

interface Settlement {
  id: string
  settlement_id: string
  user_address: string
  token: string
  chain: string
  total_debits: string
  total_credits: string
  net_amount: string
  on_chain_balance: string | null
  ledger_balance: string | null
  discrepancy: string | null
  status: string
  resolution_notes: string | null
  created_at: string
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
    blocked: "bg-red-200 text-red-900",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[level] || "bg-gray-100 text-gray-800"}`}>
      {level.toUpperCase()}
    </span>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    approve: "bg-green-100 text-green-800",
    review: "bg-yellow-100 text-yellow-800",
    block: "bg-red-100 text-red-800",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[decision] || "bg-gray-100 text-gray-800"}`}>
      {decision.toUpperCase()}
    </span>
  )
}

export default function RiskReviewPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState("")

  // In production, fetch from admin-authenticated API
  const adminAddress = typeof window !== "undefined" ? localStorage.getItem("pb:admin:address") : null

  const fetchData = useCallback(async () => {
    if (!adminAddress) return
    setLoading(true)
    try {
      const [riskRes, settlementRes] = await Promise.all([
        fetch("/api/risk?view=history&limit=50", {
          headers: authHeaders(adminAddress),
        }),
        fetch("/api/settlements?status=discrepancy_found&limit=50", {
          headers: authHeaders(adminAddress),
        }),
      ])

      if (riskRes.ok) {
        const data = await riskRes.json()
        setAssessments(data.assessments || [])
      }
      if (settlementRes.ok) {
        const data = await settlementRes.json()
        setSettlements(data.records || [])
      }
    } catch (e) {
      console.error("Failed to fetch admin data:", e)
    } finally {
      setLoading(false)
    }
  }, [adminAddress])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleResolve = async (settlementId: string) => {
    if (!resolveNotes.trim() || !adminAddress) return
    try {
      const res = await fetch("/api/settlements", {
        method: "PATCH",
        headers: authHeaders(adminAddress, { "Content-Type": "application/json" }),
        body: JSON.stringify({ settlementId, notes: resolveNotes }),
      })
      if (res.ok) {
        setResolveId(null)
        setResolveNotes("")
        fetchData()
      }
    } catch (e) {
      console.error("Failed to resolve:", e)
    }
  }

  const reviewItems = assessments.filter((a) => a.decision === "review")
  const blockedItems = assessments.filter((a) => a.decision === "block")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk Review & Settlement Dashboard</h1>
        <p className="text-muted-foreground">Review flagged transactions and resolve settlement discrepancies</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{reviewItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blocked</CardDescription>
            <CardTitle className="text-3xl text-red-600">{blockedItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Discrepancies</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{settlements.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Assessments</CardDescription>
            <CardTitle className="text-3xl">{assessments.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="risk" className="w-full">
        <TabsList>
          <TabsTrigger value="risk">Risk Assessments</TabsTrigger>
          <TabsTrigger value="settlements">Settlement Discrepancies</TabsTrigger>
        </TabsList>

        {/* Risk Assessments Tab */}
        <TabsContent value="risk" className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : assessments.length === 0 ? (
            <p className="text-muted-foreground">No risk assessments found</p>
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => (
                <Card key={a.id} className={a.decision === "block" ? "border-red-300" : a.decision === "review" ? "border-yellow-300" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={a.risk_level} />
                        <DecisionBadge decision={a.decision} />
                        <span className="text-sm text-muted-foreground">{a.reference_type}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Score: {a.risk_score}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount: </span>
                        {a.amount} {a.token}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chain: </span>
                        {a.chain}
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">User: </span>
                        {a.user_address.slice(0, 10)}...
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">To: </span>
                        {a.recipient ? `${a.recipient.slice(0, 10)}...` : "N/A"}
                      </div>
                    </div>
                    {a.factors && a.factors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.factors.map((f, i) => (
                          <Badge key={i} variant={f.score > 50 ? "destructive" : "secondary"} className="text-xs">
                            {f.name}: {f.score}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settlement Discrepancies Tab */}
        <TabsContent value="settlements" className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : settlements.length === 0 ? (
            <p className="text-muted-foreground">No discrepancies found</p>
          ) : (
            <div className="space-y-3">
              {settlements.map((s) => (
                <Card key={s.id} className="border-orange-300">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.settlement_id}</Badge>
                        <Badge variant="destructive">{s.status.replace("_", " ")}</Badge>
                      </div>
                      <span className="text-sm font-medium">
                        {s.token} on {s.chain}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-2">
                      <div>
                        <span className="text-muted-foreground">On-chain: </span>
                        {s.on_chain_balance ?? "N/A"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ledger: </span>
                        {s.ledger_balance ?? "N/A"}
                      </div>
                      <div className="text-red-600 font-medium">
                        <span className="text-muted-foreground">Discrepancy: </span>
                        {s.discrepancy ?? "N/A"}
                      </div>
                    </div>
                    <div className="text-sm mt-1 truncate text-muted-foreground">
                      User: {s.user_address}
                    </div>

                    {resolveId === s.settlement_id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="Resolution notes..."
                          className="flex-1 px-3 py-1 border rounded text-sm"
                          value={resolveNotes}
                          onChange={(e) => setResolveNotes(e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleResolve(s.settlement_id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResolveId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setResolveId(s.settlement_id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
