/**
 * Permission System Types
 * 企业级权限管理系统
 */

// =====================================================
// 基础权限定义
// =====================================================

/**
 * 权限操作类型
 */
export type PermissionAction =
  | "view"           // 查看
  | "create"         // 创建
  | "edit"           // 编辑
  | "delete"         // 删除
  | "approve"        // 审批
  | "execute"        // 执行
  | "export"         // 导出
  | "manage"         // 管理（完全控制）

/**
 * 资源类型
 */
export type ResourceType =
  | "payment"        // 支付
  | "batch_payment"  // 批量支付
  | "split_payment"  // 分账支付
  | "payroll"        // 发薪计划
  | "template"       // 模板
  | "member"         // 成员
  | "role"           // 角色
  | "settings"       // 设置
  | "api_key"        // API密钥
  | "webhook"        // Webhook
  | "report"         // 报表
  | "audit_log"      // 审计日志

/**
 * 单个权限定义
 */
export interface Permission {
  resource: ResourceType
  actions: PermissionAction[]
  conditions?: PermissionCondition[]
}

/**
 * 权限条件（细粒度控制）
 */
export interface PermissionCondition {
  field: string           // 字段名
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin"
  value: any              // 条件值
}

// =====================================================
// 角色定义
// =====================================================

/**
 * 预设角色类型
 */
export type PresetRole =
  | "owner"          // 所有者 - 完全控制
  | "admin"          // 管理员 - 管理权限
  | "finance"        // 财务 - 支付操作
  | "approver"       // 审批人 - 审批权限
  | "viewer"         // 查看者 - 只读权限
  | "custom"         // 自定义角色

/**
 * 角色定义
 */
export interface Role {
  id: string
  organizationId: string
  name: string
  description?: string
  type: PresetRole
  permissions: Permission[]
  isDefault?: boolean      // 是否为默认角色
  isSystem?: boolean       // 是否为系统角色（不可删除）
  createdAt: string
  updatedAt?: string
}

/**
 * 预设角色权限配置
 */
export const PRESET_ROLE_PERMISSIONS: Record<PresetRole, Permission[]> = {
  owner: [
    { resource: "payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export", "manage"] },
    { resource: "batch_payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export", "manage"] },
    { resource: "split_payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export", "manage"] },
    { resource: "payroll", actions: ["view", "create", "edit", "delete", "approve", "execute", "export", "manage"] },
    { resource: "template", actions: ["view", "create", "edit", "delete", "manage"] },
    { resource: "member", actions: ["view", "create", "edit", "delete", "manage"] },
    { resource: "role", actions: ["view", "create", "edit", "delete", "manage"] },
    { resource: "settings", actions: ["view", "edit", "manage"] },
    { resource: "api_key", actions: ["view", "create", "edit", "delete", "manage"] },
    { resource: "webhook", actions: ["view", "create", "edit", "delete", "manage"] },
    { resource: "report", actions: ["view", "export", "manage"] },
    { resource: "audit_log", actions: ["view", "export"] },
  ],
  admin: [
    { resource: "payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export"] },
    { resource: "batch_payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export"] },
    { resource: "split_payment", actions: ["view", "create", "edit", "delete", "approve", "execute", "export"] },
    { resource: "payroll", actions: ["view", "create", "edit", "delete", "approve", "execute", "export"] },
    { resource: "template", actions: ["view", "create", "edit", "delete"] },
    { resource: "member", actions: ["view", "create", "edit", "delete"] },
    { resource: "role", actions: ["view", "create", "edit"] },
    { resource: "settings", actions: ["view", "edit"] },
    { resource: "api_key", actions: ["view", "create", "edit", "delete"] },
    { resource: "webhook", actions: ["view", "create", "edit", "delete"] },
    { resource: "report", actions: ["view", "export"] },
    { resource: "audit_log", actions: ["view"] },
  ],
  finance: [
    { resource: "payment", actions: ["view", "create", "execute", "export"] },
    { resource: "batch_payment", actions: ["view", "create", "execute", "export"] },
    { resource: "split_payment", actions: ["view", "create", "execute", "export"] },
    { resource: "payroll", actions: ["view", "create", "execute", "export"] },
    { resource: "template", actions: ["view"] },
    { resource: "report", actions: ["view", "export"] },
    { resource: "audit_log", actions: ["view"] },
  ],
  approver: [
    { resource: "payment", actions: ["view", "approve"] },
    { resource: "batch_payment", actions: ["view", "approve"] },
    { resource: "split_payment", actions: ["view", "approve"] },
    { resource: "payroll", actions: ["view", "approve"] },
    { resource: "template", actions: ["view"] },
    { resource: "audit_log", actions: ["view"] },
  ],
  viewer: [
    { resource: "payment", actions: ["view"] },
    { resource: "batch_payment", actions: ["view"] },
    { resource: "split_payment", actions: ["view"] },
    { resource: "payroll", actions: ["view"] },
    { resource: "template", actions: ["view"] },
    { resource: "report", actions: ["view"] },
  ],
  custom: [],
}

/**
 * 角色显示名称
 */
export const ROLE_LABELS: Record<PresetRole, string> = {
  owner: "所有者",
  admin: "管理员",
  finance: "财务",
  approver: "审批人",
  viewer: "查看者",
  custom: "自定义",
}

// =====================================================
// 组织与成员
// =====================================================

/**
 * 组织类型
 */
export interface Organization {
  id: string
  name: string
  slug: string                    // URL友好名称
  ownerAddress: string            // 创建者钱包地址
  logo?: string
  description?: string
  settings: OrganizationSettings
  createdAt: string
  updatedAt?: string
}

/**
 * 组织设置
 */
export interface OrganizationSettings {
  defaultCurrency: string         // 默认币种
  requireApprovalAbove?: number   // 超过此金额需要审批
  maxDailyLimit?: number          // 每日最大支付限额
  allowedChains?: number[]        // 允许的链ID
  multisigRequired?: boolean      // 是否需要多签
  multisigThreshold?: number      // 多签阈值
}

/**
 * 成员邀请状态
 */
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked"

/**
 * 组织成员
 */
export interface OrganizationMember {
  id: string
  organizationId: string
  walletAddress: string
  email?: string
  name?: string
  roleId: string
  role?: Role                     // 关联的角色
  status: "active" | "inactive" | "suspended"
  invitedBy?: string
  invitedAt?: string
  joinedAt?: string
  lastActiveAt?: string
  createdAt: string
  updatedAt?: string
}

/**
 * 成员邀请
 */
export interface MemberInvite {
  id: string
  organizationId: string
  email?: string
  walletAddress?: string
  roleId: string
  status: InviteStatus
  invitedBy: string
  expiresAt: string
  acceptedAt?: string
  createdAt: string
}

// =====================================================
// 审批流程
// =====================================================

/**
 * 审批规则类型
 */
export type ApprovalRuleType =
  | "amount_threshold"      // 金额阈值
  | "recipient_count"       // 收款人数量
  | "new_recipient"         // 新收款人
  | "cross_chain"           // 跨链交易
  | "always"                // 始终需要

/**
 * 审批规则
 */
export interface ApprovalRule {
  id: string
  organizationId: string
  name: string
  description?: string
  type: ApprovalRuleType
  condition?: {
    threshold?: number        // 金额阈值
    count?: number            // 数量阈值
  }
  requiredApprovers: number   // 需要的审批人数
  approverRoles?: string[]    // 可审批的角色ID
  approverAddresses?: string[] // 指定的审批人地址
  priority: number            // 优先级（数字越小越优先）
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

/**
 * 审批请求
 */
export interface ApprovalRequest {
  id: string
  organizationId: string
  resourceType: ResourceType
  resourceId: string
  requestedBy: string
  requestedAt: string
  ruleId: string
  rule?: ApprovalRule
  requiredCount: number
  currentCount: number
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled"
  approvals: Approval[]
  expiresAt: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt?: string
}

/**
 * 单个审批记录
 */
export interface Approval {
  id: string
  requestId: string
  approverAddress: string
  approverName?: string
  action: "approve" | "reject"
  comment?: string
  signature?: string           // 链上签名（可选）
  createdAt: string
}

// =====================================================
// 支付限额
// =====================================================

/**
 * 限额类型
 */
export type LimitType = "daily" | "weekly" | "monthly" | "per_transaction"

/**
 * 支付限额配置
 */
export interface PaymentLimit {
  id: string
  organizationId: string
  roleId?: string              // 针对特定角色
  memberAddress?: string       // 针对特定成员
  limitType: LimitType
  amount: number
  currency: string
  currentUsage: number
  resetAt?: string             // 下次重置时间
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

// =====================================================
// API 请求/响应
// =====================================================

/**
 * 创建组织请求
 */
export interface CreateOrganizationRequest {
  name: string
  slug?: string
  description?: string
  logo?: string
  settings?: Partial<OrganizationSettings>
}

/**
 * 邀请成员请求
 */
export interface InviteMemberRequest {
  email?: string
  walletAddress?: string
  roleId: string
}

/**
 * 创建角色请求
 */
export interface CreateRoleRequest {
  name: string
  description?: string
  type: PresetRole
  permissions?: Permission[]
}

/**
 * 权限检查请求
 */
export interface CheckPermissionRequest {
  organizationId: string
  userAddress: string
  resource: ResourceType
  action: PermissionAction
  resourceId?: string          // 具体资源ID（用于条件检查）
}

/**
 * 权限检查结果
 */
export interface CheckPermissionResult {
  allowed: boolean
  reason?: string
  requiresApproval?: boolean
  approvalRuleId?: string
}

// =====================================================
// 审计日志
// =====================================================

/**
 * 权限相关审计事件
 */
export type PermissionAuditEvent =
  | "member_invited"
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "limit_exceeded"
  | "permission_denied"

/**
 * 权限审计日志
 */
export interface PermissionAuditLog {
  id: string
  organizationId: string
  event: PermissionAuditEvent
  actorAddress: string
  targetAddress?: string
  resourceType?: ResourceType
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}
