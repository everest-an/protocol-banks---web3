# 百分比分账功能 - 数据库设计

## 1. 表结构

### 1.1 split_payments - 分账记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| creator_address | VARCHAR(42) | NOT NULL, INDEX | 创建者钱包地址 |
| total_amount | DECIMAL(36, 18) | NOT NULL | 总金额 |
| token | VARCHAR(20) | NOT NULL, DEFAULT 'USDC' | 代币符号 |
| chain_id | INTEGER | NOT NULL, DEFAULT 8453 | 链 ID |
| split_mode | VARCHAR(20) | NOT NULL, DEFAULT 'percentage' | 分账模式 |
| rule | JSONB | NOT NULL | 分账规则 JSON |
| calculation | JSONB | | 计算结果 JSON |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 状态 |
| results | JSONB | | 执行结果 JSON |
| error_message | TEXT | | 错误信息 |
| template_id | UUID | FK → split_templates | 来源模板 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| executed_at | TIMESTAMPTZ | | 执行时间 |

**状态枚举**:
- `pending` - 待执行
- `executing` - 执行中
- `completed` - 已完成
- `partial` - 部分成功
- `failed` - 失败
- `cancelled` - 已取消

### 1.2 split_templates - 分账模板表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| owner_address | VARCHAR(42) | NOT NULL, INDEX | 所有者钱包地址 |
| name | VARCHAR(100) | NOT NULL | 模板名称 |
| description | TEXT | | 模板描述 |
| rule | JSONB | NOT NULL | 分账规则（不含总金额） |
| usage_count | INTEGER | DEFAULT 0 | 使用次数 |
| is_default | BOOLEAN | DEFAULT FALSE | 是否默认模板 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**约束**:
- UNIQUE (owner_address, name) - 同一用户下模板名唯一

---

## 2. JSON 字段结构

### 2.1 rule 字段

```json
{
  "mode": "percentage",
  "totalAmount": 10000,
  "token": "USDC",
  "chainId": 8453,
  "items": [
    {
      "id": "item_1",
      "address": "0x123...",
      "name": "Alice",
      "percentage": 40
    },
    {
      "id": "item_2",
      "address": "0x456...",
      "name": "Bob",
      "percentage": 35
    },
    {
      "id": "item_3",
      "address": "0x789...",
      "name": "Charlie",
      "percentage": 25
    }
  ]
}
```

### 2.2 calculation 字段

```json
{
  "success": true,
  "items": [
    {
      "address": "0x123...",
      "name": "Alice",
      "percentage": 40,
      "amount": 4000
    },
    {
      "address": "0x456...",
      "name": "Bob",
      "percentage": 35,
      "amount": 3500
    },
    {
      "address": "0x789...",
      "name": "Charlie",
      "percentage": 25,
      "amount": 2500
    }
  ],
  "totalAmount": 10000,
  "remainderAddress": "0x789..."
}
```

### 2.3 results 字段

```json
[
  {
    "success": true,
    "recipient": "0x123...",
    "amount": 4000,
    "token": "USDC",
    "txHash": "0xabc..."
  },
  {
    "success": true,
    "recipient": "0x456...",
    "amount": 3500,
    "token": "USDC",
    "txHash": "0xdef..."
  },
  {
    "success": false,
    "recipient": "0x789...",
    "amount": 2500,
    "token": "USDC",
    "error": "Insufficient gas"
  }
]
```

---

## 3. SQL 脚本

### 3.1 创建表

```sql
-- 分账记录表
CREATE TABLE IF NOT EXISTS split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address VARCHAR(42) NOT NULL,
  total_amount DECIMAL(36, 18) NOT NULL,
  token VARCHAR(20) NOT NULL DEFAULT 'USDC',
  chain_id INTEGER NOT NULL DEFAULT 8453,
  split_mode VARCHAR(20) NOT NULL DEFAULT 'percentage',
  rule JSONB NOT NULL,
  calculation JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  results JSONB,
  error_message TEXT,
  template_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_split_status CHECK (
    status IN ('pending', 'executing', 'completed', 'partial', 'failed', 'cancelled')
  ),
  CONSTRAINT valid_split_mode CHECK (
    split_mode IN ('percentage', 'fixed', 'hybrid')
  )
);

-- 分账模板表
CREATE TABLE IF NOT EXISTS split_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rule JSONB NOT NULL,
  usage_count INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_template_name UNIQUE (owner_address, name)
);

-- 外键约束
ALTER TABLE split_payments
  ADD CONSTRAINT fk_split_payments_template
  FOREIGN KEY (template_id) REFERENCES split_templates(id)
  ON DELETE SET NULL;
```

### 3.2 创建索引

```sql
-- split_payments 索引
CREATE INDEX IF NOT EXISTS idx_split_payments_creator
  ON split_payments(creator_address);

CREATE INDEX IF NOT EXISTS idx_split_payments_status
  ON split_payments(status);

CREATE INDEX IF NOT EXISTS idx_split_payments_created
  ON split_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_split_payments_creator_status
  ON split_payments(creator_address, status);

-- split_templates 索引
CREATE INDEX IF NOT EXISTS idx_split_templates_owner
  ON split_templates(owner_address);

-- JSONB 索引（用于查询特定收款人）
CREATE INDEX IF NOT EXISTS idx_split_payments_rule_items
  ON split_payments USING GIN ((rule->'items'));
```

### 3.3 RLS 策略

```sql
-- 启用 RLS
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_templates ENABLE ROW LEVEL SECURITY;

-- split_payments 策略
CREATE POLICY "Users can view own split payments"
  ON split_payments FOR SELECT
  USING (
    creator_address = LOWER(current_setting('app.user_address', true))
  );

CREATE POLICY "Users can create split payments"
  ON split_payments FOR INSERT
  WITH CHECK (
    creator_address = LOWER(current_setting('app.user_address', true))
  );

CREATE POLICY "Users can update own pending split payments"
  ON split_payments FOR UPDATE
  USING (
    creator_address = LOWER(current_setting('app.user_address', true))
  );

-- split_templates 策略
CREATE POLICY "Users can manage own templates"
  ON split_templates FOR ALL
  USING (
    owner_address = LOWER(current_setting('app.user_address', true))
  );
```

### 3.4 触发器

```sql
-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_split_templates_updated_at
  BEFORE UPDATE ON split_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 更新模板使用次数
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_split_payment_template_usage
  AFTER INSERT ON split_payments
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage();
```

---

## 4. 查询示例

### 4.1 常用查询

```sql
-- 获取用户的分账历史
SELECT
  id,
  total_amount,
  token,
  split_mode,
  status,
  jsonb_array_length(rule->'items') as recipient_count,
  created_at,
  executed_at
FROM split_payments
WHERE creator_address = '0x123...'
ORDER BY created_at DESC
LIMIT 20;

-- 获取待执行的分账
SELECT *
FROM split_payments
WHERE creator_address = '0x123...'
  AND status = 'pending'
ORDER BY created_at DESC;

-- 统计分账数据
SELECT
  COUNT(*) as total_splits,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_paid
FROM split_payments
WHERE creator_address = '0x123...'
  AND created_at > NOW() - INTERVAL '30 days';

-- 查找包含特定收款人的分账
SELECT *
FROM split_payments
WHERE rule->'items' @> '[{"address": "0x456..."}]';
```

### 4.2 模板查询

```sql
-- 获取用户的所有模板
SELECT
  id,
  name,
  description,
  jsonb_array_length(rule->'items') as recipient_count,
  usage_count,
  updated_at
FROM split_templates
WHERE owner_address = '0x123...'
ORDER BY usage_count DESC, updated_at DESC;

-- 获取最常用的模板
SELECT *
FROM split_templates
WHERE owner_address = '0x123...'
ORDER BY usage_count DESC
LIMIT 5;
```

---

## 5. 数据迁移

### 5.1 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2025-01-30 | 初始创建 |

### 5.2 迁移脚本位置

```
scripts/migrations/
└── 2025-01-30_create_split_payment_tables.sql
```

---

## 6. 备份与恢复

### 6.1 重要字段备份

- `rule` - 分账规则（业务核心）
- `results` - 执行结果（财务记录）

### 6.2 数据保留策略

| 数据类型 | 保留期限 |
|---------|---------|
| 已完成分账 | 永久 |
| 失败/取消分账 | 1 年 |
| 模板 | 永久（除非用户删除） |

---

**最后更新**: 2025-01-30
