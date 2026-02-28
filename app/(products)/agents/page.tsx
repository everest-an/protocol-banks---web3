"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Bot, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Settings, Pause, Play, Activity, Globe, Zap, Shield, FileText } from "lucide-react"
import Link from "next/link"

interface Agent {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'deactivated'
  api_key_prefix: string
  webhook_url?: string
  auto_execute_enabled: boolean
  auto_execute_max_amount?: string
  created_at: string
  last_active_at?: string
  budget?: {
    total: string
    spent: string
    remaining: string
  }
  session_key_address?: string
  allowed_tokens?: string[]
  max_per_tx?: string
}

// Demo data for preview when no wallet is connected
const demoAgents: Agent[] = [
  {
    id: "agent_demo_1",
    name: "Payroll Agent",
    description: "Automated monthly salary distribution to team members across multiple chains",
    status: "active",
    api_key_prefix: "pb_sk_payroll",
    webhook_url: "https://api.company.io/webhooks/payroll",
    auto_execute_enabled: true,
    auto_execute_max_amount: "5000",
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    last_active_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    budget: {
      total: "50000",
      spent: "32450",
      remaining: "17550",
    },
    session_key_address: "0x7a3B...9f2E",
    allowed_tokens: ["USDC", "USDT", "DAI"],
    max_per_tx: "5000",
  },
  {
    id: "agent_demo_2",
    name: "DCA Bot",
    description: "Dollar cost averaging into ETH -- buys $200 worth every Monday and Thursday",
    status: "active",
    api_key_prefix: "pb_sk_dcabot",
    auto_execute_enabled: true,
    auto_execute_max_amount: "200",
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    last_active_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    budget: {
      total: "10000",
      spent: "4800",
      remaining: "5200",
    },
    session_key_address: "0x2eC4...d71A",
    allowed_tokens: ["USDC"],
    max_per_tx: "200",
  },
  {
    id: "agent_demo_3",
    name: "Subscription Manager",
    description: "Auto-pay for SaaS services, infrastructure costs, and recurring vendor invoices",
    status: "paused",
    api_key_prefix: "pb_sk_submgr",
    webhook_url: "https://billing.internal/hooks/protocol-bank",
    auto_execute_enabled: true,
    auto_execute_max_amount: "500",
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_active_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    budget: {
      total: "6000",
      spent: "1850",
      remaining: "4150",
    },
    session_key_address: "0xf8A1...3c5D",
    allowed_tokens: ["USDC", "USDT"],
    max_per_tx: "500",
  },
]

export default function AgentsPage() {
  const { address } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Form state
  const [agentName, setAgentName] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(false)
  const [autoExecuteMaxAmount, setAutoExecuteMaxAmount] = useState("")

  useEffect(() => {
    loadAgents()
  }, [address, isDemoMode])

  const loadAgents = async () => {
    setLoading(true)
    try {
      if (isDemoMode || !address) {
        setAgents(demoAgents)
      } else {
        const response = await fetch(`/api/agents?owner=${address}`)
        if (response.ok) {
          const data = await response.json()
          setAgents(data.agents || [])
        }
      }
    } catch (error) {
      console.error("Failed to load agents:", error)
    } finally {
      setLoading(false)
    }
  }

  const isPreviewMode = isDemoMode || !address

  const handleCreateAgent = async () => {
    if (!agentName) return

    if (isPreviewMode) {
      const demoAgent: Agent = {
        id: `agent_demo_${Date.now()}`,
        name: agentName,
        description: agentDescription,
        status: "active",
        api_key_prefix: `pb_sk_${agentName.toLowerCase().replace(/\s+/g, "").slice(0, 6)}`,
        webhook_url: webhookUrl || undefined,
        auto_execute_enabled: autoExecuteEnabled,
        auto_execute_max_amount: autoExecuteMaxAmount || undefined,
        created_at: new Date().toISOString(),
        last_active_at: undefined,
        budget: { total: "0", spent: "0", remaining: "0" },
        session_key_address: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        allowed_tokens: ["USDC"],
        max_per_tx: autoExecuteMaxAmount || "100",
      }
      setNewApiKey("pb_sk_demo_" + Math.random().toString(36).slice(2, 18))
      setAgents((prev) => [demoAgent, ...prev])
      toast({
        title: "Agent Created (Preview)",
        description: "This is demo data. Connect your wallet to create real agents.",
      })
      setAgentName("")
      setAgentDescription("")
      setWebhookUrl("")
      setAutoExecuteEnabled(false)
      setAutoExecuteMaxAmount("")
      return
    }

    if (!address) return

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: agentName,
          description: agentDescription,
          owner_address: address,
          webhook_url: webhookUrl || undefined,
          auto_execute_enabled: autoExecuteEnabled,
          auto_execute_max_amount: autoExecuteMaxAmount || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setNewApiKey(data.api_key)
        setAgents((prev) => [data.agent, ...prev])
        toast({
          title: "Agent Created",
          description: "Make sure to copy your API key now. It won't be shown again.",
        })
        // Reset form
        setAgentName("")
        setAgentDescription("")
        setWebhookUrl("")
        setAutoExecuteEnabled(false)
        setAutoExecuteMaxAmount("")
      } else {
        throw new Error('Failed to create agent')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create agent",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return

    if (isPreviewMode) {
      setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id))
      toast({ title: "Agent Deactivated (Preview)" })
      setDeleteDialogOpen(false)
      setSelectedAgent(null)
      return
    }

    if (!address) return

    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: 'DELETE',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner_address: address }),
      })

      if (response.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id))
        toast({ title: "Agent Deactivated" })
      } else {
        throw new Error('Failed to deactivate agent')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate agent",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedAgent(null)
    }
  }

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active'

    if (isPreviewMode) {
      setAgents((prev) => prev.map((a) =>
        a.id === agent.id ? { ...a, status: newStatus } : a
      ))
      toast({ title: `Agent ${newStatus === 'active' ? 'Resumed' : 'Paused'} (Preview)` })
      return
    }

    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner_address: address,
          status: newStatus
        }),
      })

      if (response.ok) {
        setAgents((prev) => prev.map((a) =>
          a.id === agent.id ? { ...a, status: newStatus } : a
        ))
        toast({ title: `Agent ${newStatus === 'active' ? 'Resumed' : 'Paused'}` })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      })
    }
  }

  const handlePauseAll = async () => {
    if (isPreviewMode) {
      setAgents((prev) => prev.map((a) => ({ ...a, status: 'paused' as const })))
      toast({ title: "All Agents Paused (Preview)", description: "Emergency pause activated" })
      return
    }

    try {
      const response = await fetch('/api/agents/pause-all', {
        method: 'POST',
        headers: authHeaders(address, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner_address: address }),
      })

      if (response.ok) {
        setAgents((prev) => prev.map((a) => ({ ...a, status: 'paused' as const })))
        toast({ title: "All Agents Paused", description: "Emergency pause activated" })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to pause agents",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {isPreviewMode && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
          <div>
            <p className="font-medium text-yellow-500">Preview Mode</p>
            <p className="text-sm text-muted-foreground">
              You are viewing demo data. Connect your wallet to manage real AI agents.
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agent Management</h1>
          <p className="text-muted-foreground">Create and manage AI agents that can interact with Protocol Banks</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/proposals">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Proposals
            </Button>
          </Link>
          <Button variant="outline" onClick={handlePauseAll}>
            <Pause className="h-4 w-4 mr-2" />
            Pause All
          </Button>
          <Dialog
            open={createDialogOpen}
            onOpenChange={(open: boolean) => {
              setCreateDialogOpen(open)
              if (!open) {
                setNewApiKey(null)
                setShowApiKey(false)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New AI Agent</DialogTitle>
                <DialogDescription>
                  {newApiKey
                    ? "Your agent has been created. Copy the API key now - it won't be shown again."
                    : "Configure your AI agent with permissions and auto-execute rules."}
                </DialogDescription>
              </DialogHeader>

              {newApiKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-yellow-500">Save your API key</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This is the only time you will see this key. Store it securely.
                    </p>
                  </div>
                  <div className="relative">
                    <Input
                      value={showApiKey ? newApiKey : "•".repeat(40)}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowApiKey(!showApiKey)}>
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(newApiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setCreateDialogOpen(false)
                        setNewApiKey(null)
                      }}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Agent Name</Label>
                    <Input placeholder="My AI Agent" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="What does this agent do?" 
                      value={agentDescription} 
                      onChange={(e) => setAgentDescription(e.target.value)} 
                    />
                  </div>

                  <div>
                    <Label>Webhook URL (optional)</Label>
                    <Input 
                      placeholder="https://your-server.com/webhook" 
                      value={webhookUrl} 
                      onChange={(e) => setWebhookUrl(e.target.value)} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Execute Payments</Label>
                      <p className="text-sm text-muted-foreground">Allow agent to execute payments automatically</p>
                    </div>
                    <Switch 
                      checked={autoExecuteEnabled} 
                      onCheckedChange={setAutoExecuteEnabled} 
                    />
                  </div>

                  {autoExecuteEnabled && (
                    <div>
                      <Label>Max Auto-Execute Amount (USDC)</Label>
                      <Input 
                        type="number" 
                        placeholder="100" 
                        value={autoExecuteMaxAmount} 
                        onChange={(e) => setAutoExecuteMaxAmount(e.target.value)} 
                      />
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateAgent} disabled={!agentName}>
                      Create Agent
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Your AI Agents
          </GlassCardTitle>
          <GlassCardDescription>Manage AI agents that can create payment proposals and execute transactions</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No agents yet. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Auto-Execute</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        {agent.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {agent.description}
                          </div>
                        )}
                        {agent.allowed_tokens && agent.allowed_tokens.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {agent.allowed_tokens.map((token) => (
                              <Badge key={token} variant="outline" className="text-xs px-1.5 py-0">
                                {token}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{agent.api_key_prefix}...</TableCell>
                    <TableCell>
                      {agent.auto_execute_enabled ? (
                        <Badge variant="secondary">
                          Up to {agent.auto_execute_max_amount || '∞'} USDC
                        </Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.budget ? (
                        <div className="text-sm">
                          <div className="font-medium">${Number(agent.budget.remaining).toLocaleString()} left</div>
                          <div className="text-muted-foreground text-xs">
                            ${Number(agent.budget.spent).toLocaleString()} / ${Number(agent.budget.total).toLocaleString()}
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${Math.min(100, (Number(agent.budget.spent) / Number(agent.budget.total)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          agent.status === 'active' ? 'default' :
                          agent.status === 'paused' ? 'secondary' : 'destructive'
                        }
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {agent.last_active_at 
                        ? new Date(agent.last_active_at).toLocaleDateString() 
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(agent)}
                          disabled={agent.status === 'deactivated'}
                        >
                          {agent.status === 'active' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Link href={`/agents/${agent.id}`}>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/agents/${agent.id}?tab=activity`}>
                          <Button variant="ghost" size="icon" title="View Activity">
                            <Activity className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedAgent(agent)
                            setDeleteDialogOpen(true)
                          }}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &ldquo;{selectedAgent?.name}&rdquo;? This action cannot be undone and the agent
              will no longer be able to create proposals or execute payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAgent} className="bg-destructive">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Protocol Endpoints */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <GlassCardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-purple-500" />
              <h3 className="font-semibold text-sm">ERC-8004 Agent Card</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Discoverable identity card for AI agents. External agents can find your platform capabilities here.
            </p>
            <div className="flex items-center gap-1.5">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                /.well-known/agent.json
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(`${window.location.origin}/.well-known/agent.json`)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm">A2A Protocol</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Agent-to-Agent signed JSON-RPC 2.0 messaging with EIP-191 signatures and nonce replay protection.
            </p>
            <div className="flex items-center gap-1.5">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                POST /api/a2a
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(`${window.location.origin}/api/a2a`)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-cyan-500" />
              <h3 className="font-semibold text-sm">MCP Server</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              8 payment tools for Claude, GPT, and AI models. Streamable HTTP transport with JWT authentication.
            </p>
            <div className="flex items-center gap-1.5">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                POST /api/mcp
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(`${window.location.origin}/api/mcp`)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* SIWE Auth Info */}
      <GlassCard className="mt-4">
        <GlassCardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-green-500" />
            <h3 className="font-semibold text-sm">AI Wallet SDK (SIWE Authentication)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            AI agents can authenticate autonomously using Sign-In with Ethereum (EIP-4361). No browser needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-muted p-3 rounded">
              <div className="font-medium mb-1">1. Get Nonce</div>
              <code className="text-muted-foreground">GET /api/auth/siwe/nonce</code>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="font-medium mb-1">2. Sign &amp; Verify</div>
              <code className="text-muted-foreground">POST /api/auth/siwe/verify</code>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="font-medium mb-1">3. Refresh Token</div>
              <code className="text-muted-foreground">POST /api/auth/siwe/refresh</code>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}
