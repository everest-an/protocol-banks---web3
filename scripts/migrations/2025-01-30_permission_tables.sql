-- =====================================================
-- Protocol Banks - 权限系统数据库表
-- 日期: 2025-01-30
-- 功能: 03-permission-system (权限管理)
-- =====================================================

-- 说明：此脚本创建权限系统所需的数据库表
-- 执行方式：在 Supabase SQL Editor 中运行

-- =====================================================
-- 组织表 (organizations)
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_address VARCHAR(42) NOT NULL,
  logo TEXT,
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_organizations_owner
  ON organizations(owner_address);
CREATE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations(slug);

-- RLS 策略
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Only owner can update organization"
  ON organizations FOR UPDATE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'address');

-- =====================================================
-- 角色表 (roles)
-- =====================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'custom',
  permissions JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_role_type CHECK (
    type IN ('owner', 'admin', 'finance', 'approver', 'viewer', 'custom')
  ),
  CONSTRAINT unique_role_name_per_org UNIQUE (organization_id, name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_roles_organization
  ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_type
  ON roles(type);

-- RLS 策略
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles of their organizations"
  ON roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = roles.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = roles.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
        AND r.type IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 组织成员表 (organization_members)
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  email VARCHAR(255),
  name VARCHAR(100),
  role_id UUID NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  invited_by VARCHAR(42),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_member_status CHECK (
    status IN ('active', 'inactive', 'suspended')
  ),
  CONSTRAINT unique_member_per_org UNIQUE (organization_id, wallet_address)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_org_members_organization
  ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_wallet
  ON organization_members(wallet_address);
CREATE INDEX IF NOT EXISTS idx_org_members_role
  ON organization_members(role_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status
  ON organization_members(status);

-- RLS 策略
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
    )
  );

CREATE POLICY "Admins can manage members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = organization_members.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
        AND r.type IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 成员邀请表 (member_invites)
-- =====================================================

CREATE TABLE IF NOT EXISTS member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255),
  wallet_address VARCHAR(42),
  role_id UUID NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by VARCHAR(42) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_invite_status CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  ),
  CONSTRAINT invite_has_contact CHECK (
    email IS NOT NULL OR wallet_address IS NOT NULL
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_member_invites_organization
  ON member_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_invites_email
  ON member_invites(email)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_member_invites_wallet
  ON member_invites(wallet_address)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_member_invites_expires
  ON member_invites(expires_at)
  WHERE status = 'pending';

-- RLS 策略
ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and manage invites"
  ON member_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = member_invites.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
        AND r.type IN ('owner', 'admin')
    )
  );

CREATE POLICY "Invitees can view their own invites"
  ON member_invites FOR SELECT
  USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
    OR email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- =====================================================
-- 审批规则表 (approval_rules)
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL,
  condition JSONB,
  required_approvers INTEGER NOT NULL DEFAULT 1,
  approver_roles UUID[],
  approver_addresses TEXT[],
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_rule_type CHECK (
    type IN ('amount_threshold', 'recipient_count', 'new_recipient', 'cross_chain', 'always')
  ),
  CONSTRAINT valid_approvers_count CHECK (required_approvers > 0)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_approval_rules_organization
  ON approval_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_rules_active
  ON approval_rules(organization_id, is_active)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_approval_rules_priority
  ON approval_rules(organization_id, priority);

-- RLS 策略
ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view approval rules"
  ON approval_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = approval_rules.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Admins can manage approval rules"
  ON approval_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = approval_rules.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
        AND r.type IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 审批请求表 (approval_requests)
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES approval_rules(id),
  resource_type VARCHAR(30) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  requested_by VARCHAR(42) NOT NULL,
  required_count INTEGER NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_request_status CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_approval_requests_organization
  ON approval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
  ON approval_requests(organization_id, status, expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_requests_resource
  ON approval_requests(resource_type, resource_id);

-- RLS 策略
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view approval requests"
  ON approval_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = approval_requests.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Members can create approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = approval_requests.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

-- =====================================================
-- 审批记录表 (approvals)
-- =====================================================

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  approver_address VARCHAR(42) NOT NULL,
  approver_name VARCHAR(100),
  action VARCHAR(10) NOT NULL,
  comment TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_approval_action CHECK (action IN ('approve', 'reject')),
  CONSTRAINT unique_approval_per_request UNIQUE (request_id, approver_address)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_approvals_request
  ON approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver
  ON approvals(approver_address);

-- RLS 策略
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view approvals"
  ON approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approval_requests ar
      JOIN organization_members om ON om.organization_id = ar.organization_id
      WHERE ar.id = approvals.request_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
    )
  );

CREATE POLICY "Approvers can create approvals"
  ON approvals FOR INSERT
  WITH CHECK (
    approver_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

-- =====================================================
-- 支付限额表 (payment_limits)
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  member_address VARCHAR(42),
  limit_type VARCHAR(20) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  currency VARCHAR(20) NOT NULL,
  current_usage DECIMAL(36, 18) NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_limit_type CHECK (
    limit_type IN ('daily', 'weekly', 'monthly', 'per_transaction')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payment_limits_organization
  ON payment_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_limits_member
  ON payment_limits(member_address)
  WHERE member_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_limits_active
  ON payment_limits(organization_id, is_active)
  WHERE is_active = TRUE;

-- RLS 策略
ALTER TABLE payment_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payment limits"
  ON payment_limits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = payment_limits.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Admins can manage payment limits"
  ON payment_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = payment_limits.organization_id
        AND om.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND om.status = 'active'
        AND r.type IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 权限审计日志表 (permission_audit_logs)
-- =====================================================

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL,
  actor_address VARCHAR(42) NOT NULL,
  target_address VARCHAR(42),
  resource_type VARCHAR(30),
  resource_id VARCHAR(64),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_perm_audit_organization
  ON permission_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_perm_audit_actor
  ON permission_audit_logs(actor_address);
CREATE INDEX IF NOT EXISTS idx_perm_audit_event
  ON permission_audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_perm_audit_time
  ON permission_audit_logs(created_at DESC);

-- RLS 策略
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit logs"
  ON permission_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = permission_audit_logs.organization_id
        AND organization_members.wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
        AND organization_members.status = 'active'
    )
  );

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_permission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

CREATE TRIGGER update_approval_rules_updated_at
  BEFORE UPDATE ON approval_rules
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

CREATE TRIGGER update_payment_limits_updated_at
  BEFORE UPDATE ON payment_limits
  FOR EACH ROW EXECUTE FUNCTION update_permission_updated_at();

-- =====================================================
-- 触发器：自动重置周期限额
-- =====================================================

CREATE OR REPLACE FUNCTION reset_periodic_limits()
RETURNS void AS $$
BEGIN
  -- 重置每日限额
  UPDATE payment_limits
  SET current_usage = 0, reset_at = NOW() + INTERVAL '1 day'
  WHERE limit_type = 'daily'
    AND is_active = TRUE
    AND (reset_at IS NULL OR reset_at < NOW());

  -- 重置每周限额
  UPDATE payment_limits
  SET current_usage = 0, reset_at = NOW() + INTERVAL '1 week'
  WHERE limit_type = 'weekly'
    AND is_active = TRUE
    AND (reset_at IS NULL OR reset_at < NOW());

  -- 重置每月限额
  UPDATE payment_limits
  SET current_usage = 0, reset_at = NOW() + INTERVAL '1 month'
  WHERE limit_type = 'monthly'
    AND is_active = TRUE
    AND (reset_at IS NULL OR reset_at < NOW());
END;
$$ language 'plpgsql';

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE organizations IS '组织表';
COMMENT ON COLUMN organizations.slug IS 'URL友好的唯一标识';
COMMENT ON COLUMN organizations.settings IS '组织设置 JSON';

COMMENT ON TABLE roles IS '角色表';
COMMENT ON COLUMN roles.type IS '角色类型: owner, admin, finance, approver, viewer, custom';
COMMENT ON COLUMN roles.permissions IS '权限配置 JSON 数组';
COMMENT ON COLUMN roles.is_system IS '是否为系统角色（不可删除）';

COMMENT ON TABLE organization_members IS '组织成员表';
COMMENT ON COLUMN organization_members.status IS '成员状态: active, inactive, suspended';

COMMENT ON TABLE member_invites IS '成员邀请表';
COMMENT ON COLUMN member_invites.status IS '邀请状态: pending, accepted, expired, revoked';

COMMENT ON TABLE approval_rules IS '审批规则表';
COMMENT ON COLUMN approval_rules.type IS '规则类型: amount_threshold, recipient_count, new_recipient, cross_chain, always';
COMMENT ON COLUMN approval_rules.condition IS '触发条件配置 JSON';

COMMENT ON TABLE approval_requests IS '审批请求表';
COMMENT ON COLUMN approval_requests.metadata IS '请求相关的元数据';

COMMENT ON TABLE payment_limits IS '支付限额表';
COMMENT ON COLUMN payment_limits.limit_type IS '限额类型: daily, weekly, monthly, per_transaction';

COMMENT ON TABLE permission_audit_logs IS '权限审计日志表';

-- =====================================================
-- 验证
-- =====================================================

-- 查看创建的表
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('organizations', 'roles', 'organization_members', 'member_invites', 'approval_rules', 'approval_requests', 'approvals', 'payment_limits', 'permission_audit_logs');
