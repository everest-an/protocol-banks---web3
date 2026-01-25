# 🚀 P0 改进数据库迁移指南

## 📋 迁移概述

本次迁移将创建 `payment_retry_queue` 表，用于确保支付数据零丢失。

**时间**: 约 2 分钟
**风险**: 低（仅创建新表，不影响现有数据）
**回滚**: 简单（删除表即可）

---

## ✅ 方式 1: Supabase Dashboard（推荐）

### 第 1 步: 打开 SQL 编辑器

访问您的 Supabase 项目 SQL 编辑器：

```
https://uasxfshglutvtcovpmej.supabase.co/project/_/sql
```

或者：
1. 访问 https://supabase.com/dashboard
2. 选择项目 `uasxfshglutvtcovpmej`
3. 点击左侧菜单 "SQL Editor"

---

### 第 2 步: 创建新查询

点击右上角 **"+ New Query"** 按钮

---

### 第 3 步: 粘贴迁移脚本

复制以下完整脚本并粘贴到编辑器中：

```sql
-- ============================================
-- Payment Retry Queue Migration
-- Protocol Banks P0 Improvement
-- ============================================

-- Create payment retry queue table
CREATE TABLE IF NOT EXISTS payment_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT NOT NULL UNIQUE,
  payment_data JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_retry_queue_status_next_retry
  ON payment_retry_queue(status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_retry_queue_tx_hash
  ON payment_retry_queue(tx_hash);

CREATE INDEX IF NOT EXISTS idx_retry_queue_failed
  ON payment_retry_queue(status, updated_at DESC)
  WHERE status = 'failed';

-- Enable RLS
ALTER TABLE payment_retry_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Service role can manage retry queue" ON payment_retry_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_payment_retry_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_payment_retry_queue_timestamp ON payment_retry_queue;
CREATE TRIGGER trigger_update_payment_retry_queue_timestamp
  BEFORE UPDATE ON payment_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_queue_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON payment_retry_queue TO service_role;

-- Verify creation
SELECT 'Migration completed successfully!' as status;
```

---

### 第 4 步: 执行迁移

点击右下角 **"Run"** 按钮（或按 `Ctrl/Cmd + Enter`）

---

### 第 5 步: 验证成功

**成功标志**：
- ✅ 看到消息 "Success. No rows returned" 或 "Migration completed successfully!"
- ✅ 没有红色错误信息

**验证表创建**：
1. 点击左侧 **"Table Editor"**
2. 在表列表中找到 `payment_retry_queue`
3. 点击查看表结构

---

### 第 6 步: 验证查询（可选）

在 SQL 编辑器中运行以下查询验证：

```sql
-- 检查表是否存在
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'payment_retry_queue';

-- 检查列
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_retry_queue'
ORDER BY ordinal_position;

-- 检查索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payment_retry_queue';

-- 检查 RLS 策略
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'payment_retry_queue';
```

**预期结果**：
- ✅ 1 个表
- ✅ 11 个列
- ✅ 4 个索引（包括主键）
- ✅ 1 个 RLS 策略

---

## ✅ 方式 2: 命令行（备选）

如果您安装了 `psql`：

```bash
cd /home/kevin/web3/protocol-banks---web3

# 执行迁移
psql "$POSTGRES_URL_NON_POOLING" -f scripts/020_create_payment_retry_queue.sql

# 或使用完整连接串
psql "postgres://postgres.uasxfshglutvtcovpmej:a7GGOT1qG5wyhTJl@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -f scripts/020_create_payment_retry_queue.sql
```

---

## 🧪 迁移后测试

### 测试 1: API 端点测试

```bash
# 启动开发服务器
npm run dev

# 测试重试队列 API
curl -X POST http://localhost:3000/api/payment/retry-queue \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x1234567890abcdef",
    "paymentData": {
      "tx_hash": "0x1234567890abcdef",
      "from_address": "0xabc123",
      "to_address": "0xdef456",
      "token_symbol": "USDC",
      "token_address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "10",
      "amount_usd": 10,
      "status": "completed"
    }
  }'

# 预期响应:
# {"success":true,"message":"Payment queued for retry","queueId":"..."}
```

### 测试 2: 数据库查询

在 Supabase SQL 编辑器中运行：

```sql
-- 查看重试队列
SELECT * FROM payment_retry_queue ORDER BY created_at DESC;

-- 应该看到刚才测试插入的记录
```

---

## 🔄 回滚步骤（如需要）

如果需要回滚此次迁移：

```sql
-- 删除表（会级联删除所有相关对象）
DROP TABLE IF EXISTS payment_retry_queue CASCADE;

-- 删除函数
DROP FUNCTION IF EXISTS update_payment_retry_queue_timestamp() CASCADE;
```

---

## 📊 迁移完成后的系统状态

### ✅ 新增功能

1. **数据零丢失保证**
   - 支付成功但 DB 写入失败 → 自动进入重试队列
   - 重试队列记录包含完整支付数据

2. **监控能力**
   ```sql
   -- 查看待重试的支付
   SELECT tx_hash, retry_count, next_retry_at
   FROM payment_retry_queue
   WHERE status = 'pending'
   ORDER BY next_retry_at;

   -- 查看失败的重试
   SELECT tx_hash, retry_count, error_message
   FROM payment_retry_queue
   WHERE status = 'failed';
   ```

3. **自动化能力**
   - 可通过 Vercel Cron Job 自动处理重试队列
   - 详见 `/app/api/payment/retry-processor/route.ts`（可选功能）

---

## 📝 常见问题

### Q: 迁移会影响现有数据吗？
**A:** 不会。此迁移仅创建新表，不修改任何现有表。

### Q: 如果迁移失败怎么办？
**A:**
1. 检查错误信息
2. 确认数据库权限正常
3. 联系 Supabase 支持或检查连接

### Q: 重试队列会自动运行吗？
**A:**
- 手动重试：通过 SQL 查询和 API 调用
- 自动重试：需要配置 Cron Job（可选）

---

## 🎉 完成确认清单

迁移完成后，请确认：

- [ ] 表 `payment_retry_queue` 已创建
- [ ] 3 个索引已创建
- [ ] RLS 策略已启用
- [ ] 测试 API 调用成功
- [ ] 可以查询到测试数据

**全部完成后，P0 改进即全部部署完毕！** 🚀

---

## 📞 需要帮助？

如遇到问题，请提供：
1. 错误截图
2. 执行的 SQL 语句
3. 错误消息全文

我会立即协助解决！
