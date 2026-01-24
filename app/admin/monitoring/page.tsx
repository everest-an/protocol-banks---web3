"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Bell, CheckCircle, Loader2, RefreshCw, Shield, Database, Wallet, Activity } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { checkSystemHealth, getAlertCounts, logMonitoringAlert, type AlertType } from "@/lib/monitoring"

export const dynamic = "force-dynamic"

interface MonitoringAlert {
  id: string
  alert_type: string
  service: string
  message: string
  details: any
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

interface SecurityAlert {
  id: string
  alert_type: string
  severity: string
  actor: string
  description: string
  details: any
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

interface SystemMetrics {
  totalPayments: number
  totalVolume: number
  activeUsers: number
  pendingAlerts: number
}

export default function MonitoringPage() {
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([])
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    // Fetch monitoring alerts
    const { data: monAlerts } = await supabase
      .from("monitoring_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (monAlerts) setMonitoringAlerts(monAlerts)

    // Fetch security alerts
    const { data: secAlerts } = await supabase
      .from("security_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (secAlerts) setSecurityAlerts(secAlerts)

    // Fetch metrics
    const { count: paymentsCount } = await supabase.from("payments").select("*", { count: "exact", head: true })

    const { data: volumeData } = await supabase.from("payments").select("amount_usd")

    const totalVolume = volumeData?.reduce((sum: number, p: { amount_usd?: number }) => sum + (Number(p.amount_usd) || 0), 0) || 0

    const { data: uniqueUsers } = await supabase.from("payments").select("from_address")

    const activeUsers = new Set(uniqueUsers?.map((u: { from_address: string }) => u.from_address)).size

    const pendingAlerts =
      (monAlerts?.filter((a: { is_resolved?: boolean }) => !a.is_resolved).length || 0) + (secAlerts?.filter((a: { resolved?: boolean }) => !a.resolved).length || 0)

    setMetrics({
      totalPayments: paymentsCount || 0,
      totalVolume,
      activeUsers,
      pendingAlerts,
    })

    setLoading(false)
  }

  async function resolveAlert(id: string, table: "monitoring_alerts" | "security_alerts") {
    const supabase = getSupabase()
    if (!supabase) return

    const resolveField = table === "monitoring_alerts" ? "is_resolved" : "resolved"
    const resolvedByField = "resolved_by"
    const resolvedAtField = "resolved_at"

    const { error } = await supabase
      .from(table)
      .update({
        [resolveField]: true,
        [resolvedByField]: "admin",
        [resolvedAtField]: new Date().toISOString(),
      })
      .eq("id", id)

    if (!error) {
      toast.success("Alert resolved")
      fetchData()
    }
  }

  async function refresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success("Data refreshed")
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>
      case "high":
        return <Badge className="bg-orange-500">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>
      case "low":
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  function getAlertTypeBadge(type: string) {
    switch (type) {
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "warning":
        return <Badge className="bg-yellow-500">Warning</Badge>
      case "critical":
        return <Badge variant="destructive">Critical</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground mt-2">Real-time alerts and system metrics</p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{metrics?.totalPayments.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Payments</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">${metrics?.totalVolume.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Database className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{metrics?.activeUsers}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Bell className={`h-8 w-8 ${(metrics?.pendingAlerts || 0) > 0 ? "text-red-500" : "text-green-500"}`} />
            <div>
              <p className="text-2xl font-bold">{metrics?.pendingAlerts}</p>
              <p className="text-sm text-muted-foreground">Pending Alerts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Tabs */}
      <Tabs defaultValue="security" className="space-y-4">
        <TabsList>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security Alerts
            {securityAlerts.filter((a) => !a.resolved).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {securityAlerts.filter((a) => !a.resolved).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system">
            <Bell className="mr-2 h-4 w-4" />
            System Alerts
            {monitoringAlerts.filter((a) => !a.is_resolved).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {monitoringAlerts.filter((a) => !a.is_resolved).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>Detected security events and threats</CardDescription>
            </CardHeader>
            <CardContent>
              {securityAlerts.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>All Clear</AlertTitle>
                  <AlertDescription>No security alerts to display.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>{alert.alert_type}</TableCell>
                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                        <TableCell className="max-w-xs truncate">{alert.description}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{alert.actor?.slice(0, 10)}...</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {alert.resolved ? (
                            <Badge className="bg-green-500">Resolved</Badge>
                          ) : (
                            <Badge variant="destructive">Open</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!alert.resolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveAlert(alert.id, "security_alerts")}
                            >
                              Resolve
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

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Application and infrastructure alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {monitoringAlerts.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>All Clear</AlertTitle>
                  <AlertDescription>No system alerts to display.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monitoringAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>{getAlertTypeBadge(alert.alert_type)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.service}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{alert.message}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {alert.is_resolved ? (
                            <Badge className="bg-green-500">Resolved</Badge>
                          ) : (
                            <Badge variant="destructive">Open</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!alert.is_resolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveAlert(alert.id, "monitoring_alerts")}
                            >
                              Resolve
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
      </Tabs>
    </div>
  )
}
