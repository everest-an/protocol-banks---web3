"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DollarSign,
  TrendingUp,
  Percent,
  Shield,
  Settings,
  Download,
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  PieChart,
  BarChart3,
} from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { getSupabase } from "@/lib/supabase"
import { formatFee } from "@/lib/protocol-fees"

interface FeeStats {
  totalFeesCollected: number
  totalTransactionVolume: number
  transactionCount: number
  averageFeeRate: number
  pendingFees: number
  collectedFees: number
}

interface ProtocolFeeRecord {
  id: string
  transaction_amount: number
  fee_rate: number
  base_fee: number
  discount_amount: number
  final_fee: number
  from_address: string
  token_symbol: string
  chain_id: number
  status: string
  tier: string
  created_at: string
}

interface FeeConfig {
  config_key: string
  config_value: any
  description: string
}

export default function AdminFeesPage() {
  const { address, isConnected } = useWeb3()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FeeStats | null>(null)
  const [recentFees, setRecentFees] = useState<ProtocolFeeRecord[]>([])
  const [feeConfig, setFeeConfig] = useState<FeeConfig[]>([])
  const [dateRange, setDateRange] = useState("30d")
  const [refreshing, setRefreshing] = useState(false)

  // Config editing state
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [newBaseRate, setNewBaseRate] = useState("0.001")
  const [newMinFee, setNewMinFee] = useState("0.50")
  const [newMaxFee, setNewMaxFee] = useState("500")

  useEffect(() => {
    loadData()
  }, [dateRange])

  async function loadData() {
    setLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }

      // Calculate date range
      let startDate = new Date()
      switch (dateRange) {
        case "7d":
          startDate.setDate(startDate.getDate() - 7)
          break
        case "30d":
          startDate.setDate(startDate.getDate() - 30)
          break
        case "90d":
          startDate.setDate(startDate.getDate() - 90)
          break
        case "all":
          startDate = new Date(0)
          break
      }

      // Fetch fee stats using RPC
      const { data: statsData } = await supabase.rpc("get_protocol_fee_stats", {
        p_wallet: null,
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
      })

      if (statsData && statsData.length > 0) {
        setStats({
          totalFeesCollected: Number(statsData[0].total_fees_collected) || 0,
          totalTransactionVolume: Number(statsData[0].total_transaction_volume) || 0,
          transactionCount: Number(statsData[0].transaction_count) || 0,
          averageFeeRate: Number(statsData[0].average_fee_rate) || 0,
          pendingFees: Number(statsData[0].pending_fees) || 0,
          collectedFees: Number(statsData[0].collected_fees) || 0,
        })
      }

      // Fetch recent fees
      const { data: feesData } = await supabase
        .from("protocol_fees")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (feesData) {
        setRecentFees(feesData)
      }

      // Fetch fee config
      const { data: configData } = await supabase.from("fee_config").select("*")

      if (configData) {
        setFeeConfig(configData)

        // Set editing values from config
        const baseConfig = configData.find((c) => c.config_key === "base_fee_rate")
        if (baseConfig) {
          setNewBaseRate(String(baseConfig.config_value.rate || 0.001))
          setNewMinFee(String(baseConfig.config_value.min_fee_usd || 0.5))
          setNewMaxFee(String(baseConfig.config_value.max_fee_usd || 500))
        }
      }
    } catch (error) {
      console.error("Error loading fee data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  async function updateFeeConfig() {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { error } = await supabase
        .from("fee_config")
        .update({
          config_value: {
            rate: Number(newBaseRate),
            min_fee_usd: Number(newMinFee),
            max_fee_usd: Number(newMaxFee),
          },
          updated_by: address || "admin",
          updated_at: new Date().toISOString(),
        })
        .eq("config_key", "base_fee_rate")

      if (error) throw error

      setEditingConfig(null)
      await loadData()
    } catch (error) {
      console.error("Error updating config:", error)
    }
  }

  const securityReserveAmount = (stats?.totalFeesCollected || 0) * 0.2
  const operationsAmount = (stats?.totalFeesCollected || 0) * 0.5
  const growthAmount = (stats?.totalFeesCollected || 0) * 0.3

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Connect your wallet to access the fee administration dashboard</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Protocol Fee Administration</h1>
          <p className="text-muted-foreground">Manage fee collection and monitor revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFee(stats?.totalFeesCollected || 0)}</div>
            <p className="text-xs text-muted-foreground">From {stats?.transactionCount || 0} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.totalTransactionVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Effective Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.averageFeeRate || 0) * 100).toFixed(3)}%</div>
            <p className="text-xs text-muted-foreground">Average after discounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Collection</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatFee(stats?.pendingFees || 0)}</div>
            <p className="text-xs text-muted-foreground">Awaiting collection</p>
          </CardContent>
        </Card>
      </div>

      {/* Fund Allocation */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Security Reserve (20%)</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatFee(securityReserveAmount)}</div>
            <p className="text-xs text-muted-foreground">Audits, bug bounties, insurance</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Operations (50%)</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatFee(operationsAmount)}</div>
            <p className="text-xs text-muted-foreground">Team, infrastructure, support</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Growth Fund (30%)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatFee(growthAmount)}</div>
            <p className="text-xs text-muted-foreground">Development, marketing, expansion</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="config">Fee Configuration</TabsTrigger>
          <TabsTrigger value="tiers">Tier Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Fee Transactions</CardTitle>
              <CardDescription>Latest protocol fee records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No fee transactions recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell className="text-sm">{new Date(fee.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {fee.from_address.slice(0, 6)}...{fee.from_address.slice(-4)}
                        </TableCell>
                        <TableCell>
                          ${Number(fee.transaction_amount).toLocaleString()} {fee.token_symbol}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{formatFee(Number(fee.final_fee))}</span>
                            {Number(fee.discount_amount) > 0 && (
                              <span className="text-xs text-green-600">-{formatFee(Number(fee.discount_amount))}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {fee.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {fee.status === "collected" ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Collected
                            </Badge>
                          ) : fee.status === "pending" ? (
                            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-600 border-red-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {fee.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>Manage protocol fee settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium">Base Fee Settings</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Base Fee Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={(Number(newBaseRate) * 100).toFixed(2)}
                        onChange={(e) => setNewBaseRate(String(Number(e.target.value) / 100))}
                        placeholder="0.10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Current: {(Number(newBaseRate) * 100).toFixed(2)}% per transaction
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Fee (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newMinFee}
                        onChange={(e) => setNewMinFee(e.target.value)}
                        placeholder="0.50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Fee (USD)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={newMaxFee}
                        onChange={(e) => setNewMaxFee(e.target.value)}
                        placeholder="500"
                      />
                    </div>
                    <Button onClick={updateFeeConfig} className="w-full">
                      Update Base Fee Configuration
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Current Configuration</h4>
                  <div className="space-y-2">
                    {feeConfig.map((config) => (
                      <div key={config.config_key} className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-mono text-sm">{config.config_key}</div>
                        <div className="text-xs text-muted-foreground mt-1">{config.description}</div>
                        <pre className="text-xs bg-background p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(config.config_value, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers">
          <Card>
            <CardHeader>
              <CardTitle>Tier Distribution Analytics</CardTitle>
              <CardDescription>User distribution across pricing tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Standard Tier</span>
                  </div>
                  <div className="text-2xl font-bold">0% discount</div>
                  <p className="text-sm text-muted-foreground">Users with {"<"}$100K monthly volume</p>
                  <div className="text-xs text-muted-foreground">Base fee: 0.1%</div>
                </div>

                <div className="p-4 border rounded-lg space-y-2 border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-blue-600">Business Tier</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">15% discount</div>
                  <p className="text-sm text-muted-foreground">Users with $100K-$1M monthly volume</p>
                  <div className="text-xs text-muted-foreground">Effective fee: ~0.085%</div>
                </div>

                <div className="p-4 border rounded-lg space-y-2 border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-amber-600">Enterprise Tier</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">30% discount</div>
                  <p className="text-sm text-muted-foreground">Users with {">"}$1M monthly volume</p>
                  <div className="text-xs text-muted-foreground">Effective fee: ~0.07%</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Volume-Based Discounts (Stacking)</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>$100K+ monthly volume</span>
                    <span className="text-green-600">+10% discount</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$500K+ monthly volume</span>
                    <span className="text-green-600">+20% discount</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$1M+ monthly volume</span>
                    <span className="text-green-600">+30% discount</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
