import { type NextRequest, NextResponse } from "next/server"
import { PayrollSchedulerService } from "@/lib/services/payroll-scheduler-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/payroll/schedules/[id]
 * Get a specific payroll schedule
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const schedule = await PayrollSchedulerService.getSchedule(id)

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      )
    }

    // Get executions for this schedule
    const executions = await PayrollSchedulerService.getExecutions(id, undefined, 20)

    return NextResponse.json({
      success: true,
      schedule,
      executions,
    })
  } catch (error: any) {
    console.error("[Payroll] Get schedule error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get schedule" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/payroll/schedules/[id]
 * Update schedule status (pause/resume/cancel)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, ownerAddress } = body

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const schedule = await PayrollSchedulerService.getSchedule(id)
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      )
    }

    if (schedule.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Process action
    let newStatus: "active" | "paused" | "cancelled"

    switch (action) {
      case "pause":
        newStatus = "paused"
        break
      case "resume":
        newStatus = "active"
        break
      case "cancel":
        newStatus = "cancelled"
        break
      default:
        return NextResponse.json(
          { error: "action must be 'pause', 'resume', or 'cancel'" },
          { status: 400 }
        )
    }

    await PayrollSchedulerService.updateScheduleStatus(id, newStatus)

    return NextResponse.json({
      success: true,
      message: `Schedule ${action}d successfully`,
      newStatus,
    })
  } catch (error: any) {
    console.error("[Payroll] Update schedule error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update schedule" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payroll/schedules/[id]
 * Delete (cancel) a schedule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const ownerAddress = searchParams.get("ownerAddress")

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const schedule = await PayrollSchedulerService.getSchedule(id)
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      )
    }

    if (schedule.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    await PayrollSchedulerService.updateScheduleStatus(id, "cancelled")

    return NextResponse.json({
      success: true,
      message: "Schedule cancelled successfully",
    })
  } catch (error: any) {
    console.error("[Payroll] Delete schedule error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete schedule" },
      { status: 500 }
    )
  }
}
