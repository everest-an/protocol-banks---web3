/**
 * Payroll Scheduler Service
 * 定时发薪调度服务
 *
 * 支持自动/确认/审批模式的定时发薪功能
 */

import { getSupabase } from "@/lib/supabase"
import { splitPaymentService } from "./split-payment-service"
import type {
  PayrollSchedule,
  PayrollExecution,
  FrequencyConfig,
  ExecutionStatus,
  PayrollSplitRule,
  PendingAction,
} from "@/types/payroll"
import type { SplitPaymentRequest, SplitPaymentResponse } from "@/types/split-payment"

// ============================================
// PayrollSchedulerService
// ============================================

export class PayrollSchedulerService {
  /**
   * 计算下次执行时间
   */
  static calculateNextExecution(
    frequency: FrequencyConfig,
    fromDate: Date = new Date()
  ): Date {
    const time = frequency.time || "09:00"
    const [hours, minutes] = time.split(":").map(Number)

    let next = new Date(fromDate)

    switch (frequency.type) {
      case "daily":
        next.setUTCHours(hours, minutes, 0, 0)
        if (next <= fromDate) {
          next.setDate(next.getDate() + 1)
        }
        break

      case "weekly": {
        const targetDay = frequency.dayOfWeek ?? 1 // 默认周一
        const currentDay = next.getDay()
        let daysUntil = (targetDay - currentDay + 7) % 7
        if (daysUntil === 0 && next <= fromDate) {
          daysUntil = 7
        }
        next.setDate(next.getDate() + daysUntil)
        next.setUTCHours(hours, minutes, 0, 0)
        break
      }

      case "biweekly": {
        // 基于 startDate 计算
        const start = new Date(frequency.startDate || fromDate)
        const msPerWeek = 7 * 24 * 60 * 60 * 1000
        const weeksSinceStart = Math.floor(
          (fromDate.getTime() - start.getTime()) / msPerWeek
        )
        const nextBiweek = Math.ceil((weeksSinceStart + 1) / 2) * 2
        next = new Date(start)
        next.setDate(next.getDate() + nextBiweek * 7)
        next.setUTCHours(hours, minutes, 0, 0)
        break
      }

      case "monthly": {
        const day = frequency.dayOfMonth ?? 1
        next.setDate(1) // 先设为1号避免跨月问题
        next.setMonth(next.getMonth() + 1)
        if (day === -1) {
          // 最后一天
          next.setDate(0)
        } else {
          const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
          next.setDate(Math.min(day, maxDay))
        }
        next.setUTCHours(hours, minutes, 0, 0)
        break
      }

      case "custom":
        // 简化实现：如果是 custom，使用 daily 作为后备
        // 完整实现需要引入 cron-parser 库
        console.warn("[Payroll] Custom cron not fully implemented, using daily fallback")
        next.setUTCHours(hours, minutes, 0, 0)
        if (next <= fromDate) {
          next.setDate(next.getDate() + 1)
        }
        break
    }

    return next
  }

  /**
   * 查询到期的计划
   */
  static async getDueSchedules(): Promise<PayrollSchedule[]> {
    const supabase = getSupabase()
    const now = new Date()
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000) // 1小时前

    const { data, error } = await supabase
      .from("payroll_schedules")
      .select("*")
      .eq("status", "active")
      .lte("next_execution", now.toISOString())
      .gte("next_execution", windowStart.toISOString())

    if (error) {
      console.error("[Payroll] Query due schedules error:", error)
      return []
    }

    // 转换数据库字段到 TypeScript 类型
    return (data || []).map(this.mapDbToSchedule)
  }

  /**
   * 获取用户的计划列表
   */
  static async getSchedules(ownerAddress: string): Promise<PayrollSchedule[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("payroll_schedules")
      .select("*")
      .eq("owner_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Payroll] Get schedules error:", error)
      return []
    }

    return (data || []).map(this.mapDbToSchedule)
  }

  /**
   * 获取单个计划
   */
  static async getSchedule(scheduleId: string): Promise<PayrollSchedule | null> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("payroll_schedules")
      .select("*")
      .eq("id", scheduleId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapDbToSchedule(data)
  }

  /**
   * 创建发薪计划
   */
  static async createSchedule(
    ownerAddress: string,
    request: {
      name: string
      description?: string
      splitRule: PayrollSplitRule
      templateId?: string
      frequency: FrequencyConfig
      executionMode: "auto" | "confirm" | "approval"
      approverAddresses?: string[]
      maxAmountPerExecution?: number
      notifyEmail?: string
      webhookUrl?: string
      notifyBeforeHours?: number
      startDate?: string
      endDate?: string
    }
  ): Promise<PayrollSchedule> {
    const supabase = getSupabase()

    const nextExecution = this.calculateNextExecution(request.frequency)

    const { data, error } = await supabase
      .from("payroll_schedules")
      .insert({
        owner_address: ownerAddress.toLowerCase(),
        name: request.name,
        description: request.description,
        split_rule: request.splitRule,
        template_id: request.templateId,
        frequency: request.frequency,
        execution_mode: request.executionMode,
        approver_addresses: request.approverAddresses,
        max_amount_per_execution: request.maxAmountPerExecution,
        notify_email: request.notifyEmail,
        webhook_url: request.webhookUrl,
        notify_before_hours: request.notifyBeforeHours ?? 24,
        status: "active",
        next_execution: nextExecution.toISOString(),
        execution_count: 0,
        total_paid: 0,
        start_date: request.startDate,
        end_date: request.endDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create schedule: ${error?.message}`)
    }

    return this.mapDbToSchedule(data)
  }

  /**
   * 更新计划状态
   */
  static async updateScheduleStatus(
    scheduleId: string,
    status: "active" | "paused" | "cancelled"
  ): Promise<void> {
    const supabase = getSupabase()

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    // 如果恢复为活跃状态，重新计算下次执行时间
    if (status === "active") {
      const schedule = await this.getSchedule(scheduleId)
      if (schedule) {
        const nextExecution = this.calculateNextExecution(schedule.frequency)
        updates.next_execution = nextExecution.toISOString()
      }
    }

    const { error } = await supabase
      .from("payroll_schedules")
      .update(updates)
      .eq("id", scheduleId)

    if (error) {
      throw new Error(`Failed to update schedule status: ${error.message}`)
    }
  }

  /**
   * 处理单个计划
   */
  static async processSchedule(schedule: PayrollSchedule): Promise<PayrollExecution> {
    const supabase = getSupabase()

    console.log("[Payroll] Processing schedule:", {
      id: schedule.id,
      name: schedule.name,
      mode: schedule.executionMode,
    })

    // 创建执行记录
    const { data: execution, error: createError } = await supabase
      .from("payroll_executions")
      .insert({
        schedule_id: schedule.id,
        scheduled_time: schedule.nextExecution,
        total_amount: schedule.splitRule.totalAmount,
        token: schedule.splitRule.token,
        recipient_count: schedule.splitRule.recipients.length,
        status: "pending",
        success_count: 0,
        failed_count: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError || !execution) {
      throw new Error(`Failed to create execution: ${createError?.message}`)
    }

    const executionData = this.mapDbToExecution(execution)

    try {
      // 根据执行模式处理
      switch (schedule.executionMode) {
        case "auto":
          return await this.executePayroll(executionData, schedule)

        case "confirm":
          return await this.createConfirmRequest(executionData, schedule)

        case "approval":
          return await this.createApprovalRequest(executionData, schedule)

        default:
          throw new Error(`Unknown execution mode: ${schedule.executionMode}`)
      }
    } catch (error) {
      // 更新执行状态为失败
      await supabase
        .from("payroll_executions")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", execution.id)

      throw error
    }
  }

  /**
   * 执行发薪
   */
  static async executePayroll(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase()

    console.log("[Payroll] Executing payroll:", {
      executionId: execution.id,
      scheduleId: schedule.id,
      amount: schedule.splitRule.totalAmount,
    })

    // 更新状态为执行中
    await supabase
      .from("payroll_executions")
      .update({ status: "executing", actual_time: new Date().toISOString() })
      .eq("id", execution.id)

    // 构建分账请求
    const splitRequest: SplitPaymentRequest = {
      totalAmount: schedule.splitRule.totalAmount,
      token: schedule.splitRule.token,
      method: schedule.splitRule.mode,
      recipients: schedule.splitRule.recipients,
      chainId: schedule.splitRule.chainId,
      memo: `定时发薪: ${schedule.name}`,
    }

    // 执行分账支付
    const result = await splitPaymentService.execute(
      splitRequest,
      schedule.ownerAddress,
      undefined,
      (current, total) => {
        console.log(`[Payroll] Progress: ${current}/${total}`)
      }
    )

    // 计算成功/失败数量
    const successCount = result.results.filter((r) => r.success).length
    const failedCount = result.results.length - successCount

    // 更新执行记录
    await supabase
      .from("payroll_executions")
      .update({
        split_payment_id: result.id,
        status: result.status === "completed" ? "completed" : "partial",
        results: result.results,
        success_count: successCount,
        failed_count: failedCount,
      })
      .eq("id", execution.id)

    // 更新计划
    const nextExecution = this.calculateNextExecution(schedule.frequency)
    await supabase
      .from("payroll_schedules")
      .update({
        last_execution: new Date().toISOString(),
        next_execution: nextExecution.toISOString(),
        execution_count: schedule.executionCount + 1,
        total_paid: schedule.totalPaid + result.paidAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id)

    console.log("[Payroll] Execution completed:", {
      executionId: execution.id,
      status: result.status,
      successCount,
      failedCount,
    })

    return {
      ...execution,
      status: result.status === "completed" ? "completed" : "partial",
      successCount,
      failedCount,
      splitPaymentId: result.id,
      results: result.results.map((r) => ({
        recipient: r.recipient,
        amount: r.amount,
        success: r.success,
        txHash: r.txHash,
        error: r.error,
      })),
    }
  }

  /**
   * 创建确认请求
   */
  static async createConfirmRequest(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase()

    // 更新状态
    await supabase
      .from("payroll_executions")
      .update({ status: "confirming" })
      .eq("id", execution.id)

    // 创建待确认任务
    await supabase.from("pending_actions").insert({
      execution_id: execution.id,
      type: "confirm",
      requester_address: schedule.ownerAddress.toLowerCase(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时后过期
      status: "pending",
      created_at: new Date().toISOString(),
    })

    console.log("[Payroll] Confirm request created:", {
      executionId: execution.id,
      scheduleName: schedule.name,
    })

    // TODO: 发送通知

    return { ...execution, status: "confirming" }
  }

  /**
   * 创建审批请求
   */
  static async createApprovalRequest(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase()

    // 更新状态
    await supabase
      .from("payroll_executions")
      .update({ status: "approving" })
      .eq("id", execution.id)

    // 为每个审批人创建待审批任务
    const approvers = schedule.approverAddresses || []
    for (const approver of approvers) {
      await supabase.from("pending_actions").insert({
        execution_id: execution.id,
        type: "approve",
        requester_address: schedule.ownerAddress.toLowerCase(),
        target_address: approver.toLowerCase(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        created_at: new Date().toISOString(),
      })
    }

    console.log("[Payroll] Approval requests created:", {
      executionId: execution.id,
      approverCount: approvers.length,
    })

    // TODO: 发送审批通知

    return { ...execution, status: "approving" }
  }

  /**
   * 确认执行
   */
  static async confirmExecution(
    executionId: string,
    confirmerAddress: string
  ): Promise<PayrollExecution> {
    const supabase = getSupabase()

    // 获取执行记录和关联的计划
    const { data: execution } = await supabase
      .from("payroll_executions")
      .select("*")
      .eq("id", executionId)
      .single()

    if (!execution || execution.status !== "confirming") {
      throw new Error("Invalid execution state")
    }

    const schedule = await this.getSchedule(execution.schedule_id)
    if (!schedule) {
      throw new Error("Schedule not found")
    }

    // 验证确认人
    if (schedule.ownerAddress.toLowerCase() !== confirmerAddress.toLowerCase()) {
      throw new Error("Unauthorized")
    }

    // 更新待处理任务
    await supabase
      .from("pending_actions")
      .update({ status: "completed" })
      .eq("execution_id", executionId)
      .eq("type", "confirm")

    // 执行发薪
    return await this.executePayroll(this.mapDbToExecution(execution), schedule)
  }

  /**
   * 审批执行
   */
  static async approveExecution(
    executionId: string,
    approverAddress: string
  ): Promise<void> {
    const supabase = getSupabase()

    // 更新审批任务状态
    const { error } = await supabase
      .from("pending_actions")
      .update({ status: "completed" })
      .eq("execution_id", executionId)
      .eq("target_address", approverAddress.toLowerCase())
      .eq("type", "approve")
      .eq("status", "pending")

    if (error) {
      throw new Error("Failed to approve")
    }

    // 检查是否所有审批都已完成
    const { data: pendingActions } = await supabase
      .from("pending_actions")
      .select("*")
      .eq("execution_id", executionId)
      .eq("type", "approve")
      .eq("status", "pending")

    // 如果没有待审批的任务了，执行发薪
    if (!pendingActions || pendingActions.length === 0) {
      const { data: execution } = await supabase
        .from("payroll_executions")
        .select("*")
        .eq("id", executionId)
        .single()

      if (execution) {
        const schedule = await this.getSchedule(execution.schedule_id)
        if (schedule) {
          await this.executePayroll(this.mapDbToExecution(execution), schedule)
        }
      }
    }
  }

  /**
   * 获取执行历史
   */
  static async getExecutions(
    scheduleId?: string,
    ownerAddress?: string,
    limit: number = 50
  ): Promise<PayrollExecution[]> {
    const supabase = getSupabase()

    let query = supabase
      .from("payroll_executions")
      .select("*, payroll_schedules!inner(owner_address)")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (scheduleId) {
      query = query.eq("schedule_id", scheduleId)
    }

    if (ownerAddress) {
      query = query.eq("payroll_schedules.owner_address", ownerAddress.toLowerCase())
    }

    const { data, error } = await query

    if (error) {
      console.error("[Payroll] Get executions error:", error)
      return []
    }

    return (data || []).map(this.mapDbToExecution)
  }

  /**
   * 获取待处理任务
   */
  static async getPendingActions(targetAddress: string): Promise<PendingAction[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("pending_actions")
      .select("*")
      .eq("target_address", targetAddress.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Payroll] Get pending actions error:", error)
      return []
    }

    return (data || []).map((item) => ({
      id: item.id,
      executionId: item.execution_id,
      type: item.type,
      requesterAddress: item.requester_address,
      targetAddress: item.target_address,
      expiresAt: item.expires_at,
      status: item.status,
      createdAt: item.created_at,
    }))
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * 数据库记录转 PayrollSchedule
   */
  private static mapDbToSchedule(data: any): PayrollSchedule {
    return {
      id: data.id,
      ownerAddress: data.owner_address,
      name: data.name,
      description: data.description,
      splitRule: data.split_rule,
      templateId: data.template_id,
      frequency: data.frequency,
      executionMode: data.execution_mode,
      approverAddresses: data.approver_addresses,
      maxAmountPerExecution: data.max_amount_per_execution,
      notifyEmail: data.notify_email,
      webhookUrl: data.webhook_url,
      notifyBeforeHours: data.notify_before_hours,
      status: data.status,
      nextExecution: data.next_execution,
      lastExecution: data.last_execution,
      executionCount: data.execution_count || 0,
      totalPaid: data.total_paid || 0,
      startDate: data.start_date,
      endDate: data.end_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  /**
   * 数据库记录转 PayrollExecution
   */
  private static mapDbToExecution(data: any): PayrollExecution {
    return {
      id: data.id,
      scheduleId: data.schedule_id,
      scheduledTime: data.scheduled_time,
      actualTime: data.actual_time,
      splitPaymentId: data.split_payment_id,
      totalAmount: data.total_amount,
      token: data.token,
      recipientCount: data.recipient_count,
      status: data.status,
      results: data.results,
      successCount: data.success_count || 0,
      failedCount: data.failed_count || 0,
      confirmedBy: data.confirmed_by,
      confirmedAt: data.confirmed_at,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at,
      errorMessage: data.error_message,
      createdAt: data.created_at,
    }
  }
}

// Export singleton methods
export const payrollSchedulerService = PayrollSchedulerService

export function calculateNextExecution(
  frequency: FrequencyConfig,
  fromDate?: Date
): Date {
  return PayrollSchedulerService.calculateNextExecution(frequency, fromDate)
}

export function getDueSchedules(): Promise<PayrollSchedule[]> {
  return PayrollSchedulerService.getDueSchedules()
}

export function processSchedule(schedule: PayrollSchedule): Promise<PayrollExecution> {
  return PayrollSchedulerService.processSchedule(schedule)
}
