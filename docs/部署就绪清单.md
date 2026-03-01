# 🚀 多网络支持 - 部署就绪清单

**创建日期：** 2026-02-07
**状态：** ✅ 代码就绪 | ⏳ 等待数据库迁移

---

## 📋 部署前检查清单

### ✅ 已完成项目

- [x] **代码开发完成**
  - [x] 8个 API 路由文件
  - [x] 5个 UI 组件
  - [x] 数据库 Schema 更新
  - [x] 迁移脚本准备

- [x] **测试验证通过**
  - [x] 34个网络配置测试 ✅
  - [x] 16个集成测试 ✅
  - [x] 100% 测试通过率
  - [x] 50+ API 测试用例准备就绪

- [x] **文档编写完成**
  - [x] 实施完成报告
  - [x] 快速开始指南
  - [x] 故障排查指南
  - [x] API 参考文档
  - [x] 测试指南
  - [x] 迁移指南

- [x] **辅助工具准备**
  - [x] 迁移脚本（Windows + Linux）
  - [x] API 测试文件
  - [x] 项目记忆文档

---

## 🔧 部署步骤

### 步骤 1: 环境准备 ⏳

**任务清单：**

```bash
# 1.1 检查 Node.js 版本
node --version
# 要求：v18.0.0 或更高

# 1.2 检查 pnpm 版本
pnpm --version
# 要求：v8.0.0 或更高

# 1.3 检查 PostgreSQL 版本
psql --version
# 推荐：PostgreSQL 15+
```

**验证标准：**
- [ ] Node.js ≥ 18.0.0
- [ ] pnpm ≥ 8.0.0
- [ ] PostgreSQL ≥ 14.0

---

### 步骤 2: 启动数据库 ⏳

**选项 A - Docker：**
```bash
# 启动容器
docker start <postgres-container-name>

# 验证运行
docker ps | findstr postgres
```

**选项 B - 本地服务：**
```bash
# Windows
net start postgresql-x64-15

# 验证连接
psql -h localhost -p 51214 -U postgres -c "SELECT version();"
```

**验证标准：**
- [ ] PostgreSQL 服务运行中
- [ ] 端口 51214 监听
- [ ] 可以成功连接数据库

**检查命令：**
```bash
# 检查端口
netstat -an | findstr :51214

# 测试连接
psql -h localhost -p 51214 -U postgres -c "SELECT 1;"
```

---

### 步骤 3: 数据库备份（重要！）⏳

**在迁移前务必备份：**

```bash
# 方法 1: pg_dump
pg_dump -h localhost -p 51214 -U postgres -d template1 > backup_before_migration.sql

# 方法 2: 使用 Prisma
pnpm prisma db pull
# 会生成当前 schema 的快照
```

**验证标准：**
- [ ] 备份文件已创建
- [ ] 备份文件大小 > 0
- [ ] 记录备份位置和时间

---

### 步骤 4: 执行数据库迁移 ⏳

**方法 1 - 自动化脚本（推荐）：**

```bash
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"

# Windows
scripts\run-migration.bat

# 脚本会自动执行：
# ✓ 检查数据库连接
# ✓ 推送 Prisma schema
# ✓ 生成 Prisma client
# ✓ 应用 SQL 迁移（如果安装了 psql）
```

**方法 2 - 手动分步执行：**

```bash
# 4.1 推送 schema
pnpm prisma db push
# 预期输出：
# ✓ VendorAddress 表已创建
# ✓ payments 表已更新
# ✓ batch_payments 表已更新

# 4.2 生成 client（已完成，再次确认）
pnpm prisma generate

# 4.3 应用高级 SQL 功能（可选但推荐）
psql -h localhost -p 51214 -U postgres -d template1 -f scripts\009_multi_network_support.sql
# 预期输出：
# ✓ 创建视图
# ✓ 创建函数
# ✓ 创建触发器
# ✓ 应用 RLS 策略
```

**验证标准：**
- [ ] Prisma schema 推送成功
- [ ] 无错误消息
- [ ] vendor_addresses 表已创建
- [ ] 新字段已添加到 payments 表

---

### 步骤 5: 验证迁移结果 ⏳

**5.1 使用 Prisma Studio 验证：**

```bash
pnpm prisma studio
```

**检查项：**
- [ ] `vendor_addresses` 表存在
- [ ] `vendors` 表的 `wallet_address` 字段仍然存在
- [ ] `payments` 表有新字段：
  - [ ] `network_type` (String, default: "EVM")
  - [ ] `chain_id` (Int, nullable)
  - [ ] `energy_used` (BigInt, nullable)
  - [ ] `bandwidth_used` (BigInt, nullable)
  - [ ] `gas_used` (BigInt, nullable)
  - [ ] `gas_price` (BigInt, nullable)
  - [ ] `confirmations` (Int, default: 0)
  - [ ] `block_number` (BigInt, nullable)
- [ ] `batch_payments` 表有新字段：
  - [ ] `chain` (String)
  - [ ] `network_type` (String)

**5.2 使用 SQL 验证：**

```sql
-- 检查表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('vendor_addresses', 'vendors', 'payments', 'batch_payments');

-- 检查 vendor_addresses 结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vendor_addresses'
ORDER BY ordinal_position;

-- 检查唯一约束
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'vendor_addresses';

-- 检查视图（如果运行了 SQL 迁移）
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('vendor_all_addresses', 'payment_stats_by_network', 'network_distribution_summary');

-- 检查函数
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%vendor%' OR routine_name LIKE '%network%';

-- 检查触发器
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

**验证标准：**
- [ ] 所有表都存在
- [ ] 所有字段都已添加
- [ ] 唯一约束已创建
- [ ] 索引已创建
- [ ] 视图已创建（如果运行了 SQL）
- [ ] 函数已创建（如果运行了 SQL）
- [ ] 触发器已创建（如果运行了 SQL）

**5.3 检查数据迁移：**

```sql
-- 检查是否有供应商地址被迁移
SELECT v.name, va.network, va.address, va.is_primary
FROM vendors v
LEFT JOIN vendor_addresses va ON v.id = va.vendor_id
ORDER BY v.name, va.is_primary DESC;

-- 检查支付记录的网络类型
SELECT network_type, COUNT(*) as count
FROM payments
GROUP BY network_type;

-- 应该看到：
-- EVM: X条
-- TRON: 0条（如果没有 TRON 数据）
```

**验证标准：**
- [ ] 现有供应商都有至少一个地址
- [ ] 地址的网络字段正确（ethereum, tron, etc.）
- [ ] 主地址标志正确
- [ ] 支付记录的 network_type 已设置

---

### 步骤 6: 启动开发服务器 ⏳

```bash
# 启动服务器
pnpm dev

# 预期输出：
# ▲ Next.js 15.x.x
# - Local:        http://localhost:3000
# - Ready in XXXms
```

**验证标准：**
- [ ] 服务器启动无错误
- [ ] 可以访问 http://localhost:3000
- [ ] 控制台无 Prisma 错误

---

### 步骤 7: API 功能测试 ⏳

**7.1 测试供应商创建（基础功能）：**

```bash
curl -X POST http://localhost:3000/api/vendors/multi-network ^
  -H "Content-Type: application/json" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" ^
  -d "{\"name\":\"测试供应商\",\"addresses\":[{\"network\":\"ethereum\",\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2\",\"isPrimary\":true}]}"
```

**预期结果：**
```json
{
  "vendor": {
    "id": "...",
    "name": "测试供应商",
    "addresses": [...]
  },
  "message": "Vendor created successfully"
}
```

**验证标准：**
- [ ] 返回 201 状态码
- [ ] 响应包含 vendor 对象
- [ ] vendor 有 addresses 数组
- [ ] 地址正确保存

**7.2 测试地址自动检测（TRON）：**

```bash
curl -X POST http://localhost:3000/api/payments ^
  -H "Content-Type: application/json" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" ^
  -d "{\"from_address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2\",\"to_address\":\"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE\",\"amount\":\"100\",\"token\":\"USDT\",\"token_symbol\":\"USDT\",\"type\":\"sent\"}"
```

**验证标准：**
- [ ] 返回 200 状态码
- [ ] `network_type` 自动设置为 "TRON"
- [ ] `chain` 自动设置为 "tron"
- [ ] `chain_id` 为 null

**7.3 测试网络筛选：**

```bash
# 筛选 TRON 支付
curl "http://localhost:3000/api/payments?network=tron&limit=10" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"

# 筛选所有 EVM 支付
curl "http://localhost:3000/api/payments?network_type=EVM&limit=10" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

**验证标准：**
- [ ] 筛选结果正确
- [ ] 分页参数生效
- [ ] 返回总数正确

**7.4 测试统计接口：**

```bash
curl http://localhost:3000/api/payments/stats ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

**验证标准：**
- [ ] 返回 summary 对象
- [ ] 包含 byNetwork 数组
- [ ] 包含 byNetworkType 数组
- [ ] 数据聚合正确

**更多测试用例：** 参见 [docs/快速开始指南.md](docs/快速开始指南.md)

---

### 步骤 8: 运行自动化测试 ⏳

```bash
# 8.1 运行单元测试（应该已经通过）
pnpm test lib/__tests__/

# 8.2 运行 API 测试（需要数据库和服务器）
pnpm test tests/api/multi-network.test.ts

# 8.3 运行所有测试
pnpm test
```

**验证标准：**
- [ ] 所有单元测试通过
- [ ] 所有 API 测试通过
- [ ] 无跳过的测试
- [ ] 测试覆盖率 > 80%

---

### 步骤 9: UI 组件集成测试 ⏳

**9.1 测试 VendorAddressManager：**

1. 导航到供应商编辑页面
2. 点击"添加地址"
3. 输入 TRON 地址：`TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`
4. 观察网络是否自动选择为 "TRON"
5. 保存并验证地址出现在列表中

**验证标准：**
- [ ] 组件正常渲染
- [ ] 对话框打开/关闭正常
- [ ] 网络自动检测工作
- [ ] 地址保存成功
- [ ] 列表实时更新

**9.2 测试 TransactionList：**

1. 导航到交易历史页面
2. 使用网络筛选器选择 "TRON"
3. 验证只显示 TRON 交易
4. 检查是否显示"能量消耗"字段

**验证标准：**
- [ ] 筛选功能工作
- [ ] 网络特定字段正确显示
- [ ] 分页功能正常
- [ ] 区块浏览器链接可用

**完整 UI 测试清单：** 参见 [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)

---

### 步骤 10: 性能验证 ⏳

**10.1 基准测试：**

```bash
# 使用 curl 测试响应时间
time curl http://localhost:3000/api/vendors/multi-network \
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"

# 测试大量数据的列表
time curl "http://localhost:3000/api/payments?limit=1000" \
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

**性能标准：**
- [ ] 供应商列表（100条）< 200ms
- [ ] 支付列表（1000条）< 500ms
- [ ] 统计聚合 < 1s
- [ ] 地址验证 < 10ms

**10.2 数据库查询优化：**

```sql
-- 检查查询计划
EXPLAIN ANALYZE
SELECT * FROM payments
WHERE network_type = 'TRON'
ORDER BY created_at DESC
LIMIT 50;

-- 检查索引使用
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('payments', 'vendor_addresses', 'batch_payments')
ORDER BY idx_scan DESC;
```

**验证标准：**
- [ ] 使用了正确的索引
- [ ] 查询时间在可接受范围
- [ ] 无全表扫描

---

## ✅ 最终验收标准

### 功能验收

- [ ] **多网络供应商管理**
  - [ ] 创建带多个地址的供应商
  - [ ] 添加/编辑/删除地址
  - [ ] 设置主地址
  - [ ] 地址自动验证

- [ ] **支付网络支持**
  - [ ] 创建 TRON 支付
  - [ ] 创建 EVM 支付
  - [ ] 按网络筛选
  - [ ] 网络特定字段显示

- [ ] **批量支付**
  - [ ] 创建多网络批量支付
  - [ ] 网络自动检测
  - [ ] 批量统计

- [ ] **统计分析**
  - [ ] 按网络聚合
  - [ ] 按网络类型聚合
  - [ ] 时间范围筛选

### 技术验收

- [ ] **代码质量**
  - [ ] 所有测试通过（50+）
  - [ ] 无 TypeScript 错误
  - [ ] 无 ESLint 警告
  - [ ] 代码格式化正确

- [ ] **数据库**
  - [ ] Schema 正确应用
  - [ ] 索引已创建
  - [ ] RLS 策略生效
  - [ ] 数据迁移成功

- [ ] **安全性**
  - [ ] 认证检查生效
  - [ ] 授权控制正确
  - [ ] 输入验证工作
  - [ ] XSS/SQL 注入防护

- [ ] **性能**
  - [ ] 响应时间达标
  - [ ] 数据库查询优化
  - [ ] 内存使用正常
  - [ ] 无内存泄漏

### 文档验收

- [ ] **用户文档**
  - [ ] 快速开始指南完整
  - [ ] API 参考文档准确
  - [ ] 测试指南详细
  - [ ] 故障排查指南实用

- [ ] **技术文档**
  - [ ] 架构设计文档
  - [ ] 数据库 Schema 文档
  - [ ] 迁移指南详细
  - [ ] 代码注释完整

---

## 🎊 部署完成标志

当以上所有检查项都完成后，您可以宣布：

**✅ 多网络支持功能已成功部署并投入生产使用！**

---

## 📞 支持和反馈

**遇到问题？**
1. 查看 [故障排查指南.md](docs/故障排查指南.md)
2. 检查测试日志
3. 查看服务器控制台输出

**需要帮助？**
- 参考完整文档：`docs/` 目录
- 查看测试用例：`tests/` 目录
- 阅读代码注释：API 路由和组件

---

**创建日期：** 2026-02-07
**版本：** 1.0.0
**状态：** 等待部署

---

## 📝 部署记录

**执行人：** _______________
**日期：** _______________
**数据库备份位置：** _______________
**部署环境：** [ ] 开发 [ ] 测试 [ ] 生产
**部署结果：** [ ] 成功 [ ] 失败
**备注：** _______________

---

**祝部署顺利！** 🚀
