-- =====================================================
-- Protocol Banks - Rain Card 相关表
-- 日期: 2025-01-30
-- 功能: Rain Card 虚拟卡管理、交易记录、授权检查
-- =====================================================

-- =====================================================
-- Rain Card 表 (rain_cards)
-- 存储用户的虚拟卡信息
-- =====================================================

CREATE TABLE IF NOT EXISTS rain_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id VARCHAR(100) UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,

  -- 卡信息
  card_last_four VARCHAR(4),
  card_type VARCHAR(20) DEFAULT 'virtual',
  currency VARCHAR(3) DEFAULT 'USD',

  -- 余额和限额
  balance DECIMAL(20, 6) DEFAULT 0,
  daily_limit DECIMAL(20, 2) DEFAULT 10000,
  monthly_limit DECIMAL(20, 2) DEFAULT 100000,
  single_tx_limit DECIMAL(20, 2) DEFAULT 5000,

  -- 状态
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'active',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,

  CONSTRAINT valid_card_status CHECK (
    status IN ('pending', 'active', 'frozen', 'cancelled')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rain_cards_user ON rain_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_rain_cards_wallet ON rain_cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rain_cards_active ON rain_cards(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE rain_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rain cards"
  ON rain_cards FOR SELECT
  USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
  );

-- =====================================================
-- Rain 交易记录表 (rain_transactions)
-- =====================================================

CREATE TABLE IF NOT EXISTS rain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  card_id VARCHAR(100) NOT NULL REFERENCES rain_cards(card_id),
  user_id VARCHAR(100) NOT NULL,

  -- 交易信息
  merchant_name VARCHAR(255),
  merchant_category_code VARCHAR(10),
  amount DECIMAL(20, 6) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,

  CONSTRAINT valid_tx_status CHECK (
    status IN ('pending', 'approved', 'declined', 'settled', 'refunded')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rain_tx_card ON rain_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_rain_tx_user ON rain_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rain_tx_status ON rain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_rain_tx_created ON rain_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rain_tx_daily ON rain_transactions(card_id, created_at)
  WHERE created_at >= CURRENT_DATE;

-- RLS
ALTER TABLE rain_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rain transactions"
  ON rain_transactions FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM rain_cards
      WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'address'
    )
  );

-- =====================================================
-- Rain 授权记录表 (rain_authorizations)
-- 记录每次授权请求的结果
-- =====================================================

CREATE TABLE IF NOT EXISTS rain_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id VARCHAR(100) UNIQUE NOT NULL,
  card_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,

  -- 交易信息
  merchant_name VARCHAR(255),
  amount DECIMAL(20, 6) NOT NULL,

  -- 授权结果
  approved BOOLEAN NOT NULL,
  reason VARCHAR(50) NOT NULL,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rain_auth_card ON rain_authorizations(card_id);
CREATE INDEX IF NOT EXISTS idx_rain_auth_created ON rain_authorizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rain_auth_approved ON rain_authorizations(approved);

-- RLS
ALTER TABLE rain_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage authorizations"
  ON rain_authorizations FOR ALL
  USING (TRUE);

-- =====================================================
-- 商户黑名单表 (rain_merchant_blacklist)
-- =====================================================

CREATE TABLE IF NOT EXISTS rain_merchant_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name VARCHAR(255),
  mcc VARCHAR(10),
  reason VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rain_blacklist_merchant ON rain_merchant_blacklist(merchant_name);
CREATE INDEX IF NOT EXISTS idx_rain_blacklist_mcc ON rain_merchant_blacklist(mcc);
CREATE INDEX IF NOT EXISTS idx_rain_blacklist_active ON rain_merchant_blacklist(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE rain_merchant_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage blacklist"
  ON rain_merchant_blacklist FOR ALL
  USING (TRUE);

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE TRIGGER update_rain_cards_updated_at
  BEFORE UPDATE ON rain_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rain_blacklist_updated_at
  BEFORE UPDATE ON rain_merchant_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 初始黑名单数据（高风险商户类别）
-- =====================================================

INSERT INTO rain_merchant_blacklist (mcc, reason) VALUES
  ('5967', 'Direct marketing - inbound telemarketing'),
  ('5966', 'Direct marketing - outbound telemarketing'),
  ('7995', 'Betting/casino gambling'),
  ('7994', 'Video game arcades'),
  ('6051', 'Quasi cash - foreign currency'),
  ('6012', 'Financial institutions - merchandise and services'),
  ('4829', 'Wire transfer/money orders'),
  ('6211', 'Security brokers/dealers')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE rain_cards IS 'Rain 虚拟卡信息';
COMMENT ON COLUMN rain_cards.balance IS '当前余额 (USD)';
COMMENT ON COLUMN rain_cards.daily_limit IS '每日消费限额';
COMMENT ON COLUMN rain_cards.monthly_limit IS '每月消费限额';
COMMENT ON COLUMN rain_cards.single_tx_limit IS '单笔交易限额';

COMMENT ON TABLE rain_transactions IS 'Rain 卡交易记录';
COMMENT ON COLUMN rain_transactions.merchant_category_code IS '商户类别代码 (MCC)';

COMMENT ON TABLE rain_authorizations IS 'Rain 授权请求记录';
COMMENT ON COLUMN rain_authorizations.reason IS '授权结果原因码';

COMMENT ON TABLE rain_merchant_blacklist IS '商户黑名单';
COMMENT ON COLUMN rain_merchant_blacklist.mcc IS '商户类别代码 (MCC)';
