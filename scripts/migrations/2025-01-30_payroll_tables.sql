-- =====================================================
-- Protocol Banks - 定时发薪功能数据库表
-- 日期: 2025-01-30
-- 功能: 02-scheduled-payroll (定时发薪)
-- =====================================================

-- 说明：此脚本创建定时发薪功能所需的数据库表
-- 执行方式：在 Supabase SQL Editor 中运行

-- =====================================================
-- 发薪计划表 (payroll_schedules)
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 分账配置
  split_rule JSONB NOT NULL,
  template_id VARCHAR(64) REFERENCES split_templates(id),

  -- 周期配置
  frequency JSONB NOT NULL,

  -- 执行配置
  execution_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
  approver_addresses TEXT[],
  max_amount_per_execution DECIMAL(36, 18),

  -- 通知配置
  notify_email VARCHAR(255),
  webhook_url TEXT,
  notify_before_hours INTEGER DEFAULT 24,

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  next_execution TIMESTAMPTZ,
  last_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  total_paid DECIMAL(36, 18) DEFAULT 0,

  -- 有效期
  start_date DATE,
  end_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_schedule_status CHECK (
    status IN ('active', 'paused', 'expired', 'cancelled')
  ),
  CONSTRAINT valid_execution_mode CHECK (
    execution_mode IN ('auto', 'confirm', 'approval')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_owner
  ON payroll_schedules(owner_address);
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_status
  ON payroll_schedules(status);
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_next
  ON payroll_schedules(next_execution)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_owner_status
  ON payroll_schedules(owner_address, status);

-- RLS 策略
ALTER TABLE payroll_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON payroll_schedules FOR SELECT
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'address');

CREATE POLICY "Users can create own schedules"
  ON payroll_schedules FOR INSERT
  WITH CHECK (owner_address = current_setting('request.jwt.claims', true)::json->>'address');

CREATE POLICY "Users can update own schedules"
  ON payroll_schedules FOR UPDATE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'address');

CREATE POLICY "Users can delete own schedules"
  ON payroll_schedules FOR DELETE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'address');

-- =====================================================
-- 执行记录表 (payroll_executions)
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES payroll_schedules(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_time TIMESTAMPTZ,

  -- 执行详情
  split_payment_id VARCHAR(64),
  total_amount DECIMAL(36, 18) NOT NULL,
  token VARCHAR(20) NOT NULL,
  recipient_count INTEGER NOT NULL,

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  results JSONB,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- 审批信息
  confirmed_by VARCHAR(42),
  confirmed_at TIMESTAMPTZ,
  approved_by VARCHAR(42),
  approved_at TIMESTAMPTZ,

  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_execution_status CHECK (
    status IN ('pending', 'confirming', 'approving', 'executing',
               'completed', 'partial', 'failed', 'cancelled', 'missed')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payroll_executions_schedule
  ON payroll_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payroll_executions_status
  ON payroll_executions(status);
CREATE INDEX IF NOT EXISTS idx_payroll_executions_time
  ON payroll_executions(scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_executions_schedule_time
  ON payroll_executions(schedule_id, scheduled_time DESC);

-- RLS 策略（通过 schedule 关联判断权限）
ALTER TABLE payroll_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions of own schedules"
  ON payroll_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payroll_schedules
      WHERE payroll_schedules.id = payroll_executions.schedule_id
        AND payroll_schedules.owner_address = current_setting('request.jwt.claims', true)::json->>'address'
    )
  );

-- =====================================================
-- 待处理任务表 (pending_actions)
-- =====================================================

CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES payroll_executions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  requester_address VARCHAR(42) NOT NULL,
  target_address VARCHAR(42),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_action_type CHECK (type IN ('confirm', 'approve')),
  CONSTRAINT valid_action_status CHECK (
    status IN ('pending', 'completed', 'expired', 'cancelled')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pending_actions_execution
  ON pending_actions(execution_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_target
  ON pending_actions(target_address)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_actions_requester
  ON pending_actions(requester_address);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires
  ON pending_actions(expires_at)
  WHERE status = 'pending';

-- RLS 策略
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己需要处理的任务
CREATE POLICY "Users can view own pending actions"
  ON pending_actions FOR SELECT
  USING (
    target_address = current_setting('request.jwt.claims', true)::json->>'address'
    OR requester_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

-- 用户可以更新自己需要处理的任务
CREATE POLICY "Users can update own pending actions"
  ON pending_actions FOR UPDATE
  USING (
    target_address = current_setting('request.jwt.claims', true)::json->>'address'
    OR requester_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_payroll_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payroll_schedules_updated_at
  BEFORE UPDATE ON payroll_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_updated_at();

-- =====================================================
-- 触发器：过期任务自动标记
-- =====================================================

CREATE OR REPLACE FUNCTION mark_expired_actions()
RETURNS void AS $$
BEGIN
  UPDATE pending_actions
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- 可以通过 Cron 或手动调用此函数

-- =====================================================
-- 触发器：计划过期检查
-- =====================================================

CREATE OR REPLACE FUNCTION check_schedule_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER check_payroll_schedule_expiration
  BEFORE UPDATE ON payroll_schedules
  FOR EACH ROW
  EXECUTE FUNCTION check_schedule_expiration();

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE payroll_schedules IS '定时发薪计划表';
COMMENT ON COLUMN payroll_schedules.split_rule IS '分账规则 JSON，包含收款人列表和金额配置';
COMMENT ON COLUMN payroll_schedules.frequency IS '执行频率配置 JSON';
COMMENT ON COLUMN payroll_schedules.execution_mode IS '执行模式: auto(自动), confirm(需确认), approval(需审批)';
COMMENT ON COLUMN payroll_schedules.next_execution IS '下次执行时间';

COMMENT ON TABLE payroll_executions IS '发薪执行记录表';
COMMENT ON COLUMN payroll_executions.split_payment_id IS '关联的分账支付 ID';
COMMENT ON COLUMN payroll_executions.results IS '执行结果 JSON 数组';

COMMENT ON TABLE pending_actions IS '待处理任务表（确认/审批）';
COMMENT ON COLUMN pending_actions.type IS '任务类型: confirm(确认) 或 approve(审批)';
COMMENT ON COLUMN pending_actions.target_address IS '需要处理任务的人（审批人）';

-- =====================================================
-- 验证
-- =====================================================

-- 查看创建的表
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'payroll%';

-- 查看索引
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'payroll%';
