-- =====================================================
-- Protocol Banks - 订阅执行器相关表
-- 日期: 2025-01-30
-- 功能: 订阅自动支付授权和重试队列
-- =====================================================

-- =====================================================
-- 订阅授权表 (subscription_authorizations)
-- 存储用户的支付授权信息（EIP-3009 或 allowance）
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  authorization_type VARCHAR(20) NOT NULL,

  -- EIP-3009 字段
  signature TEXT,
  nonce VARCHAR(66),
  valid_after BIGINT,
  valid_before BIGINT,

  -- 通用字段
  token_address VARCHAR(42) NOT NULL,
  spender_address VARCHAR(42),
  amount VARCHAR(78) NOT NULL,
  chain_id INTEGER NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_auth_type CHECK (
    authorization_type IN ('eip3009', 'allowance')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sub_auth_subscription
  ON subscription_authorizations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_auth_active
  ON subscription_authorizations(subscription_id, is_active)
  WHERE is_active = TRUE;

-- RLS
ALTER TABLE subscription_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription authorizations"
  ON subscription_authorizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_authorizations.subscription_id
        AND subscriptions.owner_address = current_setting('request.jwt.claims', true)::json->>'address'
    )
  );

CREATE POLICY "Users can manage own subscription authorizations"
  ON subscription_authorizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_authorizations.subscription_id
        AND subscriptions.owner_address = current_setting('request.jwt.claims', true)::json->>'address'
    )
  );

-- =====================================================
-- 订阅支付重试队列 (subscription_payment_retries)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_payment_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  error_message TEXT,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sub_retry_subscription
  ON subscription_payment_retries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_retry_pending
  ON subscription_payment_retries(retry_at)
  WHERE retry_count < 3;

-- RLS
ALTER TABLE subscription_payment_retries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage retries"
  ON subscription_payment_retries FOR ALL
  USING (TRUE);

-- =====================================================
-- 订阅支付历史 (subscription_payments)
-- 记录每次支付的详细信息
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount VARCHAR(78) NOT NULL,
  token VARCHAR(20) NOT NULL,
  chain_id INTEGER NOT NULL,
  tx_hash VARCHAR(66),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_payment_status CHECK (
    status IN ('pending', 'executing', 'completed', 'failed')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription
  ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status
  ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_time
  ON subscription_payments(created_at DESC);

-- RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription payments"
  ON subscription_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_payments.subscription_id
        AND subscriptions.owner_address = current_setting('request.jwt.claims', true)::json->>'address'
    )
  );

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE TRIGGER update_sub_auth_updated_at
  BEFORE UPDATE ON subscription_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_retry_updated_at
  BEFORE UPDATE ON subscription_payment_retries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE subscription_authorizations IS '订阅支付授权表';
COMMENT ON COLUMN subscription_authorizations.authorization_type IS '授权类型: eip3009(EIP-3009预授权) 或 allowance(合约授权)';
COMMENT ON COLUMN subscription_authorizations.signature IS 'EIP-3009 签名';
COMMENT ON COLUMN subscription_authorizations.nonce IS 'EIP-3009 nonce (bytes32)';
COMMENT ON COLUMN subscription_authorizations.valid_after IS '授权生效时间戳';
COMMENT ON COLUMN subscription_authorizations.valid_before IS '授权过期时间戳';

COMMENT ON TABLE subscription_payment_retries IS '订阅支付重试队列';
COMMENT ON COLUMN subscription_payment_retries.retry_count IS '已重试次数，最多3次';
COMMENT ON COLUMN subscription_payment_retries.retry_at IS '下次重试时间';

COMMENT ON TABLE subscription_payments IS '订阅支付历史记录';
