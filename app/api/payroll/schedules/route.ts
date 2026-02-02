import { type NextRequest, NextResponse } from "next/server"
import { PayrollSchedulerService } from "@/lib/services/payroll-scheduler-service"

/**
 * GET /api/payroll/schedules?ownerAddress=xxx
 * Get payroll schedules for an address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerAddress = searchParams.get("ownerAddress")

    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    const schedules = await PayrollSchedulerService.getSchedules(ownerAddress)

    return NextResponse.json({
      success: true,
      schedules,
      count: schedules.length,
    })
  } catch (error: any) {
    console.error("[Payroll] Get schedules error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get schedules" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payroll/schedules
 * Create a new payroll schedule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      ownerAddress,
      name,
      description,
      splitRule,
      templateId,
      frequency,
      executionMode,
      approverAddresses,
      maxAmountPerExecution,
      notifyEmail,
      webhookUrl,
      notifyBeforeHours,
      startDate,
      endDate,
    } = body

    // Validate required fields
    if (!ownerAddress) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "name required" },
        { status: 400 }
      )
    }

    if (!splitRule || !splitRule.recipients || splitRule.recipients.length === 0) {
      return NextResponse.json(
        { error: "splitRule with recipients required" },
        { status: 400 }
      )
    }

    if (!frequency || !frequency.type) {
      return NextResponse.json(
        { error: "frequency configuration required" },
        { status: 400 }
      )
    }

    if (!executionMode || !["auto", "confirm", "approval"].includes(executionMode)) {
      return NextResponse.json(
        { error: "executionMode must be 'auto', 'confirm', or 'approval'" },
        { status: 400 }
      )
    }

    // Validate approval mode has approvers
    if (executionMode === "approval" && (!approverAddresses || approverAddresses.length === 0)) {
      return NextResponse.json(
        { error: "approverAddresses required for approval mode" },
        { status: 400 }
      )
    }

    const schedule = await PayrollSchedulerService.createSchedule(ownerAddress, {
      name: name.trim(),
      description: description?.trim(),
      splitRule,
      templateId,
      frequency,
      executionMode,
      approverAddresses,
      maxAmountPerExecution,
      notifyEmail,
      webhookUrl,
      notifyBeforeHours,
      startDate,
      endDate,
    })

    return NextResponse.json({
      success: true,
      schedule,
      message: `Schedule "${name}" created successfully`,
    })
  } catch (error: any) {
    console.error("[Payroll] Create schedule error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create schedule" },
      { status: 500 }
    )
  }
}
