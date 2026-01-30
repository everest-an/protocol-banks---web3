import { type NextRequest, NextResponse } from "next/server"
import { PayrollSchedulerService } from "@/lib/services/payroll-scheduler-service"

/**
 * GET /api/cron/payroll
 * Cron job to process due payroll schedules
 *
 * This endpoint should be called by Vercel Cron (every hour)
 * Configure in vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/payroll", "schedule": "0 * * * *" }]
 * }
 */
export async function GET(request: NextRequest) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // 如果配置了 CRON_SECRET，验证请求
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized payroll cron request")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron] Payroll job started at", new Date().toISOString())

  try {
    // 获取到期的计划
    const dueSchedules = await PayrollSchedulerService.getDueSchedules()
    console.log(`[Cron] Found ${dueSchedules.length} due schedules`)

    const results: Array<{
      scheduleId: string
      scheduleName: string
      status: string
      success: boolean
      error?: string
    }> = []

    // 处理每个计划
    for (const schedule of dueSchedules) {
      try {
        console.log(`[Cron] Processing schedule: ${schedule.id} (${schedule.name})`)

        const execution = await PayrollSchedulerService.processSchedule(schedule)

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: execution.status,
          success: true,
        })

        console.log(`[Cron] Schedule ${schedule.id} processed: ${execution.status}`)
      } catch (error) {
        console.error(`[Cron] Schedule ${schedule.id} failed:`, error)

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: "failed",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount

    console.log(`[Cron] Payroll job completed: ${successCount} success, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount: results.length,
      successCount,
      failedCount,
      results,
    })
  } catch (error) {
    console.error("[Cron] Payroll job error:", error)

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
