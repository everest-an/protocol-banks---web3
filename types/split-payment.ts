/**
 * 分账类型定义
 * Split Payment Types
 *
 * 支持按百分比或固定金额将支付分配给多个收款人
 */

import Big from "big.js"

/**
 * 分账状态
 */
export type SplitPaymentStatus = "draft" | "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled"

/**
 * 分配类型
 */
export type AllocationMethod = "percentage" | "fixed"

/**
 * 单个分账接收者
 */
export interface SplitRecipient {
  /** 收款人地址 */
  address: string
  /** 分配比例（百分比模式）或固定金额（固定模式） */
  allocation: number
  /** 收款人名称（可选） */
  name?: string
  /** 备注（可选） */
  memo?: string
  /** 实际计算金额（运行时填充） */
  calculatedAmount?: number
  /** 分账结果 */
  result?: SplitPaymentResult
}

/**
 * 分账规则配置
 */
export interface SplitRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 分配方式 */
  method: AllocationMethod
  /** 接收者列表 */
  recipients: SplitRecipient[]
  /** 代币类型 */
  token: string
  /** 创建时间 */
  created_at: string
  /** 更新时间 */
  updated_at: string
  /** 创建者地址 */
  created_by: string
  /** 是否为模板 */
  is_template?: boolean
  /** 模板描述 */
  description?: string
}

/**
 * 分账模板（可复用的分账配置）
 */
export interface SplitTemplate {
  /** 模板 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description?: string
  /** 分配方式 */
  method: AllocationMethod
  /** 接收者列表（不含实际金额） */
  recipients: Omit<SplitRecipient, "calculatedAmount" | "result">[]
  /** 默认代币 */
  default_token: string
  /** 创建者地址 */
  created_by: string
  /** 创建时间 */
  created_at: string
  /** 更新时间 */
  updated_at: string
  /** 使用次数 */
  usage_count: number
  /** 是否激活 */
  is_active: boolean
}

/**
 * 分账支付请求
 */
export interface SplitPaymentRequest {
  /** 总金额 */
  totalAmount: number
  /** 代币类型 */
  token: string
  /** 分配方式 */
  method: AllocationMethod
  /** 接收者列表 */
  recipients: SplitRecipient[]
  /** 使用的模板 ID（可选） */
  templateId?: string
  /** 链 ID */
  chainId?: number
  /** 备注 */
  memo?: string
}

/**
 * 单笔分账结果
 */
export interface SplitPaymentResult {
  /** 是否成功 */
  success: boolean
  /** 收款人地址 */
  recipient: string
  /** 实际支付金额 */
  amount: number
  /** 交易哈希 */
  txHash?: string
  /** 错误信息 */
  error?: string
  /** 分配比例 */
  allocation: number
  /** 分配方式 */
  method: AllocationMethod
}

/**
 * 分账支付响应
 */
export interface SplitPaymentResponse {
  /** 分账 ID */
  id: string
  /** 状态 */
  status: SplitPaymentStatus
  /** 总金额 */
  totalAmount: number
  /** 实际支付总额 */
  paidAmount: number
  /** 代币类型 */
  token: string
  /** 分配方式 */
  method: AllocationMethod
  /** 各接收者结果 */
  results: SplitPaymentResult[]
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failedCount: number
  /** 创建时间 */
  created_at: string
  /** 完成时间 */
  completed_at?: string
  /** 手续费明细 */
  feeBreakdown?: SplitFeeBreakdown
}

/**
 * 分账手续费明细
 */
export interface SplitFeeBreakdown {
  /** 总金额 */
  totalAmount: number
  /** 平台费率 */
  platformFeeRate: number
  /** 平台手续费 */
  platformFee: number
  /** 网络 Gas 费估计 */
  estimatedGasFee: number
  /** 净支付金额 */
  netAmount: number
  /** 各笔手续费详情 */
  perRecipientFees: {
    recipient: string
    amount: number
    fee: number
    netAmount: number
  }[]
}

/**
 * 分账计算结果
 */
export interface SplitCalculation {
  /** 是否有效 */
  valid: boolean
  /** 计算后的接收者列表 */
  recipients: (SplitRecipient & { calculatedAmount: number })[]
  /** 总金额 */
  totalAmount: number
  /** 分配总额（应等于总金额） */
  allocatedTotal: number
  /** 舍入差额 */
  roundingDifference: number
  /** 错误信息 */
  errors: string[]
  /** 警告信息 */
  warnings: string[]
}

/**
 * 分账验证结果
 */
export interface SplitValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 错误列表 */
  errors: SplitValidationError[]
  /** 警告列表 */
  warnings: SplitValidationWarning[]
}

/**
 * 分账验证错误
 */
export interface SplitValidationError {
  /** 错误类型 */
  type: "INVALID_ADDRESS" | "INVALID_ALLOCATION" | "TOTAL_MISMATCH" | "DUPLICATE_RECIPIENT" | "EMPTY_RECIPIENTS" | "INVALID_AMOUNT"
  /** 错误消息 */
  message: string
  /** 相关索引 */
  index?: number
  /** 相关地址 */
  address?: string
}

/**
 * 分账验证警告
 */
export interface SplitValidationWarning {
  /** 警告类型 */
  type: "ROUNDING" | "LOW_AMOUNT" | "HIGH_FEE_RATIO"
  /** 警告消息 */
  message: string
  /** 相关值 */
  value?: number
}

/**
 * 分账历史记录
 */
export interface SplitPaymentHistory {
  /** 记录 ID */
  id: string
  /** 状态 */
  status: SplitPaymentStatus
  /** 总金额 */
  totalAmount: number
  /** 代币 */
  token: string
  /** 接收者数量 */
  recipientCount: number
  /** 成功数量 */
  successCount: number
  /** 分配方式 */
  method: AllocationMethod
  /** 使用的模板 ID */
  templateId?: string
  /** 模板名称 */
  templateName?: string
  /** 创建者地址 */
  created_by: string
  /** 创建时间 */
  created_at: string
  /** 完成时间 */
  completed_at?: string
  /** 详细结果 */
  results?: SplitPaymentResult[]
}

/**
 * 分账统计
 */
export interface SplitPaymentStats {
  /** 总分账次数 */
  totalSplits: number
  /** 总分账金额 */
  totalAmount: number
  /** 成功率 */
  successRate: number
  /** 常用模板 */
  frequentTemplates: {
    id: string
    name: string
    usageCount: number
  }[]
  /** 月度统计 */
  monthlyStats: {
    month: string
    count: number
    amount: number
  }[]
}

/**
 * 分账配置选项
 */
export interface SplitPaymentOptions {
  /** 最大并发数 */
  concurrency?: number
  /** 批次间延迟（毫秒） */
  batchDelay?: number
  /** 单笔超时（毫秒） */
  timeout?: number
  /** 失败重试次数 */
  retries?: number
  /** 小数精度 */
  precision?: number
  /** 舍入模式 */
  roundingMode?: "round" | "floor" | "ceil"
  /** 最小支付金额 */
  minAmount?: number
}

/**
 * 默认分账配置
 */
export const DEFAULT_SPLIT_OPTIONS: Required<SplitPaymentOptions> = {
  concurrency: 5,
  batchDelay: 200,
  timeout: 60000,
  retries: 1,
  precision: 6,
  roundingMode: "floor",
  minAmount: 0.01,
}
