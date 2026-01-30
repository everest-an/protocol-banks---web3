-- =====================================================
-- Protocol Banks - 数据库索引优化
-- 日期: 2025-01-30
-- 技术债务: TD-006
-- =====================================================

-- 说明：此脚本添加常用查询的索引以提升性能
-- 执行方式：在 Supabase SQL Editor 中运行

-- =====================================================
-- payments 表索引
-- =====================================================

-- 按创建者查询（常用于获取用户支付历史）
CREATE INDEX IF NOT EXISTS idx_payments_created_by
  ON payments(created_by);

-- 按创建时间排序（常用于时间线展示）
CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON payments(created_at DESC);

-- 按状态筛选
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);

-- 复合索引：用户 + 时间（最常用查询）
CREATE INDEX IF NOT EXISTS idx_payments_user_time
  ON payments(created_by, created_at DESC);

-- 复合索引：用户 + 状态
CREATE INDEX IF NOT EXISTS idx_payments_user_status
  ON payments(created_by, status);

-- =====================================================
-- batch_payments 表索引
-- =====================================================

-- 按发送地址查询
CREATE INDEX IF NOT EXISTS idx_batch_payments_from_address
  ON batch_payments(from_address);

-- 按状态筛选
CREATE INDEX IF NOT EXISTS idx_batch_payments_status
  ON batch_payments(status);

-- 按创建时间排序
CREATE INDEX IF NOT EXISTS idx_batch_payments_created_at
  ON batch_payments(created_at DESC);

-- 复合索引：地址 + 时间
CREATE INDEX IF NOT EXISTS idx_batch_payments_address_time
  ON batch_payments(from_address, created_at DESC);

-- =====================================================
-- subscriptions 表索引
-- =====================================================

-- 按创建者查询
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_by
  ON subscriptions(created_by);

-- 部分索引：活跃订阅的下次支付时间（用于定时任务）
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_active
  ON subscriptions(next_payment)
  WHERE status = 'active';

-- 按状态筛选
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status);

-- =====================================================
-- transactions 表索引（如果存在）
-- =====================================================

-- 按发送地址查询
CREATE INDEX IF NOT EXISTS idx_transactions_from_address
  ON transactions(from_address);

-- 按接收地址查询
CREATE INDEX IF NOT EXISTS idx_transactions_to_address
  ON transactions(to_address);

-- 按交易哈希查询（唯一查找）
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash
  ON transactions(tx_hash);

-- 按时间排序
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions(created_at DESC);

-- =====================================================
-- vendors 表索引（如果存在）
-- =====================================================

-- 按所有者查询
CREATE INDEX IF NOT EXISTS idx_vendors_owner_address
  ON vendors(owner_address);

-- 按状态筛选
CREATE INDEX IF NOT EXISTS idx_vendors_status
  ON vendors(status);

-- =====================================================
-- 验证索引创建
-- =====================================================

-- 查看所有索引
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- =====================================================
-- 注意事项
-- =====================================================

-- 1. 索引会占用存储空间，但能显著提升查询性能
-- 2. 写入操作会稍微变慢（需要维护索引）
-- 3. 建议在低峰期执行此脚本
-- 4. 执行后可用 EXPLAIN ANALYZE 验证查询是否使用索引
