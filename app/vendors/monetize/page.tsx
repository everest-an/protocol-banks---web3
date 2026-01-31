"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useMonetizeConfig, type APIKey } from "@/hooks/use-monetize-config"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import {
  DollarSign,
  Key,
  BarChart3,
  Copy,
  Eye,
  EyeOff,
  TrendingUp,
  Shield,
  Zap,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart,
} from "recharts"

export default function MonetizePage() {
  const { toast } = useToast()
  const { isConnected, address } = useWeb3()
  const { isDemoMode } = useDemo()
  const [showApiKey, setShowApiKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyTier, setNewKeyTier] = useState("free")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  // Use Monetize Config hook for real API integration
  const {
    config,
    apiKeys,
    usage: usageData,
    totalRevenue,
    totalCalls,
    createAPIKey,
    revokeAPIKey,
    updateConfig,
    loading,
    error,
    refresh,
  } = useMonetizeConfig()
  
  // Local state for settings form
  const [monetizationEnabled, setMonetizationEnabled] = useState(config.enabled)
  const [rateLimitEnabled, setRateLimitEnabled] = useState(config.rateLimitEnabled)

  // Sync local state with hook config
  useEffect(() => {
    setMonetizationEnabled(config.enabled)
    setRateLimitEnabled(config.rateLimitEnabled)
  }, [config])

  const avgCallsPerDay = totalCalls > 0 ? Math.round(totalCalls / 30) : 0
  const errorRate = totalCalls > 0 ? "0.5" : "0"

  const copyApiKey = (keyPrefix: string) => {
    navigator.clipboard.writeText(keyPrefix)
    toast({ title: "Copied", description: "API key prefix copied to clipboard" })
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: "Error", description: "Please enter a name for the API key", variant: "destructive" })
      return
    }
    
    const result = await createAPIKey(newKeyName, newKeyTier)
    if (result) {
      setNewKeyName("")
      setNewKeyTier("free")
      setCreateDialogOpen(false)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    await revokeAPIKey(keyId)
  }

  const handleToggleMonetization = async (enabled: boolean) => {
    setMonetizationEnabled(enabled)
    await updateConfig({ enabled })
  }

  const handleSaveSettings = async () => {
    await updateConfig({
      enabled: monetizationEnabled,
      rateLimitEnabled,
    })
  }

  // Format usage data for charts
  const chartData = usageData.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }))

  if (!isConnected && !isDemoMode) {
    return (
      <main className="container mx-auto py-6 px-4 max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
            <p className="text-muted-foreground">Please connect your wallet to manage API monetization</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Monetization</h1>
          <p className="text-muted-foreground">Monetize your APIs and track usage analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={monetizationEnabled}
              onCheckedChange={handleToggleMonetization}
              id="monetization"
            />
            <Label htmlFor="monetization">Monetization {monetizationEnabled ? "On" : "Off"}</Label>
          </div>
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Generate a new API key for external integrations</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Production API"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keyTier">Tier</Label>
                  <Select value={newKeyTier} onValueChange={setNewKeyTier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {config.tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name} - {tier.price === 0 ? "Free" : `$${tier.price}/1k calls`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateKey}>Create Key</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Total API Calls</span>
            </div>
            <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Revenue</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Avg. Daily Calls</span>
            </div>
            <div className="text-2xl font-bold">{avgCallsPerDay.toLocaleString()}</div>
            <p className="text-xs text-emerald-400 mt-1">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Key className="h-4 w-4" />
              <span className="text-sm">Active Keys</span>
            </div>
            <div className="text-2xl font-bold">{apiKeys.filter(k => k.is_active).length}</div>
            <p className="text-xs text-muted-foreground mt-1">{apiKeys.length} total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Tiers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>API Usage Over Time</CardTitle>
              <CardDescription>Daily API calls for the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No usage data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorCalls)"
                      name="API Calls"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>Daily revenue from API usage</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No revenue data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(3)}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for external integrations</CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {key.key_prefix}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyApiKey(key.key_prefix)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{key.tier || "free"}</Badge>
                        </TableCell>
                        <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>{(key.usage_count || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              key.is_active
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }
                          >
                            {key.is_active ? "Active" : "Revoked"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {key.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {config.tiers.map((tier, index) => (
              <Card key={tier.id} className={index === 2 ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>
                    {tier.price === 0 ? "Free" : `$${tier.price.toFixed(2)} per 1000 calls`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-4">
                    {tier.rateLimit} calls/min
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Monetization Settings</CardTitle>
              <CardDescription>Configure your API monetization settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Monetization</Label>
                    <p className="text-sm text-muted-foreground">Charge for API usage</p>
                  </div>
                  <Switch
                    checked={monetizationEnabled}
                    onCheckedChange={setMonetizationEnabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rate Limiting</Label>
                    <p className="text-sm text-muted-foreground">Enforce rate limits per tier</p>
                  </div>
                  <Switch
                    checked={rateLimitEnabled}
                    onCheckedChange={setRateLimitEnabled}
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
