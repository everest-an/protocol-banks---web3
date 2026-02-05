"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts"

interface Transaction {
  id: string
  type: "sent" | "received"
  amount: number
  currency: string
  status: "completed" | "pending" | "failed"
  timestamp: string | Date
  entity: string
}

interface BalanceActivityProps {
  initialTransactions: Transaction[]
  isDemoMode?: boolean
}

export function BalanceActivity({ initialTransactions, isDemoMode = false }: BalanceActivityProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [timeRange, setTimeRange] = useState("1M")
  const [minAmount, setMinAmount] = useState(0)
  
  // Sync with initialTransactions when they load from DB
  useEffect(() => {
    setTransactions(initialTransactions)
  }, [initialTransactions])

  // Real-time simulation (Demo Mode Only)
  useEffect(() => {
    if (!isDemoMode) return
    
    const interval = setInterval(() => {
      // 5% chance to add a new transaction every 3 seconds to simulate live feed
      if (Math.random() > 0.95) {
        const type = Math.random() > 0.5 ? "sent" : "received"
        const newTx: Transaction = {
          id: `live-${Date.now()}`,
          type,
          amount: Math.floor(Math.random() * 5000) + 100,
          currency: "USDC",
          status: "pending",
          timestamp: new Date(),
          entity: type === "sent" ? "Vendor Payment" : "Client Deposit"
        }
        
        setTransactions(prev => [newTx, ...prev])

        // After 5 seconds, mark as completed
        setTimeout(() => {
          setTransactions(prev => 
            prev.map(tx => tx.id === newTx.id ? { ...tx, status: "completed" } : tx)
          )
        }, 5000)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    let cutoff = new Date()
    
    if (timeRange === "1D") cutoff.setDate(now.getDate() - 1)
    if (timeRange === "1W") cutoff.setDate(now.getDate() - 7)
    if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
    if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
    if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)

    return transactions.filter(t => 
      new Date(t.timestamp) >= cutoff && 
      t.amount >= minAmount
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [transactions, timeRange, minAmount])

  const deposits = filteredTransactions.filter(t => t.type === "received")
  const withdrawals = filteredTransactions.filter(t => t.type === "sent")

  const chartData = useMemo(() => {
    // Group by date for charts
    const map = new Map<string, { date: string, incoming: number, outgoing: number }>()
    
    // Sort chronological for chart
    const sorted = [...filteredTransactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    sorted.forEach(t => {
      const date = new Date(t.timestamp).toLocaleDateString()
      if (!map.has(date)) map.set(date, { date, incoming: 0, outgoing: 0 })
      const entry = map.get(date)!
      if (t.type === "received") entry.incoming += t.amount
      else entry.outgoing += t.amount
    })

    return Array.from(map.values())
  }, [filteredTransactions])

  const stats = {
    pending: filteredTransactions.filter(t => t.status === "pending").length,
    completed: filteredTransactions.filter(t => t.status === "completed").length,
    failed: filteredTransactions.filter(t => t.status === "failed").length
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md">
          {["1D", "1W", "1M", "3M", "1Y"].map(range => (
            <Button
              key={range}
              variant={timeRange === range ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="text-xs h-7"
            >
              {range}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Min Amount: ${minAmount}</span>
          <Slider
            value={[minAmount]}
            max={10000}
            step={100}
            className="w-[150px]"
            onValueChange={(v) => setMinAmount(v[0])}
          />
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">Completed</span>
            </div>
            <span className="text-xl font-bold text-green-700">{stats.completed}</span>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-yellow-600">Pending</span>
            </div>
            <span className="text-xl font-bold text-yellow-700">{stats.pending}</span>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">Failed</span>
            </div>
            <span className="text-xl font-bold text-red-700">{stats.failed}</span>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Charts - Stripe Style */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
              Incoming Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="incoming" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorIn)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-blue-500" />
              Outgoing Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="outgoing" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorOut)"
                    strokeWidth={2} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Lists */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Deposits */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Recent Deposits
            </h3>
            <Badge variant="outline" className="text-xs">{deposits.length} txn</Badge>
          </div>
          <div className="space-y-3">
            {deposits.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <ArrowDownLeft className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.entity}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">+{tx.amount.toLocaleString()} {tx.currency}</p>
                  <Badge variant={tx.status === "completed" ? "outline" : "secondary"} className="text-[10px] h-5">
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
            {deposits.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No deposits found in this period
              </div>
            )}
          </div>
        </div>

        {/* Withdrawals */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              Recent Withdrawals
            </h3>
            <Badge variant="outline" className="text-xs">{withdrawals.length} txn</Badge>
          </div>
          <div className="space-y-3">
            {withdrawals.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.entity}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">-{tx.amount.toLocaleString()} {tx.currency}</p>
                  <Badge variant={tx.status === "completed" ? "outline" : "secondary"} className="text-[10px] h-5">
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
             {withdrawals.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No withdrawals found in this period
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
