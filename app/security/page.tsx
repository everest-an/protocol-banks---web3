"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Lock,
  Eye,
  FileWarning,
  Wallet,
  ArrowRightLeft,
  Users,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { SECURITY_CONFIG } from "@/lib/security"

interface AuditLog {
  id: string
  action: string
  actor: string
  target_type?: string
  target_id?: string
  details: Record<string, any>
  ip_address?: string
  created_at: string
}

interface SecurityAlert {
  id: string
  alert_type: string
  severity: string
  actor: string
  description: string
  details: Record<string, any>
  resolved: boolean
  created_at: string
}

interface AddressChange {
  id: string
  vendor_id: string
  previous_address: string
  new_address: string
  changed_by: string
  created_at: string
}

export default function SecurityPage() {
  const { wallets, activeChain, isConnected } = useWeb3()
  const currentWallet = wallets[activeChain]

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([])
  const [addressChanges, setAddressChanges] = useState<AddressChange[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Demo data for non-connected state
  const demoAuditLogs: AuditLog[] = [
    {
      id: "1",
      action: "PAYMENT_COMPLETED",
      actor: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      target_type: "payment",
      target_id: "pay_001",
      details: { amount: "1500.00", token: "USDC", to: "0x123..." },
      ip_address: "192.168.1.1",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "2",
      action: "VENDOR_UPDATED",
      actor: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      target_type: "vendor",
      target_id: "vnd_001",
      details: { name: "Cloud Services Inc", field_changed: "email" },
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "3",
      action: "BATCH_COMPLETED",
      actor: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      target_type: "batch",
      target_id: "batch_001",
      details: { total_recipients: 5, total_amount: "10000.00" },
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "4",
      action: "ADDRESS_CHANGED",
      actor: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      target_type: "vendor",
      target_id: "vnd_002",
      details: { previous: "0xold...", new: "0xnew..." },
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ]

  const demoSecurityAlerts: SecurityAlert[] = [
    {
      id: "1",
      alert_type: "RATE_LIMIT",
      severity: "medium",
      actor: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      description: "Rate limit exceeded for batch payments",
      details: { attempts: 5, window: "1 hour" },
      resolved: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ]

  const demoAddressChanges: AddressChange[] = [
    {
      id: "1",
      vendor_id: "vnd_002",
      previous_address: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      new_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      changed_by: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ]

  useEffect(() => {
    if (!isConnected) {
      setAuditLogs(demoAuditLogs)
      setSecurityAlerts(demoSecurityAlerts)
      setAddressChanges(demoAddressChanges)
      setIsLoading(false)
      return
    }

    loadSecurityData()
  }, [isConnected, currentWallet])

  const loadSecurityData = async () => {
    if (!currentWallet) return
    setIsLoading(true)

    try {
      const supabase = getSupabase()
      if (!supabase) {
        setAuditLogs(demoAuditLogs)
        setSecurityAlerts(demoSecurityAlerts)
        setAddressChanges(demoAddressChanges)
        return
      }

      // Fetch audit logs
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`actor.ilike.%${currentWallet}%,actor.eq.SYSTEM`)
        .order("created_at", { ascending: false })
        .limit(100)

      if (logs) setAuditLogs(logs)

      // Fetch security alerts
      const { data: alerts } = await supabase
        .from("security_alerts")
        .select("*")
        .ilike("actor", `%${currentWallet}%`)
        .order("created_at", { ascending: false })
        .limit(50)

      if (alerts) setSecurityAlerts(alerts)

      // Fetch address changes
      const { data: changes } = await supabase
        .from("address_change_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (changes) setAddressChanges(changes)
    } catch (error) {
      console.error("[Security] Failed to load data:", error)
      // Fall back to demo data
      setAuditLogs(demoAuditLogs)
      setSecurityAlerts(demoSecurityAlerts)
      setAddressChanges(demoAddressChanges)
    } finally {
      setIsLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "PAYMENT_COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "PAYMENT_FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "VENDOR_CREATED":
      case "VENDOR_UPDATED":
        return <Users className="h-4 w-4 text-blue-500" />
      case "ADDRESS_CHANGED":
        return <ArrowRightLeft className="h-4 w-4 text-yellow-500" />
      case "BATCH_CREATED":
      case "BATCH_COMPLETED":
        return <Activity className="h-4 w-4 text-purple-500" />
      case "RATE_LIMIT_EXCEEDED":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "SECURITY_ALERT":
        return <ShieldAlert className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/30"
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      case "low":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const unresolvedAlerts = securityAlerts.filter((a) => !a.resolved)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Security Center
            </h1>
            <p className="text-muted-foreground mt-1">Monitor security events, audit logs, and address changes</p>
          </div>

          <Button onClick={loadSecurityData} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Security Status Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Security Status</p>
                  <p className="text-2xl font-bold text-green-500 flex items-center gap-2 mt-1">
                    <ShieldCheck className="h-5 w-5" />
                    {unresolvedAlerts.length === 0 ? "Secure" : "Alert"}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Lock className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{unresolvedAlerts.length}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Audit Events (24h)</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {auditLogs.filter((l) => new Date(l.created_at) > new Date(Date.now() - 86400000)).length}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Eye className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Address Changes</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{addressChanges.length}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <Wallet className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Limits Info */}
        <Alert className="bg-blue-500/5 border-blue-500/20">
          <Shield className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">Active Security Limits</AlertTitle>
          <AlertDescription className="text-blue-500/80">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
              <div>
                <span className="block text-muted-foreground">Max Single Payment</span>
                <span className="font-mono">${SECURITY_CONFIG.MAX_SINGLE_PAYMENT_USD.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Max Batch Total</span>
                <span className="font-mono">${SECURITY_CONFIG.MAX_BATCH_TOTAL_USD.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Max Recipients</span>
                <span className="font-mono">{SECURITY_CONFIG.MAX_BATCH_RECIPIENTS}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">High Value Threshold</span>
                <span className="font-mono">${SECURITY_CONFIG.HIGH_VALUE_THRESHOLD_USD.toLocaleString()}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Main Content Tabs */}
        <Tabs defaultValue="audit" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Alerts
              {unresolvedAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {unresolvedAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Address History
            </TabsTrigger>
          </TabsList>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>Complete history of all security-relevant actions</CardDescription>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/30">
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{getActionIcon(log.action)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.actor.slice(0, 6)}...{log.actor.slice(-4)}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {JSON.stringify(log.details).slice(0, 80)}...
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(log.created_at)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Alerts Tab */}
          <TabsContent value="alerts" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Suspicious activities and security events requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {securityAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">No Security Alerts</p>
                    <p className="text-muted-foreground">All systems operating normally</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {securityAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                          alert.resolved ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <FileWarning className="h-5 w-5 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{alert.alert_type}</span>
                                <Badge variant="outline" className="text-xs uppercase">
                                  {alert.severity}
                                </Badge>
                                {alert.resolved && (
                                  <Badge variant="secondary" className="text-xs">
                                    Resolved
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm mt-1">{alert.description}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Actor: {alert.actor.slice(0, 10)}... | {formatTimeAgo(alert.created_at)}
                              </p>
                            </div>
                          </div>
                          {!alert.resolved && (
                            <Button variant="outline" size="sm">
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Address Changes Tab */}
          <TabsContent value="addresses" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Address Change History</CardTitle>
                <CardDescription>Track all wallet address modifications for your vendors</CardDescription>
              </CardHeader>
              <CardContent>
                {addressChanges.length === 0 ? (
                  <div className="text-center py-12">
                    <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">No Address Changes</p>
                    <p className="text-muted-foreground">Vendor addresses have not been modified</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/30">
                        <TableHead>Vendor</TableHead>
                        <TableHead>Previous Address</TableHead>
                        <TableHead>New Address</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead className="text-right">When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addressChanges.map((change) => (
                        <TableRow key={change.id}>
                          <TableCell className="font-mono text-xs">{change.vendor_id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            <code className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">
                              {change.previous_address.slice(0, 10)}...{change.previous_address.slice(-6)}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                              {change.new_address.slice(0, 10)}...{change.new_address.slice(-6)}
                            </code>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {change.changed_by.slice(0, 6)}...{change.changed_by.slice(-4)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatTimeAgo(change.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Security Best Practices */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Address Verification
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  All addresses are validated with EIP-55 checksum before any transaction
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Rate Limiting
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatic limits on payment frequency to prevent unauthorized bulk transfers
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Integrity Hashing
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Transaction parameters are hashed to detect tampering between client and server
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Audit Logging
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Every action is logged with timestamps, IP addresses, and detailed context
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Row Level Security
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Database policies ensure users can only access their own data
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Input Sanitization
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  All inputs are sanitized to prevent XSS, SQL injection, and homograph attacks
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
