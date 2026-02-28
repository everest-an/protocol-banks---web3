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
import { Bot, ArrowLeft, Save, Plus, Trash2, DollarSign, Clock, TrendingUp } from "lucide-react"
import Link from "next/link"

interface Agent {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'deactivated'
  webhook_url?: string
  auto_execute_enabled: boolean
  auto_execute_max_amount?: string
  auto_execute_whitelist?: string[]
  auto_execute_allowed_tokens?: string[]
  created_at: string
}

interface Budget {
  id: string
  token_address: string
  token_symbol: string
  max_amount: string
  used_amount: string
  period: 'daily' | 'weekly' | 'monthly' | 'total'
  period_start: string
}

interface Activity {
  id: string
  action: string
  details: Record<string, unknown>
  created_at: string
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "settings"
  const [agent, setAgent] = useState<Agent | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (address && id) {
      loadAgent()
      loadBudgets()
      loadActivities()
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
        setAutoExecuteMaxAmount(data.agent.auto_execute_max_amount || "")
        setWhitelist(data.agent.auto_execute_whitelist?.join("\n") || "")
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

  const handleSave = async () => {
    if (!address || !agent) return
    setSaving(true)

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner_address: address,
          name,
          description,
          webhook_url: webhookUrl || undefined,
          auto_execute_enabled: autoExecuteEnabled,
          auto_execute_max_amount: autoExecuteMaxAmount || undefined,
          auto_execute_whitelist: whitelist.split("\n").filter(Boolean),
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

  const handleAddBudget = async () => {
    if (!address || !newBudgetAmount) return

    try {
      const response = await fetch(`/api/agents/${id}/budgets`, {
        method: 'POST',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner_address: address,
          token_symbol: newBudgetToken,
          max_amount: newBudgetAmount,
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
                      const remaining = parseFloat(budget.max_amount) - parseFloat(budget.used_amount)
                      const usagePercent = (parseFloat(budget.used_amount) / parseFloat(budget.max_amount)) * 100
                      return (
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">{budget.token_symbol}</TableCell>
                          <TableCell>{budget.max_amount}</TableCell>
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
