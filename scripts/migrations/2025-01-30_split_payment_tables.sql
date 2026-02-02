-- =====================================================
-- Protocol Banks - 分账功能数据库表
-- 日期: 2025-01-30
-- 功能: 01-split-payment (百分比分账)
-- =====================================================

-- 说明：此脚本创建分账功能所需的数据库表
-- 执行方式：在 Supabase SQL Editor 中运行

-- =====================================================
-- 分账记录表 (split_payments)
-- =====================================================

CREATE TABLE IF NOT EXISTS split_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  split_id VARCHAR(64) UNIQUE NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  total_amount DECIMAL(20, 6) NOT NULL,
  paid_amount DECIMAL(20, 6) DEFAULT 0,
  token VARCHAR(20) NOT NULL DEFAULT 'USDC',
  method VARCHAR(20) NOT NULL CHECK (method IN ('percentage', 'fixed')),
  recipient_count INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
  template_id VARCHAR(64),
  recipients JSONB NOT NULL,
  results JSONB,
  memo TEXT,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_split_payments_from_address
  ON split_payments(from_address);
CREATE INDEX IF NOT EXISTS idx_split_payments_status
  ON split_payments(status);
CREATE INDEX IF NOT EXISTS idx_split_payments_created_at
  ON split_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_split_payments_template_id
  ON split_payments(template_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_address_time
  ON split_payments(from_address, created_at DESC);

-- RLS 策略
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的分账记录
CREATE POLICY "Users can view own split payments"
  ON split_payments FOR SELECT
  USING (from_address = current_setting('request.jwt.claims', true)::json->>'address');

-- 用户只能创建自己的分账记录
CREATE POLICY "Users can create own split payments"
  ON split_payments FOR INSERT
  WITH CHECK (from_address = current_setting('request.jwt.claims', true)::json->>'address');

-- 用户只能更新自己的分账记录
CREATE POLICY "Users can update own split payments"
  ON split_payments FOR UPDATE
  USING (from_address = current_setting('request.jwt.claims', true)::json->>'address');

-- =====================================================
-- 分账模板表 (split_templates)
-- =====================================================

CREATE TABLE IF NOT EXISTS split_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  method VARCHAR(20) NOT NULL CHECK (method IN ('percentage', 'fixed')),
  recipients JSONB NOT NULL,
  default_token VARCHAR(20) NOT NULL DEFAULT 'USDC',
  created_by VARCHAR(42) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_split_templates_created_by
  ON split_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_split_templates_active
  ON split_templates(is_active)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_split_templates_usage
  ON split_templates(usage_count DESC);

-- RLS 策略
ALTER TABLE split_templates ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的模板
CREATE POLICY "Users can view own templates"
  ON split_templates FOR SELECT
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'address');

-- 用户只能创建自己的模板
CREATE POLICY "Users can create own templates"
  ON split_templates FOR INSERT
  WITH CHECK (created_by = current_setting('request.jwt.claims', true)::json->>'address');

-- 用户只能更新自己的模板
CREATE POLICY "Users can update own templates"
  ON split_templates FOR UPDATE
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'address');

-- 用户只能删除自己的模板
CREATE POLICY "Users can delete own templates"
  ON split_templates FOR DELETE
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'address');

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_split_payments_updated_at
  BEFORE UPDATE ON split_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_templates_updated_at
  BEFORE UPDATE ON split_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 触发器：模板使用计数
-- =====================================================

CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    UPDATE split_templates
    SET usage_count = usage_count + 1
    WHERE id = NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_template_usage_on_split
  AFTER INSERT ON split_payments
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage();

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE split_payments IS '分账支付记录表';
COMMENT ON COLUMN split_payments.split_id IS '分账唯一标识';
COMMENT ON COLUMN split_payments.method IS '分配方式: percentage(百分比) 或 fixed(固定金额)';
COMMENT ON COLUMN split_payments.recipients IS '收款人列表 JSON 数组';
COMMENT ON COLUMN split_payments.results IS '支付结果 JSON 数组';

COMMENT ON TABLE split_templates IS '分账模板表，可复用的分账配置';
COMMENT ON COLUMN split_templates.usage_count IS '模板使用次数，用于排序';
COMMENT ON COLUMN split_templates.is_active IS '软删除标记';

-- =====================================================
-- 验证
-- =====================================================

-- 查看创建的表
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'split%';

-- 查看索引
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'split%';
