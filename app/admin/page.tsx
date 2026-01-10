"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Globe,
  Bell,
  DollarSign,
  FileCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { checkEnvironmentVariables } from "./actions"

export const dynamic = "force-dynamic"

interface SystemStatus {
  category: string
  name: string
  status: "ok" | "warning" | "error" | "pending"
  message: string
  action?: string
  actionUrl?: string
}

export default function AdminDashboard() {
  const { address, isConnected } = useWeb3()
  const [loading, setLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([])
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])

  useEffect(() => {
    checkSystemStatus()
  }, [])

  async function checkSystemStatus() {
    setLoading(true)
    const status: SystemStatus[] = []

    const envVars = await checkEnvironmentVariables()

    status.push({
      category: "Environment",
      name: "Supabase Database",
      status: envVars.SUPABASE ? "ok" : "error",
      message: envVars.SUPABASE ? "Connected" : "Not configured",
      action: "Configure",
      actionUrl: "https://supabase.com/dashboard",
    })

    status.push({
      category: "Environment",
      name: "Reown AppKit",
      status: envVars.REOWN ? "ok" : "error",
      message: envVars.REOWN ? "Configured" : "Missing Project ID",
      action: "Setup",
      actionUrl: "https://cloud.reown.com",
    })

    status.push({
      category: "Environment",
      name: "Etherscan API",
      status: envVars.ETHERSCAN ? "ok" : "warning",
      message: envVars.ETHERSCAN ? "Configured" : "Optional - for tx verification",
      action: "Get Key",
      actionUrl: "https://etherscan.io/apis",
    })

    status.push({
      category: "Email",
      name: "Resend Email Service",
      status: envVars.RESEND ? "ok" : "warning",
      message: envVars.RESEND ? "Configured" : "Email notifications disabled",
      action: "Setup",
      actionUrl: "https://resend.com",
    })

    status.push({
      category: "Security",
      name: "reCAPTCHA",
      status: envVars.RECAPTCHA ? "ok" : "warning",
      message: envVars.RECAPTCHA ? "Enabled" : "Contact form unprotected",
      action: "Configure",
      actionUrl: "https://www.google.com/recaptcha/admin",
    })

    // Check database tables
    const supabase = getSupabase()
    if (supabase) {
      const { count: paymentsCount } = await supabase.from("payments").select("*", { count: "exact", head: true })

      status.push({
        category: "Database",
        name: "Payments Table",
        status: "ok",
        message: `${paymentsCount || 0} records`,
      })

      const { count: vendorsCount } = await supabase.from("vendors").select("*", { count: "exact", head: true })

      status.push({
        category: "Database",
        name: "Vendors Table",
        status: "ok",
        message: `${vendorsCount || 0} records`,
      })

      // Check for unresolved alerts
      const { data: alerts } = await supabase
        .from("security_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5)

      setRecentAlerts(alerts || [])

      status.push({
        category: "Security",
        name: "Security Alerts",
        status: (alerts?.length || 0) > 0 ? "warning" : "ok",
        message: `${alerts?.length || 0} unresolved alerts`,
      })
    }

    // Contract deployment status (placeholder - needs actual check)
    status.push({
      category: "Contracts",
      name: "ZetaChain Universal Contract",
      status: "pending",
      message: "Not deployed to mainnet",
      action: "Deploy",
      actionUrl: "/admin/contracts",
    })

    status.push({
      category: "Contracts",
      name: "CCTP Integration",
      status: "pending",
      message: "Using Circle's official contracts",
      action: "Verify",
      actionUrl: "https://developers.circle.com/stablecoins/cctp-getting-started",
    })

    // Domain whitelist
    status.push({
      category: "Domains",
      name: "Production Domain",
      status: "pending",
      message: "Add protocolbanks.com to Reown",
      action: "Configure",
      actionUrl: "https://cloud.reown.com",
    })

    setSystemStatus(status)
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "pending":
        return <RefreshCw className="h-5 w-5 text-blue-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500">Ready</Badge>
      case "warning":
        return <Badge className="bg-yellow-500">Warning</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      default:
        return null
    }
  }

  const categories = [...new Set(systemStatus.map((s) => s.category))]

  const overallStatus = systemStatus.some((s) => s.status === "error")
    ? "error"
    : systemStatus.some((s) => s.status === "pending")
      ? "pending"
      : systemStatus.some((s) => s.status === "warning")
        ? "warning"
        : "ok"

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">System configuration and production readiness</p>
      </div>

      {/* Overall Status */}
      <Alert
        className={`mb-8 ${
          overallStatus === "ok"
            ? "border-green-500 bg-green-50 dark:bg-green-950"
            : overallStatus === "error"
              ? "border-red-500 bg-red-50 dark:bg-red-950"
              : overallStatus === "pending"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
        }`}
      >
        {getStatusIcon(overallStatus)}
        <AlertTitle className="ml-2">
          {overallStatus === "ok"
            ? "System Ready for Production"
            : overallStatus === "error"
              ? "Critical Issues Need Attention"
              : overallStatus === "pending"
                ? "Setup In Progress"
                : "Some Items Need Review"}
        </AlertTitle>
        <AlertDescription className="ml-2">
          {systemStatus.filter((s) => s.status !== "ok").length} items require attention
        </AlertDescription>
      </Alert>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Link href="/admin/fees">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Fee Management</p>
                <p className="text-sm text-muted-foreground">Configure rates</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/contracts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <FileCode className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Contracts</p>
                <p className="text-sm text-muted-foreground">Deploy & verify</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/domains">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Domains</p>
                <p className="text-sm text-muted-foreground">Whitelist config</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/monitoring">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <Bell className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Monitoring</p>
                <p className="text-sm text-muted-foreground">Alerts & logs</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Status */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Production readiness checklist</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemStatus.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(item.status)}
                      {item.action && item.actionUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={item.actionUrl} target="_blank" rel="noopener noreferrer">
                            {item.action}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <Card>
              <CardHeader>
                <CardTitle>{cat} Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemStatus
                    .filter((s) => s.category === cat)
                    .map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(item.status)}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(item.status)}
                          {item.action && item.actionUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={item.actionUrl} target="_blank" rel="noopener noreferrer">
                                {item.action}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Security Alerts</CardTitle>
            <CardDescription>Unresolved issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert: any) => (
                <Alert key={alert.id} variant={alert.severity === "critical" ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{alert.alert_type}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
