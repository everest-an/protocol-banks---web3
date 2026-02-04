"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Bot, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Settings, Pause, Play, Activity } from "lucide-react"
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
}

export default function AgentsPage() {
  const { wallets } = useWeb3()
  const address = wallets.EVM
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
    if (address) {
      loadAgents()
    }
  }, [address])

  const loadAgents = async () => {
    if (!address) return
    setLoading(true)
    try {
      const response = await fetch(`/api/agents?owner=${address}`)
      if (response.ok) {
        const data = await response.json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error("Failed to load agents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAgent = async () => {
    if (!address || !agentName) return

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (!address || !selectedAgent) return

    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const newStatus = agent.status === 'active' ? 'paused' : 'active'
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const response = await fetch('/api/agents/pause-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage AI agents
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agent Management</h1>
          <p className="text-muted-foreground">Create and manage AI agents that can interact with Protocol Banks</p>
        </div>
        <div className="flex gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Your AI Agents
          </CardTitle>
          <CardDescription>Manage AI agents that can create payment proposals and execute transactions</CardDescription>
        </CardHeader>
        <CardContent>
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
                        <Link href={`/agents/${agent.id}/activity`}>
                          <Button variant="ghost" size="icon">
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
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{selectedAgent?.name}"? This action cannot be undone and the agent
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
    </div>
  )
}
