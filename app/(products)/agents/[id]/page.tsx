"use client"

import { useState, useEffect, use } from "react"
import { useSearchParams } from "next/navigation"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Bot, ArrowLeft, Save, Plus, Trash2, DollarSign, Clock, TrendingUp, RefreshCw, Eye, EyeOff, Copy, AlertTriangle, CreditCard, Snowflake, Wallet } from "lucide-react"
import Link from "next/link"

interface Agent {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'deactivated'
  webhook_url?: string
  auto_execute_enabled: boolean
  auto_execute_rules?: {
    max_single_amount?: string
    max_daily_amount?: string
    allowed_tokens?: string[]
    allowed_recipients?: string[]
    allowed_chains?: number[]
    policy?: unknown
  }
  created_at: string
}

interface Budget {
  id: string
  token: string
  amount: string
  used_amount: string
  remaining_amount: string
  period: 'daily' | 'weekly' | 'monthly' | 'total'
  period_start: string
  period_end?: string
}

interface AgentVirtualCard {
  id: string
  provider: string
  providerCardId: string
  last4: string | null
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'PENDING'
  balance: number
  currency: string
  label: string | null
  agentId: string
  createdAt: string
  updatedAt: string
}

interface AgentWallet {
  address: string
  chainType: 'EVM'
  status: 'active' | 'revoked'
  label: string | null
  createdAt: string
  updatedAt: string
  canSign: boolean
}

interface Activity {
  id: string
  action: string
  details: Record<string, unknown>
  created_at: string
}

const CARDS_LIVE = process.env.NEXT_PUBLIC_CARDS_LIVE === "true"
const AGENT_WALLET_LIVE = process.env.NEXT_PUBLIC_AGENT_WALLET_LIVE === "true"

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "settings"
  const [agent, setAgent] = useState<Agent | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [cards, setCards] = useState<AgentVirtualCard[]>([])
  const [wallet, setWallet] = useState<AgentWallet | null>(null)
  const [walletConfigured, setWalletConfigured] = useState(true)
  const [walletBusy, setWalletBusy] = useState<string | null>(null)
  const [walletMessage, setWalletMessage] = useState("Sign in to Protocol Bank")
  const [walletSignature, setWalletSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotatedKey, setRotatedKey] = useState<string | null>(null)
  const [showRotatedKey, setShowRotatedKey] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(false)
  const [autoExecuteMaxAmount, setAutoExecuteMaxAmount] = useState("")
  const [whitelist, setWhitelist] = useState("")

  // New budget form
  const [newBudgetToken, setNewBudgetToken] = useState("USDC")
  const [newBudgetAmount, setNewBudgetAmount] = useState("")
  const [newBudgetPeriod, setNewBudgetPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'total'>('monthly')

  // Agent card form
  const [newCardAmount, setNewCardAmount] = useState("")
  const [newCardLabel, setNewCardLabel] = useState("")
  const [cardBusy, setCardBusy] = useState<string | null>(null)

  useEffect(() => {
    if (address && id) {
      loadAgent()
      loadBudgets()
      loadActivities()
      loadCards()
      loadWallet()
    }
  }, [address, id])

  const loadAgent = async () => {
    try {
      const response = await fetch(`/api/agents/${id}?owner=${address}`)
      if (response.ok) {
        const data = await response.json()
        setAgent(data.agent)
        setName(data.agent.name)
        setDescription(data.agent.description || "")
        setWebhookUrl(data.agent.webhook_url || "")
        setAutoExecuteEnabled(data.agent.auto_execute_enabled)
        setAutoExecuteMaxAmount(data.agent.auto_execute_rules?.max_single_amount || "")
        setWhitelist(data.agent.auto_execute_rules?.allowed_recipients?.join("\n") || "")
      }
    } catch (error) {
      console.error("Failed to load agent:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadBudgets = async () => {
    try {
      const response = await fetch(`/api/agents/${id}/budgets?owner=${address}`)
      if (response.ok) {
        const data = await response.json()
        setBudgets(data.budgets || [])
      }
    } catch (error) {
      console.error("Failed to load budgets:", error)
    }
  }

  const loadActivities = async () => {
    try {
      const response = await fetch(`/api/agents/${id}/activities?owner=${address}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error("Failed to load activities:", error)
    }
  }

  const loadCards = async () => {
    try {
      const response = await fetch(`/api/agents/${id}/virtual-cards`, {
        headers: authHeaders(address),
      })
      if (response.ok) {
        const data = await response.json()
        setCards(data.cards || [])
      }
    } catch (error) {
      console.error("Failed to load cards:", error)
    }
  }

  const loadWallet = async () => {
    try {
      const response = await fetch(`/api/agents/${id}/wallet`, {
        headers: authHeaders(address),
      })
      if (response.ok) {
        const data = await response.json()
        setWallet(data.wallet || null)
        setWalletConfigured(data.configured !== false)
      }
    } catch (error) {
      console.error("Failed to load wallet:", error)
    }
  }

  const handleWalletAction = async (action: "create" | "rotate" | "revoke") => {
    if (!address) return
    setWalletBusy(action)
    try {
      const response = await fetch(`/api/agents/${id}/wallet`, {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Wallet operation failed")
      setWallet(data?.wallet ?? null)
      setWalletSignature(null)
      await loadWallet()
      toast({ title: `Wallet ${action} succeeded` })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Wallet operation failed",
        variant: "destructive",
      })
    } finally {
      setWalletBusy(null)
    }
  }

  const handleSignMessage = async () => {
    if (!address || !walletMessage) return
    setWalletBusy("sign")
    try {
      const response = await fetch(`/api/agents/${id}/wallet/sign`, {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ kind: "message", message: walletMessage }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Signing failed")
      setWalletSignature(data.signature)
      toast({ title: "Message signed" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Signing failed",
        variant: "destructive",
      })
    } finally {
      setWalletBusy(null)
    }
  }

  const handleSave = async () => {
    if (!address || !agent) return
    setSaving(true)

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name,
          description,
          webhook_url: webhookUrl || undefined,
          auto_execute_enabled: autoExecuteEnabled,
          auto_execute_rules: {
            ...(agent.auto_execute_rules ?? {}),
            max_single_amount: autoExecuteMaxAmount || undefined,
            allowed_recipients: whitelist.split("\n").map((s) => s.trim()).filter(Boolean),
          },
        }),
      })

      if (response.ok) {
        toast({ title: "Agent Updated" })
        loadAgent()
      } else {
        throw new Error('Failed to update agent')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agent",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRotateKey = async () => {
    if (!address) return
    setRotating(true)
    try {
      const response = await fetch(`/api/agents/${id}/rotate-key`, {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
      })
      if (response.ok) {
        const data = await response.json()
        setRotatedKey(data.api_key)
        setShowRotatedKey(false)
        toast({ title: "API Key Rotated", description: "Save the new key — it won't be shown again." })
      } else {
        throw new Error("Failed to rotate key")
      }
    } catch {
      toast({ title: "Error", description: "Failed to rotate API key", variant: "destructive" })
    } finally {
      setRotating(false)
    }
  }

  const handleAddBudget = async () => {
    if (!address || !newBudgetAmount) return

    try {
      const response = await fetch(`/api/agents/${id}/budgets`, {
        method: 'POST',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          token: newBudgetToken,
          amount: newBudgetAmount,
          period: newBudgetPeriod,
        }),
      })

      if (response.ok) {
        toast({ title: "Budget Added" })
        loadBudgets()
        setNewBudgetAmount("")
      } else {
        throw new Error('Failed to add budget')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add budget",
        variant: "destructive",
      })
    }
  }

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/agents/${id}/budgets/${budgetId}`, {
        method: 'DELETE',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner_address: address }),
      })

      if (response.ok) {
        toast({ title: "Budget Deleted" })
        loadBudgets()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete budget",
        variant: "destructive",
      })
    }
  }

  const handleCreateCard = async () => {
    if (!address || !newCardAmount) return
    setCardBusy("create")
    try {
      const response = await fetch(`/api/agents/${id}/virtual-cards`, {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          initialAmount: Number(newCardAmount),
          label: newCardLabel || undefined,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Failed to issue card")
      setNewCardAmount("")
      setNewCardLabel("")
      await loadCards()
      toast({ title: "Card issued" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to issue card",
        variant: "destructive",
      })
    } finally {
      setCardBusy(null)
    }
  }

  const handleCardAction = async (cardId: string, action: string, amount?: number) => {
    if (!address) return
    setCardBusy(cardId)
    try {
      const response = await fetch(`/api/agents/${id}/virtual-cards/${cardId}`, {
        method: "PATCH",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ action, ...(amount !== undefined ? { amount } : {}) }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Card action failed")
      await loadCards()
      toast({ title: `Card ${action} succeeded` })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Card action failed",
        variant: "destructive",
      })
    } finally {
      setCardBusy(null)
    }
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <GlassCard>
          <GlassCardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage this agent
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="container mx-auto py-8 px-4">
        <GlassCard>
          <GlassCardContent className="py-8 text-center text-muted-foreground">
            Agent not found
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            {agent.name}
          </h1>
          <p className="text-muted-foreground">Configure agent settings and budgets</p>
        </div>
        <Badge 
          variant={
            agent.status === 'active' ? 'default' : 
            agent.status === 'paused' ? 'secondary' : 'destructive'
          }
        >
          {agent.status}
        </Badge>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          {AGENT_WALLET_LIVE && <TabsTrigger value="wallet">Wallet</TabsTrigger>}
          {CARDS_LIVE && <TabsTrigger value="cards">Cards</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Agent Configuration</GlassCardTitle>
              <GlassCardDescription>Update agent settings and auto-execute rules</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <Label>Webhook URL</Label>
                <Input 
                  placeholder="https://your-server.com/webhook" 
                  value={webhookUrl} 
                  onChange={(e) => setWebhookUrl(e.target.value)} 
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Receive notifications when proposals are created or executed
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label>Auto-Execute Payments</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow agent to execute payments without manual approval
                    </p>
                  </div>
                  <Switch 
                    checked={autoExecuteEnabled} 
                    onCheckedChange={setAutoExecuteEnabled} 
                  />
                </div>

                {autoExecuteEnabled && (
                  <div className="space-y-4 pl-4 border-l-2">
                    <div>
                      <Label>Max Amount per Transaction (USDC)</Label>
                      <Input 
                        type="number" 
                        placeholder="100" 
                        value={autoExecuteMaxAmount} 
                        onChange={(e) => setAutoExecuteMaxAmount(e.target.value)} 
                      />
                    </div>

                    <div>
                      <Label>Whitelisted Addresses (one per line)</Label>
                      <Textarea 
                        placeholder="0x..."
                        value={whitelist}
                        onChange={(e) => setWhitelist(e.target.value)}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Only allow auto-execute to these addresses. Leave empty to allow all.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* API Key Rotation */}
          <GlassCard className="border-destructive/20">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4" />
                Rotate API Key
              </GlassCardTitle>
              <GlassCardDescription>
                Generate a new API key and immediately invalidate the current one.
                Any services using the old key will need to be updated.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              {rotatedKey ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                    <p className="text-sm text-yellow-600">Save this key now — it will not be shown again.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono truncate">
                      {showRotatedKey ? rotatedKey : "•".repeat(40)}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => setShowRotatedKey(!showRotatedKey)}>
                      {showRotatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => {
                      navigator.clipboard.writeText(rotatedKey)
                      toast({ title: "Copied to clipboard" })
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRotatedKey(null)}>
                    Done
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleRotateKey}
                  disabled={rotating}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${rotating ? "animate-spin" : ""}`} />
                  {rotating ? "Rotating..." : "Rotate API Key"}
                </Button>
              )}
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        <TabsContent value="budgets">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Spending Budgets
              </GlassCardTitle>
              <GlassCardDescription>Set spending limits for this agent</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="flex gap-4 mb-6 p-4 bg-muted rounded-lg">
                <div className="flex-1">
                  <Label>Token</Label>
                  <Input 
                    value={newBudgetToken} 
                    onChange={(e) => setNewBudgetToken(e.target.value)}
                    placeholder="USDC"
                  />
                </div>
                <div className="flex-1">
                  <Label>Max Amount</Label>
                  <Input 
                    type="number"
                    value={newBudgetAmount} 
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div className="flex-1">
                  <Label>Period</Label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={newBudgetPeriod}
                    onChange={(e) => setNewBudgetPeriod(e.target.value as typeof newBudgetPeriod)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="total">Total</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddBudget} disabled={!newBudgetAmount}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {budgets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No budgets configured. Add one above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.map((budget) => {
                      const limit = parseFloat(budget.amount) || 0
                      const used = parseFloat(budget.used_amount) || 0
                      const remaining = budget.remaining_amount !== undefined
                        ? parseFloat(budget.remaining_amount)
                        : limit - used
                      const usagePercent = limit > 0 ? (used / limit) * 100 : 0
                      return (
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">{budget.token}</TableCell>
                          <TableCell>{budget.amount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {budget.used_amount}
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${usagePercent > 80 ? 'bg-destructive' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={remaining < 0 ? 'text-destructive' : ''}>
                            {remaining.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{budget.period}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteBudget(budget.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        {AGENT_WALLET_LIVE && (<TabsContent value="wallet">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Agent Wallet
              </GlassCardTitle>
              <GlassCardDescription>
                Platform-custodied EVM wallet for this agent. The private key is encrypted at rest with AES-256-GCM; the agent signs under its policy.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-5">
              {!walletConfigured && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>AGENT_WALLET_SECRET is not configured. Set a 64-hex secret on the server before creating wallets.</span>
                </div>
              )}

              {wallet ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Address</div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-sm font-mono break-all">{wallet.address}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.address)
                            toast({ title: "Address copied" })
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {wallet.chainType} · created {new Date(wallet.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={wallet.status === "active" ? "default" : "destructive"}>
                      {wallet.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {wallet.status === "active" ? (
                      <Button
                        variant="destructive"
                        onClick={() => handleWalletAction("revoke")}
                        disabled={walletBusy === "revoke"}
                      >
                        {walletBusy === "revoke" ? "Revoking..." : "Revoke key material"}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleWalletAction("rotate")}
                        disabled={walletBusy === "rotate"}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${walletBusy === "rotate" ? "animate-spin" : ""}`} />
                        {walletBusy === "rotate" ? "Rotating..." : "Rotate to a new address"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    No wallet yet. Create one address for this agent; the private key stays encrypted on the server and is never returned by the API.
                  </p>
                  <Button
                    onClick={() => handleWalletAction("create")}
                    disabled={!walletConfigured || walletBusy === "create"}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {walletBusy === "create" ? "Creating..." : "Create agent wallet"}
                  </Button>
                </div>
              )}

              {wallet?.status === "active" && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <Label>Sign a message</Label>
                    <Textarea
                      value={walletMessage}
                      onChange={(e) => setWalletMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignMessage}
                    disabled={!walletMessage || walletBusy === "sign"}
                  >
                    {walletBusy === "sign" ? "Signing..." : "Sign with agent wallet"}
                  </Button>
                  {walletSignature && (
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xs text-muted-foreground mb-1">Signature</div>
                      <code className="text-xs break-all">{walletSignature}</code>
                    </div>
                  )}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
        )}

        {CARDS_LIVE && (<TabsContent value="cards">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Agent Cards
              </GlassCardTitle>
              <GlassCardDescription>
                Issue a virtual Visa card for this agent. The issuing partner holds the card balance.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-6">
              <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label>Initial amount (USD)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={newCardAmount}
                    onChange={(e) => setNewCardAmount(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div className="flex-1">
                  <Label>Label</Label>
                  <Input
                    value={newCardLabel}
                    onChange={(e) => setNewCardLabel(e.target.value)}
                    placeholder="Agent card"
                  />
                </div>
                <Button
                  onClick={handleCreateCard}
                  disabled={!newCardAmount || cardBusy === "create"}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {cardBusy === "create" ? "Issuing..." : "Issue card"}
                </Button>
              </div>

              {cards.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No card issued for this agent yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell>
                          <div className="font-medium">•••• {card.last4 ?? "----"}</div>
                          <div className="text-xs text-muted-foreground">{card.label || card.provider}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={card.status === "ACTIVE" ? "default" : card.status === "CLOSED" ? "destructive" : "secondary"}>
                            {card.status}
                          </Badge>
                        </TableCell>
                        <TableCell>${card.balance.toFixed(2)} {card.currency}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cardBusy === card.id || card.status === "CLOSED"}
                              onClick={() => {
                                const amount = window.prompt("Amount to add (USD)", "50")
                                if (amount) handleCardAction(card.id, "fund", Number(amount))
                              }}
                            >
                              Fund
                            </Button>
                            {card.status === "FROZEN" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={cardBusy === card.id}
                                onClick={() => handleCardAction(card.id, "unfreeze")}
                              >
                                Unfreeze
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={cardBusy === card.id || card.status === "CLOSED"}
                                onClick={() => handleCardAction(card.id, "freeze")}
                              >
                                <Snowflake className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              disabled={cardBusy === card.id || card.status === "CLOSED"}
                              onClick={() => handleCardAction(card.id, "terminate")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
        )}

        <TabsContent value="activity">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </GlassCardTitle>
              <GlassCardDescription>View agent actions and transactions</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="p-2 bg-muted rounded-full">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{activity.action}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                        {activity.details && Object.keys(activity.details).length > 0 && (
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
