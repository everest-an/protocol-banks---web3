import { NextResponse } from "next/server"
import { register } from "@/lib/monitoring/metrics"

/**
 * GET /api/metrics
 * Exposes Prometheus metrics for scraping.
 */
export async function GET() {
  try {
    const metrics = await register.metrics()
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": register.contentType,
      },
    })
  } catch (error) {
    console.error("[metrics] Failed to collect metrics:", error)
    return NextResponse.json(
      { error: "Failed to collect metrics" },
      { status: 500 }
    )
  }
}
