# 多网络支�?- 快速开始指�?

## 🎯 5分钟快速上�?

### 前置条件检�?

```bash
# 1. 检�?Node.js 版本（需�?18+�?
node --version

# 2. 检�?pnpm 是否安装
pnpm --version

# 3. 检�?PostgreSQL 是否运行
# Windows: 检查任务管理器中的 postgres.exe
# 或运行：
netstat -an | findstr :51214
```

---

## 第一步：启动数据�?

### 选项 A：如果使�?Docker

```bash
# 启动 PostgreSQL 容器
docker start <your-postgres-container-name>

# 验证数据库运�?
docker ps | findstr postgres
```

### 选项 B：如果使用本�?PostgreSQL

```bash
# Windows
pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"

# 验证
psql -h localhost -p 51214 -U postgres -c "SELECT version();"
```

---

## 第二步：执行数据库迁�?

### 方法 1：使用自动化脚本（推荐）

```bash
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"

# Windows
scripts\run-migration.bat

# 脚本会自动：
# 1. 检查数据库连接
# 2. 推�?Prisma schema
# 3. 生成 Prisma client
# 4. 应用 SQL 迁移（如果安装了 psql�?
```

### 方法 2：手动分步执�?

```bash
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"

# 1. 推�?schema 到数据库
pnpm prisma db push

# 2. 验证表是否创�?
pnpm prisma studio
# 打开浏览器，检查是否有 vendor_addresses �?

# 3. （可选）应用高级 SQL 功能
# 如果安装�?psql�?
psql -h localhost -p 51214 -U postgres -d template1 -f scripts\009_multi_network_support.sql
```

---

## 第三步：验证迁移成功

### 使用 Prisma Studio

```bash
pnpm prisma studio
```

在浏览器中验证：
- �?`vendor_addresses` 表已创建
- �?`payments` 表有新字段：`network_type`, `chain_id`, `energy_used` �?
- �?`batch_payments` 表有新字段：`chain`, `network_type`

### 使用 SQL 查询

```sql
-- 检查表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'vendor_addresses';

-- 检查新字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('network_type', 'chain_id', 'energy_used');

-- 检查视图（如果运行�?SQL 迁移�?
SELECT table_name
FROM information_schema.views
WHERE table_name LIKE 'vendor_%' OR table_name LIKE '%network%';
```

---

## 第四步：启动开发服务器

```bash
# 启动 Next.js 开发服务器
pnpm dev

# 服务器启动后会显示：
# �?Next.js 15.x.x
# - Local:        http://localhost:3000
# - Ready in XXXms
```

---

## 第五步：测试 API�?个基础测试�?

### 测试 1：创建多网络供应�?

```bash
curl -X POST http://localhost:3000/api/vendors/multi-network ^
  -H "Content-Type: application/json" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" ^
  -d "{\"name\":\"测试供应商\",\"addresses\":[{\"network\":\"ethereum\",\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2\",\"isPrimary\":true},{\"network\":\"tron\",\"address\":\"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE\",\"isPrimary\":true}]}"
```

**预期结果�?*
```json
{
  "vendor": {
    "id": "...",
    "name": "测试供应�?,
    "addresses": [
      { "network": "ethereum", "address": "0x742d...", "isPrimary": true },
      { "network": "tron", "address": "TQn9...", "isPrimary": true }
    ]
  },
  "message": "Vendor created successfully"
}
```

### 测试 2：列出所有供应商

```bash
curl http://localhost:3000/api/vendors/multi-network ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

### 测试 3：创�?TRON 支付（自动检测网络）

```bash
curl -X POST http://localhost:3000/api/payments ^
  -H "Content-Type: application/json" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" ^
  -d "{\"from_address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2\",\"to_address\":\"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE\",\"amount\":\"100\",\"token\":\"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\",\"token_symbol\":\"USDT\",\"type\":\"sent\"}"
```

**预期结果�?*
```json
{
  "payment": {
    "network_type": "TRON",  // �?自动检�?
    "chain": "tron",         // �?自动设置
    "chain_id": null
  }
}
```

### 测试 4：按网络筛选支�?

```bash
# 获取所�?TRON 支付
curl "http://localhost:3000/api/payments?network=tron&limit=10" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"

# 获取所�?EVM 支付
curl "http://localhost:3000/api/payments?network_type=EVM&limit=10" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

### 测试 5：获取支付统�?

```bash
# 总体统计
curl http://localhost:3000/api/payments/stats ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"

# TRON 统计
curl "http://localhost:3000/api/payments/stats?network_type=TRON" ^
  -H "x-wallet-address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
```

---

## 第六步：�?UI 中使用组�?

### 在供应商编辑页面中使用地址管理�?

```tsx
// app/(products)/vendors/[id]/edit/page.tsx
import { VendorAddressManager } from "@/components/vendors/vendor-address-manager"

export default function VendorEditPage({ params }: { params: { id: string } }) {
  const { data: vendor } = useVendor(params.id)
  const { address: userAddress } = useWallet()

  return (
    <div>
      <h1>编辑供应�?/h1>

      {/* 多网络地址管理 */}
      <VendorAddressManager
        vendorId={params.id}
        addresses={vendor?.addresses || []}
        onUpdate={() => refetch()}
        userAddress={userAddress}
      />
    </div>
  )
}
```

### 在交易历史页面中使用交易列表

```tsx
// app/(products)/history/page.tsx
import { TransactionList } from "@/components/transactions/transaction-list"

export default function HistoryPage() {
  const { address } = useWallet()

  return (
    <div>
      <h1>交易历史</h1>

      {/* 带网络筛选的交易列表 */}
      <TransactionList
        userAddress={address}
        initialFilters={{
          network_type: "all"  // �?"EVM" | "TRON"
        }}
      />
    </div>
  )
}
```

---

## 常见问题排查

### �?问题：无法连接数据库

**错误信息�?*
```
Error: P1001
Can't reach database server at localhost:51214
```

**解决方案�?*
1. 检�?PostgreSQL 是否运行�?
   ```bash
   # Windows
   tasklist | findstr postgres

   # 或检查端�?
   netstat -an | findstr :51214
   ```

2. 检�?`.env` 文件中的 `DATABASE_URL`

3. 尝试手动连接�?
   ```bash
   psql -h localhost -p 51214 -U postgres
   ```

### �?问题：Prisma client 版本不匹�?

**错误信息�?*
```
PrismaClientInitializationError: Prisma Client could not locate...
```

**解决方案�?*
```bash
# 重新生成 Prisma client
pnpm prisma generate

# 清除缓存
rm -rf node_modules/.prisma
pnpm install
```

### �?问题：API 返回 401 Unauthorized

**原因�?* 缺少认证�?

**解决方案�?*
确保所�?API 请求都包�?`x-wallet-address` header�?
```bash
curl ... -H "x-wallet-address: YOUR_WALLET_ADDRESS"
```

### �?问题：地址验证失败

**错误信息�?*
```json
{ "error": "Invalid address: ..." }
```

**解决方案�?*
1. 检查地址格式�?
   - EVM: `0x` 开头，42 字符
   - TRON: `T` 开头，34 字符

2. 确保地址是有效的校验和格式（EVM�?

---

## 下一�?

完成基础测试后，您可以：

1. **集成到现有页�?*
   - 在供应商管理页面添加多网络支�?
   - 在交易历史页面添加网络筛�?

2. **运行完整测试套件**
   ```bash
   pnpm test
   ```

3. **查看详细文档**
   - [完整 API 参考](./MULTI_NETWORK_IMPLEMENTATION.md)
   - [测试指南](./TESTING_GUIDE.md)

4. **监控和优�?*
   - 使用 Prisma Studio 查看数据
   - 检�?API 响应时间
   - 优化数据库查�?

---

## 🎉 完成�?

恭喜！您已经成功设置了多网络支持。现在可以：
- �?管理多网络供应商地址
- �?创建和筛选多网络支付
- �?查看按网络分类的统计数据
- �?使用 UI 组件进行地址管理

**有问题？** 查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 获取更多帮助�?
