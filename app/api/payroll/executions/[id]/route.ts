import { type NextRequest, NextResponse } from "next/server"
import { PayrollSchedulerService } from "@/lib/services/payroll-scheduler-service"
import { getSupabase } from "@/lib/supabase"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/payroll/executions/[id]
 * Get execution details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    const { data: execution, error } = await supabase
      .from("payroll_executions")
      .select("*, payroll_schedules(*)")
      .eq("id", id)
      .single()

    if (error || !execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        scheduleId: execution.schedule_id,
        scheduledTime: execution.scheduled_time,
        actualTime: execution.actual_time,
        splitPaymentId: execution.split_payment_id,
        totalAmount: execution.total_amount,
        token: execution.token,
        recipientCount: execution.recipient_count,
        status: execution.status,
        results: execution.results,
        successCount: execution.success_count,
        failedCount: execution.failed_count,
        confirmedBy: execution.confirmed_by,
        confirmedAt: execution.confirmed_at,
        approvedBy: execution.approved_by,
        approvedAt: execution.approved_at,
        errorMessage: execution.error_message,
        createdAt: execution.created_at,
      },
      schedule: execution.payroll_schedules ? {
        id: execution.payroll_schedules.id,
        name: execution.payroll_schedules.name,
        ownerAddress: execution.payroll_schedules.owner_address,
      } : null,
    })
  } catch (error: any) {
    console.error("[Payroll] Get execution error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get execution" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payroll/executions/[id]
 * Perform action on execution (confirm, approve, cancel)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, userAddress } = body

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress required" },
        { status: 400 }
      )
    }

    if (!action || !["confirm", "approve", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'confirm', 'approve', or 'cancel'" },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    switch (action) {
      case "confirm": {
        const execution = await PayrollSchedulerService.confirmExecution(id, userAddress)
        return NextResponse.json({
          success: true,
          message: "Execution confirmed and processed",
          execution,
        })
      }

      case "approve": {
        await PayrollSchedulerService.approveExecution(id, userAddress)
        return NextResponse.json({
          success: true,
          message: "Approval recorded",
        })
      }

      case "cancel": {
        // Verify user has permission to cancel
        const { data: execution } = await supabase
          .from("payroll_executions")
          .select("*, payroll_schedules(owner_address)")
          .eq("id", id)
          .single()

        if (!execution) {
          return NextResponse.json(
            { error: "Execution not found" },
            { status: 404 }
          )
        }

        const ownerAddress = execution.payroll_schedules?.owner_address
        if (ownerAddress?.toLowerCase() !== userAddress.toLowerCase()) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          )
        }

        if (!["pending", "confirming", "approving"].includes(execution.status)) {
          return NextResponse.json(
            { error: "Cannot cancel execution in current state" },
            { status: 400 }
          )
        }

        // Cancel execution
        await supabase
          .from("payroll_executions")
          .update({ status: "cancelled" })
          .eq("id", id)

        // Cancel pending actions
        await supabase
          .from("pending_actions")
          .update({ status: "cancelled" })
          .eq("execution_id", id)

        return NextResponse.json({
          success: true,
          message: "Execution cancelled",
        })
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error("[Payroll] Execution action error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process action" },
      { status: 500 }
    )
  }
}
