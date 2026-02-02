/**
 * Detailed Health Check Endpoint
 * GET /api/health/detailed - Returns comprehensive health info
 */

import { NextResponse } from "next/server"
import { HealthMonitorService } from "@/lib/services/health-monitor-service"

const healthMonitor = new HealthMonitorService()

export async function GET() {
  try {
    const health = await healthMonitor.detailedHealth()

    // Map status to HTTP code
    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
        ? 200
        : 503

    return NextResponse.json(health, { status: statusCode })
  } catch (error: any) {
    console.error("[Health] Detailed check error:", error)
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        message: error.message || "Detailed health check failed",
        components: [],
      },
      { status: 503 }
    )
  }
}
