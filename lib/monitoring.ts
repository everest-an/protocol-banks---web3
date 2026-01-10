import { getSupabase } from "./supabase"

export type AlertType = "error" | "warning" | "info" | "critical"
export type ServiceType = "payment" | "auth" | "database" | "api" | "security" | "integration"

interface MonitoringEvent {
  alertType: AlertType
  service: ServiceType
  message: string
  details?: Record<string, any>
}

/**
 * Log a monitoring alert to the database
 */
export async function logMonitoringAlert(event: MonitoringEvent): Promise<void> {
  try {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.from("monitoring_alerts").insert({
      alert_type: event.alertType,
      service: event.service,
      message: event.message,
      details: event.details || {},
      is_resolved: false,
    })
  } catch (error) {
    console.error("[Monitoring] Failed to log alert:", error)
  }
}

/**
 * Log a security alert
 */
export async function logSecurityAlert(
  alertType: string,
  severity: "low" | "medium" | "high" | "critical",
  actor: string,
  description: string,
  details?: Record<string, any>,
): Promise<void> {
  try {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.from("security_alerts").insert({
      alert_type: alertType,
      severity,
      actor,
      description,
      details: details || {},
      resolved: false,
    })
  } catch (error) {
    console.error("[Monitoring] Failed to log security alert:", error)
  }
}

/**
 * Check system health and log any issues
 */
export async function checkSystemHealth(): Promise<{
  healthy: boolean
  issues: string[]
}> {
  const issues: string[] = []

  // Check database connection
  try {
    const supabase = getSupabase()
    if (!supabase) {
      issues.push("Database connection not available")
    } else {
      const { error } = await supabase.from("payments").select("id").limit(1)
      if (error) {
        issues.push(`Database query failed: ${error.message}`)
      }
    }
  } catch (error) {
    issues.push("Database health check failed")
  }

  // Check required environment variables
  const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_REOWN_PROJECT_ID"]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`Missing environment variable: ${envVar}`)
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  }
}

/**
 * Get unresolved alert counts
 */
export async function getAlertCounts(): Promise<{
  security: number
  system: number
  total: number
}> {
  try {
    const supabase = getSupabase()
    if (!supabase) return { security: 0, system: 0, total: 0 }

    const { count: securityCount } = await supabase
      .from("security_alerts")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false)

    const { count: systemCount } = await supabase
      .from("monitoring_alerts")
      .select("*", { count: "exact", head: true })
      .eq("is_resolved", false)

    return {
      security: securityCount || 0,
      system: systemCount || 0,
      total: (securityCount || 0) + (systemCount || 0),
    }
  } catch (error) {
    return { security: 0, system: 0, total: 0 }
  }
}
