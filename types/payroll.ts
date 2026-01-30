/**
 * 定时发薪类型定义
 * Payroll Schedule Types
 *
 * 支持自动/确认/审批模式的定时发薪功能
 */

import type { SplitRecipient, AllocationMethod } from "./split-payment"

/**
 * 发薪周期
 */
export type PayrollFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom"

/**
 * 执行模式
 */
export type ExecutionMode = "auto" | "confirm" | "approval"

/**
 * 计划状态
 */
export type ScheduleStatus = "active" | "paused" | "expired" | "cancelled"

/**
 * 执行状态
 */
export type ExecutionStatus =
  | "pending"     // 待执行
  | "confirming"  // 待确认
  | "approving"   // 待审批
  | "executing"   // 执行中
  | "completed"   // 已完成
  | "partial"     // 部分成功
  | "failed"      // 失败
  | "cancelled"   // 已取消
  | "missed"      // 错过窗口

/**
 * 周期配置
 */
export interface FrequencyConfig {
  /** 周期类型 */
  type: PayrollFrequency

  /** 执行时间 (HH:MM 格式，例如 "09:00") */
  time?: string

  /** 每周几 (0-6, 0=周日) - 用于 weekly */
  dayOfWeek?: number

  /** 起始日期 - 用于 biweekly */
  startDate?: string

  /** 每月几号 (1-31, -1=最后一天) - 用于 monthly */
  dayOfMonth?: number

  /** Cron 表达式 - 用于 custom */
  cronExpression?: string

  /** 时区 */
  timezone?: string
}

/**
 * 分账规则配置
 */
export interface PayrollSplitRule {
  /** 总金额 */
  totalAmount: number
  /** 代币 */
  token: string
  /** 链 ID */
  chainId: number
  /** 分配模式 */
  mode: AllocationMethod
  /** 收款人列表 */
  recipients: SplitRecipient[]
}

/**
 * 发薪计划
 */
export interface PayrollSchedule {
  /** 计划 ID */
  id: string
  /** 所有者地址 */
  ownerAddress: string
  /** 计划名称 */
  name: string
  /** 描述 */
  description?: string

  /** 分账规则 */
  splitRule: PayrollSplitRule
  /** 关联模板 ID */
  templateId?: string

  /** 周期配置 */
  frequency: FrequencyConfig

  /** 执行模式 */
  executionMode: ExecutionMode
  /** 审批人地址列表 */
  approverAddresses?: string[]
  /** 单次执行限额 */
  maxAmountPerExecution?: number

  /** 通知邮箱 */
  notifyEmail?: string
  /** Webhook URL */
  webhookUrl?: string
  /** 提前通知小时数 */
  notifyBeforeHours?: number

  /** 状态 */
  status: ScheduleStatus
  /** 下次执行时间 */
  nextExecution?: string
  /** 上次执行时间 */
  lastExecution?: string
  /** 执行次数 */
  executionCount: number
  /** 累计支付金额 */
  totalPaid: number

  /** 有效期开始日期 */
  startDate?: string
  /** 有效期结束日期 */
  endDate?: string

  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 执行记录
 */
export interface PayrollExecution {
  /** 执行 ID */
  id: string
  /** 关联计划 ID */
  scheduleId: string
  /** 计划执行时间 */
  scheduledTime: string
  /** 实际执行时间 */
  actualTime?: string

  /** 关联的分账任务 ID */
  splitPaymentId?: string
  /** 总金额 */
  totalAmount: number
  /** 代币 */
  token: string
  /** 收款人数量 */
  recipientCount: number

  /** 状态 */
  status: ExecutionStatus
  /** 执行结果 */
  results?: PayrollPaymentResult[]
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failedCount: number

  /** 确认人地址 */
  confirmedBy?: string
  /** 确认时间 */
  confirmedAt?: string
  /** 审批人地址 */
  approvedBy?: string
  /** 审批时间 */
  approvedAt?: string

  /** 错误信息 */
  errorMessage?: string

  /** 创建时间 */
  createdAt: string
}

/**
 * 执行结果详情
 */
export interface PayrollPaymentResult {
  /** 收款人地址 */
  recipient: string
  /** 金额 */
  amount: number
  /** 是否成功 */
  success: boolean
  /** 交易哈希 */
  txHash?: string
  /** 错误信息 */
  error?: string
}

/**
 * 待处理任务
 */
export interface PendingAction {
  /** 任务 ID */
  id: string
  /** 关联执行 ID */
  executionId: string
  /** 任务类型 */
  type: "confirm" | "approve"
  /** 请求者地址 */
  requesterAddress: string
  /** 目标地址（审批人） */
  targetAddress?: string
  /** 过期时间 */
  expiresAt: string
  /** 状态 */
  status: "pending" | "completed" | "expired" | "cancelled"
  /** 创建时间 */
  createdAt: string
}

/**
 * 创建计划请求
 */
export interface CreateScheduleRequest {
  name: string
  description?: string
  splitRule: PayrollSplitRule
  templateId?: string
  frequency: FrequencyConfig
  executionMode: ExecutionMode
  approverAddresses?: string[]
  maxAmountPerExecution?: number
  notifyEmail?: string
  webhookUrl?: string
  notifyBeforeHours?: number
  startDate?: string
  endDate?: string
}

/**
 * 更新计划请求
 */
export interface UpdateScheduleRequest {
  name?: string
  description?: string
  splitRule?: PayrollSplitRule
  frequency?: FrequencyConfig
  executionMode?: ExecutionMode
  approverAddresses?: string[]
  maxAmountPerExecution?: number
  notifyEmail?: string
  webhookUrl?: string
  notifyBeforeHours?: number
  endDate?: string
}

/**
 * 发薪统计
 */
export interface PayrollStats {
  /** 活跃计划数 */
  activeSchedules: number
  /** 本月执行次数 */
  monthlyExecutions: number
  /** 本月支付总额 */
  monthlyPaidAmount: number
  /** 待处理任务数 */
  pendingActions: number
  /** 最近执行 */
  recentExecutions: PayrollExecution[]
}

/**
 * 周期显示文本
 */
export const FREQUENCY_LABELS: Record<PayrollFrequency, string> = {
  daily: "每日",
  weekly: "每周",
  biweekly: "每两周",
  monthly: "每月",
  custom: "自定义",
}

/**
 * 执行模式显示文本
 */
export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  auto: "自动执行",
  confirm: "需要确认",
  approval: "需要审批",
}

/**
 * 状态显示文本
 */
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  active: "运行中",
  paused: "已暂停",
  expired: "已过期",
  cancelled: "已取消",
}

/**
 * 执行状态显示文本
 */
export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  pending: "待执行",
  confirming: "待确认",
  approving: "待审批",
  executing: "执行中",
  completed: "已完成",
  partial: "部分成功",
  failed: "失败",
  cancelled: "已取消",
  missed: "已错过",
}

/**
 * 星期几显示文本
 */
export const DAY_OF_WEEK_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
