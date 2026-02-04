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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useMonetizeConfig } from "@/hooks/use-monetize-config"
import { UsageChart } from "@/components/usage-chart"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import {
  DollarSign,
  Key,
  BarChart3,
  Settings,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import {
  LineChart,
  Line,
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

interface APIKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string | null
  calls: number
  status: "active" | "revoked"
}

interface UsageData {
  date: string
  calls: number
  revenue: number
  errors: number
}

interface PricingTier {
  name: string
  pricePerCall: number
  monthlyLimit: number
  features: string[]
}

export default function MonetizePage() {
  const { toast } = useToast()
  const { wallets, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [showApiKey, setShowApiKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  
  // Use Monetize Config hook for API integration
  const {
    config: hookConfig,
    apiKeys: hookApiKeys,
    usage: hookUsage,
    createAPIKey: hookCreateApiKey,
    revokeAPIKey: hookRevokeApiKey,
    updateConfig: hookUpdateConfig,
    loading: hookLoading,
    error: hookError,
  } = useMonetizeConfig()
  
  // Monetization settings (use hook data if available)
  const [monetizationEnabled, setMonetizationEnabled] = useState(hookConfig?.enabled ?? true)
  const [pricePerCall, setPricePerCall] = useState("0.001")
  const [monthlyLimit, setMonthlyLimit] = useState("10000")

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await new Promise((r) => setTimeout(r, 500))

      // Demo API keys
      setApiKeys([
        {
          id: "key_1",
          name: "Production API",
          key: "pk_live_51Hb8J2EZvKYlo2CXD9X8E5xY",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          calls: 15432,
          status: "active",
        },
        {
          id: "key_2",
          name: "Development API",
          key: "pk_test_51Hb8J2EZvKYlo2CXD9X8E5xY",
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          calls: 2341,
          status: "active",
        },
      ])

      // Generate usage data for last 30 days
      const data: UsageData[] = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const baseCalls = 400 + Math.random() * 300
        const calls = Math.floor(baseCalls + (29 - i) * 15) // Trending up
        data.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          calls,
          revenue: calls * 0.001,
          errors: Math.floor(calls * 0.02 * Math.random()),
        })
      }
      setUsageData(data)
      setLoading(false)
    }
    loadData()
  }, [])

  const totalCalls = usageData.reduce((sum, d) => sum + d.calls, 0)
  const totalRevenue = usageData.reduce((sum, d) => sum + d.revenue, 0)
  const avgCallsPerDay = Math.round(totalCalls / 30)
  const errorRate = (usageData.reduce((sum, d) => sum + d.errors, 0) / totalCalls * 100).toFixed(2)

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast({ title: "Copied", description: "API key copied to clipboard" })
  }

  const generateNewKey = () => {
    const newKey: APIKey = {
      id: `key_${Date.now()}`,
      name: `API Key ${apiKeys.length + 1}`,
      key: `pk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      calls: 0,
      status: "active",
    }
    setApiKeys((prev) => [...prev, newKey])
    toast({ title: "API Key Created", description: "New API key has been generated" })
  }

  const revokeKey = (id: string) => {
    setApiKeys((prev) =>
      prev.map((key) => (key.id === id ? { ...key, status: "revoked" } : key))
    )
    toast({ title: "Key Revoked", description: "API key has been revoked" })
  }

  const PRICING_TIERS: PricingTier[] = [
    {
      name: "Free",
      pricePerCall: 0,
      monthlyLimit: 1000,
      features: ["Basic API access", "Community support"],
    },
    {
      name: "Developer",
      pricePerCall: 0.0005,
      monthlyLimit: 10000,
      features: ["Full API access", "Email support", "Analytics"],
    },
    {
      name: "Business",
      pricePerCall: 0.0003,
      monthlyLimit: 100000,
      features: ["Full API access", "Priority support", "Advanced analytics", "SLA guarantee"],
    },
    {
      name: "Enterprise",
      pricePerCall: 0.0001,
      monthlyLimit: -1,
      features: ["Unlimited calls", "Dedicated support", "Custom integrations", "99.99% SLA"],
    },
  ]

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
              onCheckedChange={setMonetizationEnabled}
              id="monetization"
            />
            <Label htmlFor="monetization">Monetization {monetizationEnabled ? "On" : "Off"}</Label>
          </div>
          <Button onClick={generateNewKey}>
            <Key className="h-4 w-4 mr-2" />
            New API Key
          </Button>
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
            <p className="text-xs text-emerald-400 mt-1">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Error Rate</span>
            </div>
            <div className="text-2xl font-bold">{errorRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Target: under 1%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>API Usage Over Time</CardTitle>
              <CardDescription>Daily API calls and revenue for the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={usageData}>
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
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={usageData}>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Calls</TableHead>
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
                            {showApiKey === key.id
                              ? key.key
                              : `${key.key.slice(0, 12)}...${key.key.slice(-4)}`}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                          >
                            {showApiKey === key.id ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyApiKey(key.key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>{key.calls.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            key.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }
                        >
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {key.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400"
                            onClick={() => revokeKey(key.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRICING_TIERS.map((tier) => (
              <Card key={tier.name} className={tier.name === "Business" ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>
                    {tier.pricePerCall === 0
                      ? "Free"
                      : `$${tier.pricePerCall.toFixed(4)} per call`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-4">
                    {tier.monthlyLimit === -1
                      ? "Unlimited"
                      : `${tier.monthlyLimit.toLocaleString()} calls/mo`}
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
              <CardDescription>Configure your API pricing and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="pricePerCall">Price Per Call (USD)</Label>
                  <Input
                    id="pricePerCall"
                    type="number"
                    step="0.0001"
                    value={pricePerCall}
                    onChange={(e) => setPricePerCall(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Amount charged per API call
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyLimit">Monthly Limit</Label>
                  <Input
                    id="monthlyLimit"
                    type="number"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum API calls per month per user
                  </p>
                </div>
              </div>
              <Button>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
