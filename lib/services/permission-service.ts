/**
 * Permission Service
 * 权限管理服务
 */

import { getSupabase } from "@/lib/supabase"
import type {
  Organization,
  OrganizationMember,
  OrganizationSettings,
  Role,
  Permission,
  PermissionAction,
  ResourceType,
  PresetRole,
  MemberInvite,
  ApprovalRule,
  ApprovalRequest,
  Approval,
  PaymentLimit,
  CheckPermissionRequest,
  CheckPermissionResult,
  CreateOrganizationRequest,
  InviteMemberRequest,
  CreateRoleRequest,
  PRESET_ROLE_PERMISSIONS,
} from "@/types/permission"

/**
 * 权限服务类
 */
export class PermissionService {
  // =====================================================
  // 组织管理
  // =====================================================

  /**
   * 创建组织
   */
  static async createOrganization(
    ownerAddress: string,
    request: CreateOrganizationRequest
  ): Promise<Organization> {
    const supabase = getSupabase()

    // 生成 slug
    const slug = request.slug || this.generateSlug(request.name)

    // 检查 slug 是否已存在
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (existing) {
      throw new Error("Organization slug already exists")
    }

    // 默认设置
    const defaultSettings: OrganizationSettings = {
      defaultCurrency: "USDC",
      requireApprovalAbove: 10000,
      maxDailyLimit: 100000,
      multisigRequired: false,
      ...request.settings,
    }

    // 创建组织
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: request.name,
        slug,
        owner_address: ownerAddress,
        description: request.description,
        logo: request.logo,
        settings: defaultSettings,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create organization: ${error.message}`)

    // 创建默认角色
    await this.createDefaultRoles(org.id)

    // 将所有者添加为成员
    const ownerRole = await this.getRoleByType(org.id, "owner")
    if (ownerRole) {
      await this.addMember(org.id, {
        walletAddress: ownerAddress,
        roleId: ownerRole.id,
      })
    }

    return this.mapOrganization(org)
  }

  /**
   * 获取用户的组织列表
   */
  static async getUserOrganizations(userAddress: string): Promise<Organization[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("organization_members")
      .select("organization:organizations(*)")
      .eq("wallet_address", userAddress.toLowerCase())
      .eq("status", "active")

    if (error) throw new Error(`Failed to get organizations: ${error.message}`)

    return (data || [])
      .map((item: any) => item.organization)
      .filter(Boolean)
      .map(this.mapOrganization)
  }

  /**
   * 获取组织详情
   */
  static async getOrganization(id: string): Promise<Organization | null> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) return null
    return this.mapOrganization(data)
  }

  /**
   * 更新组织设置
   */
  static async updateOrganizationSettings(
    id: string,
    settings: Partial<OrganizationSettings>
  ): Promise<void> {
    const supabase = getSupabase()

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", id)
      .single()

    if (!org) throw new Error("Organization not found")

    const newSettings = { ...org.settings, ...settings }

    const { error } = await supabase
      .from("organizations")
      .update({ settings: newSettings })
      .eq("id", id)

    if (error) throw new Error(`Failed to update settings: ${error.message}`)
  }

  // =====================================================
  // 角色管理
  // =====================================================

  /**
   * 创建默认角色
   */
  private static async createDefaultRoles(organizationId: string): Promise<void> {
    const presetRoles: PresetRole[] = ["owner", "admin", "finance", "approver", "viewer"]

    for (const roleType of presetRoles) {
      await this.createRole(organizationId, {
        name: this.getRoleDisplayName(roleType),
        type: roleType,
        permissions: PRESET_ROLE_PERMISSIONS[roleType],
      })
    }
  }

  /**
   * 创建角色
   */
  static async createRole(
    organizationId: string,
    request: CreateRoleRequest
  ): Promise<Role> {
    const supabase = getSupabase()

    const permissions = request.type === "custom"
      ? request.permissions || []
      : PRESET_ROLE_PERMISSIONS[request.type]

    const { data, error } = await supabase
      .from("roles")
      .insert({
        organization_id: organizationId,
        name: request.name,
        description: request.description,
        type: request.type,
        permissions,
        is_system: request.type !== "custom",
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create role: ${error.message}`)
    return this.mapRole(data)
  }

  /**
   * 获取组织的角色列表
   */
  static async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (error) throw new Error(`Failed to get roles: ${error.message}`)
    return (data || []).map(this.mapRole)
  }

  /**
   * 根据类型获取角色
   */
  static async getRoleByType(
    organizationId: string,
    type: PresetRole
  ): Promise<Role | null> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", type)
      .single()

    if (error || !data) return null
    return this.mapRole(data)
  }

  /**
   * 更新角色权限
   */
  static async updateRolePermissions(
    roleId: string,
    permissions: Permission[]
  ): Promise<void> {
    const supabase = getSupabase()

    const { data: role } = await supabase
      .from("roles")
      .select("is_system")
      .eq("id", roleId)
      .single()

    if (role?.is_system) {
      throw new Error("Cannot modify system role permissions")
    }

    const { error } = await supabase
      .from("roles")
      .update({ permissions })
      .eq("id", roleId)

    if (error) throw new Error(`Failed to update role: ${error.message}`)
  }

  /**
   * 删除角色
   */
  static async deleteRole(roleId: string): Promise<void> {
    const supabase = getSupabase()

    const { data: role } = await supabase
      .from("roles")
      .select("is_system")
      .eq("id", roleId)
      .single()

    if (role?.is_system) {
      throw new Error("Cannot delete system role")
    }

    // 检查是否有成员使用此角色
    const { data: members } = await supabase
      .from("organization_members")
      .select("id")
      .eq("role_id", roleId)
      .limit(1)

    if (members && members.length > 0) {
      throw new Error("Cannot delete role with assigned members")
    }

    const { error } = await supabase
      .from("roles")
      .delete()
      .eq("id", roleId)

    if (error) throw new Error(`Failed to delete role: ${error.message}`)
  }

  // =====================================================
  // 成员管理
  // =====================================================

  /**
   * 邀请成员
   */
  static async inviteMember(
    organizationId: string,
    invitedBy: string,
    request: InviteMemberRequest
  ): Promise<MemberInvite> {
    const supabase = getSupabase()

    if (!request.email && !request.walletAddress) {
      throw new Error("Either email or walletAddress is required")
    }

    // 检查是否已是成员
    if (request.walletAddress) {
      const { data: existing } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("wallet_address", request.walletAddress.toLowerCase())
        .single()

      if (existing) {
        throw new Error("User is already a member")
      }
    }

    // 设置过期时间（7天）
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from("member_invites")
      .insert({
        organization_id: organizationId,
        email: request.email,
        wallet_address: request.walletAddress?.toLowerCase(),
        role_id: request.roleId,
        invited_by: invitedBy.toLowerCase(),
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create invite: ${error.message}`)

    // TODO: 发送邀请邮件

    return this.mapInvite(data)
  }

  /**
   * 接受邀请
   */
  static async acceptInvite(inviteId: string, walletAddress: string): Promise<OrganizationMember> {
    const supabase = getSupabase()

    const { data: invite } = await supabase
      .from("member_invites")
      .select("*")
      .eq("id", inviteId)
      .single()

    if (!invite) throw new Error("Invite not found")
    if (invite.status !== "pending") throw new Error("Invite is no longer valid")
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invite has expired")

    // 如果邀请指定了钱包地址，验证是否匹配
    if (invite.wallet_address && invite.wallet_address !== walletAddress.toLowerCase()) {
      throw new Error("Wallet address does not match invitation")
    }

    // 添加为成员
    const member = await this.addMember(invite.organization_id, {
      walletAddress,
      roleId: invite.role_id,
    })

    // 更新邀请状态
    await supabase
      .from("member_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteId)

    return member
  }

  /**
   * 添加成员（内部方法）
   */
  private static async addMember(
    organizationId: string,
    data: { walletAddress: string; roleId: string; email?: string; name?: string }
  ): Promise<OrganizationMember> {
    const supabase = getSupabase()

    const { data: member, error } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        wallet_address: data.walletAddress.toLowerCase(),
        email: data.email,
        name: data.name,
        role_id: data.roleId,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .select("*, role:roles(*)")
      .single()

    if (error) throw new Error(`Failed to add member: ${error.message}`)
    return this.mapMember(member)
  }

  /**
   * 获取组织成员列表
   */
  static async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("organization_members")
      .select("*, role:roles(*)")
      .eq("organization_id", organizationId)
      .order("joined_at", { ascending: true })

    if (error) throw new Error(`Failed to get members: ${error.message}`)
    return (data || []).map(this.mapMember)
  }

  /**
   * 更新成员角色
   */
  static async updateMemberRole(memberId: string, roleId: string): Promise<void> {
    const supabase = getSupabase()

    const { error } = await supabase
      .from("organization_members")
      .update({ role_id: roleId })
      .eq("id", memberId)

    if (error) throw new Error(`Failed to update member role: ${error.message}`)
  }

  /**
   * 移除成员
   */
  static async removeMember(memberId: string): Promise<void> {
    const supabase = getSupabase()

    // 检查是否为所有者
    const { data: member } = await supabase
      .from("organization_members")
      .select("*, role:roles(*), organization:organizations(*)")
      .eq("id", memberId)
      .single()

    if (!member) throw new Error("Member not found")

    if (member.role?.type === "owner") {
      throw new Error("Cannot remove organization owner")
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ status: "inactive" })
      .eq("id", memberId)

    if (error) throw new Error(`Failed to remove member: ${error.message}`)
  }

  // =====================================================
  // 权限检查
  // =====================================================

  /**
   * 检查权限
   */
  static async checkPermission(request: CheckPermissionRequest): Promise<CheckPermissionResult> {
    const supabase = getSupabase()

    // 获取用户在组织中的角色
    const { data: member } = await supabase
      .from("organization_members")
      .select("*, role:roles(*)")
      .eq("organization_id", request.organizationId)
      .eq("wallet_address", request.userAddress.toLowerCase())
      .eq("status", "active")
      .single()

    if (!member) {
      return { allowed: false, reason: "User is not a member of this organization" }
    }

    const role = member.role as Role | null
    if (!role) {
      return { allowed: false, reason: "User has no assigned role" }
    }

    // 检查角色权限
    const permissions = role.permissions as Permission[]
    const resourcePermission = permissions.find((p) => p.resource === request.resource)

    if (!resourcePermission) {
      return { allowed: false, reason: "No permission for this resource" }
    }

    if (!resourcePermission.actions.includes(request.action)) {
      return { allowed: false, reason: `Action '${request.action}' not allowed` }
    }

    // 检查是否需要审批
    const approvalRequired = await this.checkApprovalRequired(
      request.organizationId,
      request.resource,
      request.action,
      request.resourceId
    )

    if (approvalRequired) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalRuleId: approvalRequired.ruleId,
      }
    }

    return { allowed: true }
  }

  /**
   * 批量检查权限
   */
  static async checkPermissions(
    organizationId: string,
    userAddress: string,
    checks: Array<{ resource: ResourceType; action: PermissionAction }>
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {}

    for (const check of checks) {
      const key = `${check.resource}:${check.action}`
      const checkResult = await this.checkPermission({
        organizationId,
        userAddress,
        resource: check.resource,
        action: check.action,
      })
      result[key] = checkResult.allowed
    }

    return result
  }

  /**
   * 检查是否需要审批
   */
  private static async checkApprovalRequired(
    organizationId: string,
    resource: ResourceType,
    action: PermissionAction,
    resourceId?: string
  ): Promise<{ ruleId: string } | null> {
    // 只有特定操作需要检查审批
    if (!["execute", "approve", "delete"].includes(action)) {
      return null
    }

    const supabase = getSupabase()

    // 获取组织的审批规则
    const { data: rules } = await supabase
      .from("approval_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("priority", { ascending: true })

    if (!rules || rules.length === 0) return null

    // TODO: 根据规则类型检查是否需要审批
    // 这里需要获取资源详情来检查金额等条件

    return null
  }

  // =====================================================
  // 审批流程
  // =====================================================

  /**
   * 创建审批请求
   */
  static async createApprovalRequest(
    organizationId: string,
    ruleId: string,
    resourceType: ResourceType,
    resourceId: string,
    requestedBy: string,
    metadata?: Record<string, any>
  ): Promise<ApprovalRequest> {
    const supabase = getSupabase()

    // 获取规则
    const { data: rule } = await supabase
      .from("approval_rules")
      .select("*")
      .eq("id", ruleId)
      .single()

    if (!rule) throw new Error("Approval rule not found")

    // 设置过期时间（24小时）
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        organization_id: organizationId,
        rule_id: ruleId,
        resource_type: resourceType,
        resource_id: resourceId,
        requested_by: requestedBy.toLowerCase(),
        required_count: rule.required_approvers,
        current_count: 0,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        metadata,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create approval request: ${error.message}`)
    return this.mapApprovalRequest(data)
  }

  /**
   * 审批/拒绝请求
   */
  static async processApproval(
    requestId: string,
    approverAddress: string,
    action: "approve" | "reject",
    comment?: string
  ): Promise<ApprovalRequest> {
    const supabase = getSupabase()

    // 获取审批请求
    const { data: request } = await supabase
      .from("approval_requests")
      .select("*, rule:approval_rules(*)")
      .eq("id", requestId)
      .single()

    if (!request) throw new Error("Approval request not found")
    if (request.status !== "pending") throw new Error("Request is no longer pending")
    if (new Date(request.expires_at) < new Date()) throw new Error("Request has expired")

    // 检查审批权限
    const canApprove = await this.canApprove(
      request.organization_id,
      approverAddress,
      request.rule
    )

    if (!canApprove) {
      throw new Error("User is not authorized to approve this request")
    }

    // 检查是否已审批过
    const { data: existingApproval } = await supabase
      .from("approvals")
      .select("id")
      .eq("request_id", requestId)
      .eq("approver_address", approverAddress.toLowerCase())
      .single()

    if (existingApproval) {
      throw new Error("User has already processed this request")
    }

    // 记录审批
    await supabase.from("approvals").insert({
      request_id: requestId,
      approver_address: approverAddress.toLowerCase(),
      action,
      comment,
    })

    // 更新请求状态
    let newStatus = request.status
    let newCount = request.current_count

    if (action === "reject") {
      newStatus = "rejected"
    } else {
      newCount = request.current_count + 1
      if (newCount >= request.required_count) {
        newStatus = "approved"
      }
    }

    const { data: updated, error } = await supabase
      .from("approval_requests")
      .update({
        status: newStatus,
        current_count: newCount,
      })
      .eq("id", requestId)
      .select("*, approvals(*)")
      .single()

    if (error) throw new Error(`Failed to update request: ${error.message}`)
    return this.mapApprovalRequest(updated)
  }

  /**
   * 检查用户是否可以审批
   */
  private static async canApprove(
    organizationId: string,
    userAddress: string,
    rule: any
  ): Promise<boolean> {
    // 检查是否为指定审批人
    if (rule.approver_addresses?.length > 0) {
      return rule.approver_addresses
        .map((a: string) => a.toLowerCase())
        .includes(userAddress.toLowerCase())
    }

    // 检查角色
    if (rule.approver_roles?.length > 0) {
      const supabase = getSupabase()
      const { data: member } = await supabase
        .from("organization_members")
        .select("role_id")
        .eq("organization_id", organizationId)
        .eq("wallet_address", userAddress.toLowerCase())
        .eq("status", "active")
        .single()

      if (!member) return false
      return rule.approver_roles.includes(member.role_id)
    }

    // 默认检查是否有审批权限
    const permCheck = await this.checkPermission({
      organizationId,
      userAddress,
      resource: rule.resource_type || "payment",
      action: "approve",
    })

    return permCheck.allowed
  }

  /**
   * 获取待审批列表
   */
  static async getPendingApprovals(
    organizationId: string,
    userAddress?: string
  ): Promise<ApprovalRequest[]> {
    const supabase = getSupabase()

    let query = supabase
      .from("approval_requests")
      .select("*, rule:approval_rules(*), approvals(*)")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    const { data, error } = await query

    if (error) throw new Error(`Failed to get approvals: ${error.message}`)

    let requests = (data || []).map(this.mapApprovalRequest)

    // 如果指定了用户，过滤出该用户可以审批的请求
    if (userAddress) {
      const filtered: ApprovalRequest[] = []
      for (const req of requests) {
        const canApprove = await this.canApprove(organizationId, userAddress, req.rule)
        if (canApprove) {
          filtered.push(req)
        }
      }
      requests = filtered
    }

    return requests
  }

  // =====================================================
  // 支付限额
  // =====================================================

  /**
   * 检查支付限额
   */
  static async checkPaymentLimit(
    organizationId: string,
    userAddress: string,
    amount: number,
    currency: string
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    const supabase = getSupabase()

    // 获取用户的限额配置
    const { data: limits } = await supabase
      .from("payment_limits")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .or(`member_address.eq.${userAddress.toLowerCase()},member_address.is.null`)
      .order("member_address", { ascending: false }) // 优先使用用户特定限额

    if (!limits || limits.length === 0) {
      return { allowed: true }
    }

    // 检查每种限额类型
    for (const limit of limits) {
      if (limit.currency !== currency) continue

      const remaining = limit.amount - limit.current_usage

      if (limit.limit_type === "per_transaction" && amount > limit.amount) {
        return {
          allowed: false,
          reason: `Exceeds per-transaction limit of ${limit.amount} ${currency}`,
          remaining: limit.amount,
        }
      }

      if (amount > remaining) {
        return {
          allowed: false,
          reason: `Exceeds ${limit.limit_type} limit. Remaining: ${remaining} ${currency}`,
          remaining,
        }
      }
    }

    return { allowed: true }
  }

  /**
   * 更新限额使用量
   */
  static async updateLimitUsage(
    organizationId: string,
    userAddress: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const supabase = getSupabase()

    // 获取并更新相关限额
    const { data: limits } = await supabase
      .from("payment_limits")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("currency", currency)
      .eq("is_active", true)
      .or(`member_address.eq.${userAddress.toLowerCase()},member_address.is.null`)

    if (!limits) return

    for (const limit of limits) {
      if (limit.limit_type === "per_transaction") continue // 单笔限额不累计

      await supabase
        .from("payment_limits")
        .update({ current_usage: limit.current_usage + amount })
        .eq("id", limit.id)
    }
  }

  // =====================================================
  // 辅助方法
  // =====================================================

  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  private static getRoleDisplayName(type: PresetRole): string {
    const names: Record<PresetRole, string> = {
      owner: "所有者",
      admin: "管理员",
      finance: "财务",
      approver: "审批人",
      viewer: "查看者",
      custom: "自定义",
    }
    return names[type]
  }

  private static mapOrganization(data: any): Organization {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      ownerAddress: data.owner_address,
      logo: data.logo,
      description: data.description,
      settings: data.settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  private static mapRole(data: any): Role {
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      description: data.description,
      type: data.type,
      permissions: data.permissions,
      isDefault: data.is_default,
      isSystem: data.is_system,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  private static mapMember(data: any): OrganizationMember {
    return {
      id: data.id,
      organizationId: data.organization_id,
      walletAddress: data.wallet_address,
      email: data.email,
      name: data.name,
      roleId: data.role_id,
      role: data.role ? this.mapRole(data.role) : undefined,
      status: data.status,
      invitedBy: data.invited_by,
      invitedAt: data.invited_at,
      joinedAt: data.joined_at,
      lastActiveAt: data.last_active_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  private static mapInvite(data: any): MemberInvite {
    return {
      id: data.id,
      organizationId: data.organization_id,
      email: data.email,
      walletAddress: data.wallet_address,
      roleId: data.role_id,
      status: data.status,
      invitedBy: data.invited_by,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      createdAt: data.created_at,
    }
  }

  private static mapApprovalRequest(data: any): ApprovalRequest {
    return {
      id: data.id,
      organizationId: data.organization_id,
      resourceType: data.resource_type,
      resourceId: data.resource_id,
      requestedBy: data.requested_by,
      requestedAt: data.requested_at || data.created_at,
      ruleId: data.rule_id,
      rule: data.rule,
      requiredCount: data.required_count,
      currentCount: data.current_count,
      status: data.status,
      approvals: (data.approvals || []).map((a: any) => ({
        id: a.id,
        requestId: a.request_id,
        approverAddress: a.approver_address,
        approverName: a.approver_name,
        action: a.action,
        comment: a.comment,
        signature: a.signature,
        createdAt: a.created_at,
      })),
      expiresAt: data.expires_at,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }
}
