import { type NextRequest, NextResponse } from "next/server"
import { PayrollSchedulerService } from "@/lib/services/payroll-scheduler-service"

/**
 * GET /api/payroll/executions?ownerAddress=xxx or ?scheduleId=xxx
 * Get payroll executions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerAddress = searchParams.get("ownerAddress")
    const scheduleId = searchParams.get("scheduleId")
    const limit = Number(searchParams.get("limit")) || 50

    if (!ownerAddress && !scheduleId) {
      return NextResponse.json(
        { error: "ownerAddress or scheduleId required" },
        { status: 400 }
      )
    }

    const executions = await PayrollSchedulerService.getExecutions(
      scheduleId || undefined,
      ownerAddress || undefined,
      limit
    )

    return NextResponse.json({
      success: true,
      executions,
      count: executions.length,
    })
  } catch (error: any) {
    console.error("[Payroll] Get executions error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get executions" },
      { status: 500 }
    )
  }
}
