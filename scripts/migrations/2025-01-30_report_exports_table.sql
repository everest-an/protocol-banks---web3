-- =====================================================
-- Protocol Banks - 报告导出表
-- 日期: 2025-01-30
-- 功能: 存储导出报告的元数据和历史记录
-- =====================================================

-- =====================================================
-- 报告导出记录表 (report_exports)
-- =====================================================

CREATE TABLE IF NOT EXISTS report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL,

  -- 报告信息
  report_type VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  -- 统计信息
  transaction_count INTEGER,
  total_amount DECIMAL(36, 18),

  -- 文件信息
  file_url TEXT,
  file_size INTEGER,

  -- 状态
  status VARCHAR(20) DEFAULT 'pending',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- 约束
  CONSTRAINT valid_report_type CHECK (
    report_type IN ('transactions', 'monthly', 'recipient')
  ),
  CONSTRAINT valid_format CHECK (
    format IN ('csv', 'excel', 'pdf')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'expired')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_report_exports_wallet
  ON report_exports(wallet_address);

CREATE INDEX IF NOT EXISTS idx_report_exports_created
  ON report_exports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_exports_status
  ON report_exports(status);

CREATE INDEX IF NOT EXISTS idx_report_exports_wallet_date
  ON report_exports(wallet_address, created_at DESC);

-- RLS
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report exports"
  ON report_exports FOR SELECT
  USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

CREATE POLICY "Users can create own report exports"
  ON report_exports FOR INSERT
  WITH CHECK (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

-- =====================================================
-- 清理过期报告的函数
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE report_exports
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status = 'completed';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE report_exports IS '报告导出记录';
COMMENT ON COLUMN report_exports.report_type IS '报告类型: transactions(交易明细), monthly(月度汇总), recipient(收款人汇总)';
COMMENT ON COLUMN report_exports.format IS '导出格式: csv, excel, pdf';
COMMENT ON COLUMN report_exports.expires_at IS '报告文件过期时间';
