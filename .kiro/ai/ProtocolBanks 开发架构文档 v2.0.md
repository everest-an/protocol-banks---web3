这份 **ProtocolBanks 开发架构文档 (Development Architecture Document \- DAD)** 是基于你目前的技术栈（**TypeScript \+ Prisma \+ Vercel**）和性能需求（**Go 核心引擎**）量身定制的。

它解决了“Serverless 前端如何与高性能 Go 后端协同工作”的核心问题，适合三人团队快速落地。

# ---

**ProtocolBanks 开发架构文档 (v2.0)**

**核心理念：** **"TypeScript 定义业务，Go 执行任务，Prisma 管理数据。"**

## **1\. 系统拓扑架构 (System Topology)**

我们采用 **异步解耦** 的混合架构。Vercel 处理所有用户交互（高并发读取），Go 处理资金与耗时任务（高可靠写入）。

* **接入层 (Vercel):** Next.js (App Router)。负责 UI 渲染、Auth 鉴权、数据读取、API 聚合。  
* **任务层 (Redis):** 作为 TS 和 Go 之间的缓冲带。  
* **执行层 (Go Worker):** 部署在 Railway/Render/AWS 上的常驻进程。负责监听 Redis、批量转账、链上交互。  
* **数据层 (Postgres):** 使用 Neon 或 Supabase（支持连接池），由 Prisma 统一管理结构。

## ---

**2\. 数据库设计 (Prisma Schema \- The Source of Truth)**

**策略：** 所有数据库变更 **必须** 通过 schema.prisma 进行。Go 端不直接修改表结构，只负责读写。

### **schema.prisma 定义**

Code snippet

// 1\. 配置  
generator client {  
  provider \= "prisma-client-js"  
}

datasource db {  
  provider  \= "postgresql"  
  url       \= env("DATABASE\_URL")       // 连接池地址 (Transaction Mode)  
  directUrl \= env("DIRECT\_URL")         // 直连地址 (Migration Mode)  
}

// 2\. 模型定义

// 企业账户 (租户)  
model Organization {  
  id            String   @id @default(uuid())  
  name          String  
  walletAddress String   @unique @map("wallet\_address") // AA 合约地址  
  createdAt     DateTime @default(now())  
    
  employees     Employee\[\]  
  payoutBatches PayoutBatch\[\]  
  sessionKeys   SessionKey\[\]

  @@map("organizations")  
}

// 员工/收款人  
model Employee {  
  id             String   @id @default(uuid())  
  orgId          String   @map("org\_id")  
  name           String  
  walletAddress  String   @map("wallet\_address")  
  paymentConfig  Json     // 核心: 自动分流配置 {"usdt": 80, "fiat": 20}  
    
  organization   Organization @relation(fields: \[orgId\], references: \[id\])  
  payoutItems    PayoutItem\[\]

  @@map("employees")  
}

// 批量支付任务 (主单)  
model PayoutBatch {  
  id          String   @id @default(uuid())  
  orgId       String   @map("org\_id")  
  totalAmount Decimal  @db.Decimal(20, 8\)  
  tokenSymbol String   @map("token\_symbol") // e.g., "USDC"  
  status      String   // PENDING, PROCESSING, COMPLETED, FAILED  
  txHash      String?  @map("tx\_hash")      // 链上批量交易 Hash  
    
  items       PayoutItem\[\]  
  organization Organization @relation(fields: \[orgId\], references: \[id\])

  @@map("payout\_batches")  
}

// 支付明细 (子单)  
model PayoutItem {  
  id          String   @id @default(uuid())  
  batchId     String   @map("batch\_id")  
  employeeId  String   @map("employee\_id")  
  amount      Decimal  @db.Decimal(20, 8\)  
  status      String   // PENDING, SUCCESS, FAILED  
    
  batch       PayoutBatch @relation(fields: \[batchId\], references: \[id\])  
  employee    Employee    @relation(fields: \[employeeId\], references: \[id\])

  @@map("payout\_items")  
}

// AI 计费会话密钥  
model SessionKey {  
  id           String   @id @default(uuid())  
  orgId        String   @map("org\_id")  
  publicKey    String   @unique @map("public\_key")  
  limitAmount  Decimal  @db.Decimal(20, 8\) // 总限额  
  currentUsage Decimal  @db.Decimal(20, 8\) @default(0) // 当前已用  
  expiresAt    DateTime  
  isFrozen     Boolean  @default(false)    // 风控状态

  organization Organization @relation(fields: \[orgId\], references: \[id\])

  @@map("session\_keys")  
}

## ---

**3\. Go 与 Prisma 的协同开发流**

因为 Go 不能直接用 Prisma Client，我们使用 **SQLC** 来弥补这一环。

### **工作流 (Workflow)**

1. **TypeScript 端：** 修改 schema.prisma $\\rightarrow$ 运行 npx prisma migrate dev (数据库表结构更新)。  
2. **Go 端：** 运行 sqlc generate。  
   * sqlc 会读取数据库 Schema，自动生成**强类型**的 Go 结构体和 CRUD 代码。  
   * **优势：** 你不需要手写 SQL 映射，Go 代码也是类型安全的。

### **目录结构建议**

/protocolbanks-monorepo  
├── /apps  
│   ├── /web (Next.js)      \# 前端 \+ API Routes (使用 Prisma Client)  
│   └── /worker (Go)        \# 后端引擎 (使用 pgx \+ sqlc)  
├── /packages  
│   └── /database           \# 存放 schema.prisma 和 migration  
└── /docker-compose.yml     \# 本地开发环境 (Postgres \+ Redis)

## ---

**4\. 核心功能实现逻辑**

### **4.1 批量支付 (Payroll) \- 异步队列模式**

**前端 (Next.js/TS):**

1. 用户上传 Excel。  
2. Next.js 解析 Excel，使用 Prisma 在 DB 中创建 PayoutBatch 和 PayoutItem (状态: PENDING)。  
3. Next.js 将 batchId 推送至 **Redis Queue** (Channel: payout\_jobs)。  
4. 立即返回 UI：“任务已提交，正在处理”。

**后端 (Go Worker):**

1. **监听：** 从 Redis payout\_jobs 获取 batchId。  
2. **锁定：** 使用 Redis SETNX 锁住该 Batch，防止重复处理。  
3. **查询：** 使用 sqlc 生成的代码从 DB 读取该 Batch 的所有 Items。  
4. **执行 (ZetaChain):**  
   * 调用 ZetaChain 的 MultiSend 合约。  
   * 如果 Items 数量 \> 200，Go 自动拆分为多个子交易 (Sub-tx)。  
   * **关键：** 维护本地 Nonce，确保高并发下顺序广播。  
5. **更新：** 交易广播成功后，更新 DB 状态为 PROCESSING 并填入 txHash。  
6. **收尾：** 监听链上回执 (Receipt)。确认成功后，状态改为 COMPLETED，并触发 PDF 生成。

### **4.2 AI 计费 (Billing) \- 状态通道模式**

**前端 SDK (TS):**

1. 用户签名生成 Session Key。  
2. Next.js 使用 Prisma 写入 SessionKey 表。

**后端 (Go API/Gateway):**

1. **拦截：** 接收 AI Agent 的 API 请求。  
2. **验证：**  
   * 从 Redis 读取 Session Key 缓存（高性能）。  
   * 校验签名 \+ 检查 currentUsage \< limitAmount。  
   * 检查 isFrozen (风控状态)。  
3. **计费 (Off-chain):**  
   * 在 Redis 中原子增加 INCRBY session:usage:{key} 0.01。  
   * **不立即写库！**  
4. **同步 (Sync Worker):**  
   * Go 启动一个定时任务 (Ticker)，每 1 分钟将 Redis 里的使用量批量更新到 Postgres DB。  
   * 如果余额耗尽，触发链上结算逻辑。

## ---

**5\. 基础设施与部署 (Infrastructure)**

### **Vercel (Frontend & API)**

* **配置：** 确保连接 Vercel Postgres 时使用了 **Connection Pooling** (连接字符串通常以 pgbouncer=true 结尾)。  
* **Env:** DATABASE\_URL (Pool), DIRECT\_URL (Direct for migrations).

### **Railway / Render (Go Worker)**

* Go 只需要一个简单的 Docker 容器。  
* **资源：** 0.5 CPU / 512MB RAM 足够处理每分钟数千笔交易。

### **Redis (Upstash / Railway)**

* 用于任务队列和 Session Key 的热缓存。

## ---

**6\. 你的下一步 (Action Items)**

1. **初始化仓库：** 建立 Monorepo，放入 Next.js 和 Go 两个文件夹。  
2. **配置 Prisma：** 复制上面的 schema.prisma，连接 Vercel Postgres，运行 npx prisma db push。  
3. **写第一个 Go Worker：**  
   * 连接 Redis。  
   * 实现“读取 Redis 消息 \-\> 打印日志”的 MVP 逻辑。  
4. **写第一个 Next.js API：**  
   * 接收 JSON \-\> Prisma 写库 \-\> Redis 推送消息。

这套文档可以直接发给你的开发伙伴（或你自己执行）。它规避了 Vercel 连接数耗尽的坑，同时利用了 Go 处理资金流的优势。