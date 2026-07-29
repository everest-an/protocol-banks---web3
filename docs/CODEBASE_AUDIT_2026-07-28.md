# Protocol Banks 代码库审计报告（2026-07-28）

> 审计方式：clean clone → pnpm install → prisma generate → jest 全量 → next build 实测，
> 外加三路静态分析（架构 / 死代码 / 功能端到端追踪）。本报告未修改任何源码。

---

## 0. TL;DR

| 维度 | 结论 |
|---|---|
| 单元测试 | ✅ 47 suites / 950 tests 全部通过（88s） |
| 生产构建 | ❌ **`next build` 失败** — `@scure/bip39` 是幽灵依赖（代码引用但未在 package.json 声明） |
| npm install | ❌ 严格模式装不上 — `hardhat@3.x` 与 `@nomicfoundation/hardhat-toolbox@6.x`（要求 hardhat 2.x）peer 冲突；只有 pnpm 能装 |
| CI | ❌ 不存在（`.github/workflows` 无） |
| README 宣称的 10 大功能 | ✅ 3 项完整（SIWE+JWT / A2A / ERC-8004 Agent Card）· ⚠️ 5 项半通 · ❌ 2 项空壳（多签、$PUSD） |
| 安全 | 🔴 P0：`withAuth` 可被 `x-wallet-address` 请求头完全旁路，任何人可冒充任意用户 |
| 死代码 | ~7,000+ 行可直接删除；4 个 admin 页面纯 localStorage 无后端；~30 个 API 路由无任何调用方 |

---

## 1. 实测验证结果

1. **依赖安装**：`npm install` 失败（ERESOLVE：hardhat-toolbox@6 要求 hardhat ^2.28.0，项目声明 hardhat ^3.1.7）。`pnpm install` 成功（4m42s），但 pnpm v10 默认拦截了 prisma/esbuild/sharp 等 12 个 build script，需 `pnpm approve-builds`。
2. **单元测试**：`jest --ci --runInBand` → 47 suites / 950 tests 全绿。但注意测试大量 mock Prisma，且有 3 组测试在维护死代码（见 §4.5）。
3. **生产构建**：`next build` **失败**：
   - Type error: `Cannot find module '@scure/bip39'` @ `app/api/auth/setup-pin/route.ts:16`（幽灵依赖，靠 viem 的传递依赖偶然解析，pnpm 严格模式下类型声明不可达）
   - 另有 warning：`pg-native` 解析失败（pg 被打进客户端 bundle：`lib/prisma.ts → lib/protocol-fees.ts → app/fees/page.tsx` 引用链，服务端代码泄漏到客户端）
4. **幽灵依赖全表**：`@scure/bip39`（真实引用，破坏构建）、`@grpc/proto-loader`（`lib/services/go-services-bridge.ts:7` 真实引用）、`@protocolbanks/sdk`（仅出现在 embed 页示例字符串中——同时说明该 SDK 从未被主应用使用）。
5. **`pnpm worker:parser` 必然失败**：指向不存在的 `backend/worker-parser.ts`；`tsconfig.json` 的 `@/backend/*` 别名同样指向不存在的目录。

---

## 2. 功能端到端完整度（README 宣称 vs 实际）

| # | 功能 | 判定 | 关键依据 |
|---|---|---|---|
| 1 | 批量支付 | ⚠️ | 三套互不连通的实现。UI 走"逐笔转账"（真）或 Disperse 合约（真但 **硬编码 Arbitrum**，无视用户选链，且给每个收款人伪造 `${txHash}-${index}` 假哈希写库）。最完整的后端引擎 `/api/batch-payment/execute` **前端从不调用**；`/api/batch/execute` 是注释明说的 demo 空壳 |
| 2 | 多签审批 | ❌ | 无任何 API 路由；UI 直连 `lib/multisig.ts`，浏览器端 prisma 恒为 null 必抛错；裸 SQL 列名与 schema 完全不符（`multisig_signers` 表根本不存在）；Safe 地址用 `keccak256("0x")` 占位推导=垃圾地址。写得正确的 `lib/services/multisig-service.ts`（445 行）只被自己的测试引用 |
| 3 | 订阅管理 | ⚠️ | CRUD 全通。执行链路双断裂：Pay Now 打 CRON 端点必 401；底层 `payout-bridge.ts` 的 INSERT 列与 `batch_payments` 表结构不符必崩；且 `/api/cron/subscriptions` 不在 vercel.json crons 里，生产永不触发 |
| 4 | SIWE + JWT | ✅ | 全库质量最高模块。真验签、单次性 nonce、HMAC JWT、会话落库。小瑕疵：verify 未传 expectedDomain；nonce 在验签前消费可被空烧 |
| 5 | AI Agent 预算执行 | ⚠️ | CRUD/6 层预算守卫/viem 执行器都是真的，但 approve 提案只改 status 不触发执行——真正的执行入口 `agent-integration-service` 全 app 零引用 |
| 6 | x402 微支付 | ⚠️ | ERC-3009/EIP-712 签名层扎实；但 `/verify` 只做正则不查链、`/execute` 无 relayer 时**伪造 mock txHash 并标记 completed**、通道结算 `executeOnChainSettlement()` 直接返回随机哈希 |
| 7 | MCP Server | ⚠️ | 实际 11 个工具（README 说 8）。9 个真实；`get_balance` 是假的（返回静态代币表）；`execute_payment` 用全局服务端私钥且预算 ID 硬编码 `'mcp'`（所有用户共享额度）。`createMcpServer()` 创建后从未使用，实际走手写 switch，工具清单双份维护已漂移 |
| 8 | A2A Protocol | ✅ | zod 信封校验 + EIP-191 验签 + nonce/时间戳防重放 + DB 唯一约束兜底，5 个 handler 全部真实落库。唯一硬编码：paymentQuote 固定返回 fee 0.50 |
| 9 | ERC-8004 Agent Card | ✅ | did:pkh 规范、/.well-known/agent.json、签名验证、CRUD 齐全 |
| 10 | $PUSD 稳定币 | ❌ | **纯营销素材**：无合约、无地址、无代币注册、networks.ts 的 hashkey 代币表里也没有 PUSD |

**统计：✅3 / ⚠️5 / ❌2。核心问题不是"没写"，而是"没接线"——写得最好的模块（multisig-service、batch-execution-worker、auto-execute-service、balance-sync-service）恰好都是无调用方的孤岛，UI 连的是更早期、更粗糙的版本。**

---

## 3. 安全问题

### 🔴 P0：鉴权旁路（修复前一切"功能可用"结论无意义）

`lib/middleware/api-auth.ts:37`：只要请求带 `x-wallet-address` 头且格式合法即视为已认证——无签名、无 nonce、无所有权证明；JWT 只是该头缺失时的 fallback。任何人 `curl -H "x-wallet-address: 0x<受害者>"` 即可冒充任意用户访问全部受保护路由（批量支付执行、x402、Agent 提案审批、API Key 管理…）。精心实现的 SIWE/JWT 被一行旁路。

### 🟠 P1：mock 静默降级（5 个模块）

未配 relayer/密钥时**不报错而是写入伪造 txHash 并标记成功**：`x402/execute`、`relayer-service`（RELAYER_URL 缺失时 simulateRelay 双重造假）、`payment-service`、`subscription-payment-executor`、`pb-stream-service`。"跑通"假象会一直持续到用户去区块浏览器查哈希。

### 🟠 P1：schema 漂移

`lib/multisig.ts` 与 `lib/grpc/payout-bridge.ts` 的裸 SQL 与 Prisma schema 不一致（不存在的表/列），运行时必崩。schema 演进有三套并行机制：Prisma migrations（仅 1 个）、scripts/ 34 个手写 SQL（编号还重复）、scripts/schema/append_*.js 9 个文本追加脚本。

### 其他

- `middleware.ts` 用进程内 Map 限流（Vercel 多实例下无效，虽然项目已有 Redis）；CSP 允许 unsafe-inline/unsafe-eval
- `/api/verify-payment` 的 server_hash 未真正服务端计算
- `cross-function-security.ts:314` 钱包-用户绑定校验被注释降级为"只检查两者都存在"

---

## 4. 死代码清单（可删 ~7,000+ 行）

### 4.1 整片死目录/文件（全仓库零引用，高置信度）

- `lib/ai-wallet/**`（759 行，调用的 `/api/payments/execute` 等端点也不存在）
- `lib/sdk/pb-stream-client.ts`（460 行，`/api/pb-stream/*` 整个目录不存在）
- `lib/security/advanced-attack-protection.ts` + `mixed-attack-protection.ts`（1,296 行）
- `lib/zunodex.ts` + `lib/zetachain.ts`（867 行）
- `lib/payment-service.ts`（234 行，在用的是 lib/services/ 下同名文件）
- `lib/storage.ts`、`lib/api-error.ts`、`lib/reown-config.ts`、`lib/tron-contracts.ts`、`lib/security/security-monitor.ts`、`lib/security/api-keys.ts`、`lib/middleware/api-key-auth.ts`、`lib/design-system/icon-map.ts`
- `hooks/index.ts` 死 barrel + 其独占的 10 个 hook（use-x402、use-x402-payment、use-offramp、use-invoice、use-client-security、use-security-monitor、use-payment-confirmation、use-security-check、use-audit-log、use-activities）
- 零引用 hooks：use-api-keys、use-auth、use-batch-transfer、use-dashboard-activity（后者调用的 /api/dashboard/* 不存在）
- 组件：dashboard-activity.tsx、dashboard/multi-network-balance.tsx、fee-breakdown.tsx、transactions/transaction-list.tsx、tron/tron-resources.tsx、ui/network-selector.tsx、ui/glass-section.tsx、ui/loading-spinner.tsx
- 仅 barrel 可达的 8 个 service（authorization-generator、batch-transfer-service、fee-distributor、history-service、recovery-manager、relayer-client、signature-verifier、x402-fee-calculator）
- `lib/services/queue/payment-queue.service.ts`：BullMQ 队列写完无人 import（bullmq+ioredis 依赖因此浪费）

### 4.2 无调用方的 API 路由（~30 个）

analytics/{summary,monthly,by-chain,by-vendor}、reports/accounting、notifications/*（5 个）、scheduled-payments（UI 标 Coming Soon）、split-payment/{calculate,templates}、ledger/{sync,export}、invoice/export、payments/refund、billing/history、payout/batch、batch-payment/execute（最完整的批量引擎，前端不调）、agents/{resume-all,proposals/batch,[id]/webhooks,[id]/utilization,[id]/virtual-cards,[id]/card,activities,analytics}、auth/oauth/apple、auth/setup-pin（UI 实际走 wallet/create）、auth/wallet/get

### 4.3 前端调用但端点不存在（真实 bug）

- **`settings/webhooks` 页 Test Webhook 按钮 → POST `/api/webhooks/[id]/test` 必 404**（用户可见 bug）
- use-dashboard-activity → `/api/dashboard/*` 不存在
- `/api/x402` discovery 响应对外宣告的 `/api/x402/status` 不存在

### 4.4 假数据驱动的页面

- **admin 四件套（contracts/domains/fees/monitoring）纯 localStorage/空数组，零后端**——外观完整、功能为零
- `acquiring/invoices` 列表 `loadInvoices()` 不发请求，直接 set 硬编码 mock（不受 demo mode 控制；`/api/invoice` 明明存在）
- `vendors/[id]` 交易历史是 5 条硬编码数据
- （`contexts/demo-context.tsx` 的 Demo Mode 是刻意设计，28 处引用，不算死代码）

### 4.5 测试在维护死代码

`lib/__tests__/api-key-auth.test.ts`、`hooks/__tests__/use-api-keys.test.ts`、`use-dashboard-activity.test.ts` 的被测对象全是零引用死模块。另外 `tests/` 目录下的 jest 测试因 jest.config testMatch 不匹配**永远不会被执行**。

### 4.6 contracts/ 问题

- `contracts/BatchTransfer.sol`（根目录副本）用 OZ v4 路径，Hardhat 永不编译，纯残留
- `contracts/yield/MerchantYieldManager.sol` 不在 hardhat sources 目录，`yield/deploy.ts` 必抛 HH701
- 6 个 scripts 引用已改名 `.bak` 的 TronYieldAggregator.sol，编译/部署必失败
- 无任何部署地址清单文件；admin/contracts 页让人手工往 localStorage 录地址
- artifacts/cache/typechain-types/node_modules 被提交进仓库（~150 文件）

---

## 5. 架构问题

1. **分层混乱**：Go 代码混在 `lib/services/shared/`（1,149 行）；`@/services/*` 别名指向 `lib/services/` 而磁盘 `services/` 是 Go 微服务——同名指两物；`@/backend/*` 指向不存在目录。
2. **`lib/` vs `lib/services/` 双轨**：payment-service、multisig、api-auth 各有 2-5 套实现并存。
3. **批量支付 6 套实现**、3 组 API 前缀、3 个 hook。
4. **851 行手写 barrel** `lib/services/index.ts`（注释自认符号冲突需别名），破坏 tree-shaking 且只被 2 个路由用了 7 个符号。
5. **超大文件**：batch-payment/page.tsx 2,215 行；6 个页面 >1,000 行；schema.prisma 1,922 行 88 模型单文件；54/69 页面是 "use client" 且数据获取+表单+业务校验全写在页面里。
6. **依赖冗余**：ethers(19 文件)+viem(23 文件) 双 Web3 库并存；redis+ioredis 双客户端；@solana/web3.js 零引用；@tanstack/query-core 装了但用 SWR；wagmi 全家桶只有 1 处用。
7. **双 lockfile**（package-lock.json + pnpm-lock.yaml + contracts 第三套）；package name 还是 `my-v0-project`。
8. **Prisma 模型利用率 ~63%**：88 个模型中 4 个零引用（含 CorporateCard/CardTransaction——/card 页面存在却不碰它们）、13 个仅 1-2 次引用、3 个只活在死代码里。
9. `logs/*.log` 提交进仓库；`services/proto/` 混入 .jpg；两个 `.sol.bak`。

---

## 6. 优化路线建议

### P0 — 立即（安全 + 构建）
1. 修 `withAuth`：删除 `x-wallet-address` 信任路径，强制 JWT/签名验证
2. 把 `@scure/bip39`、`@grpc/proto-loader` 加进 package.json dependencies → 恢复 `next build`
3. 解决 hardhat 版本冲突（hardhat-toolbox 降级需求 or hardhat 锁 2.x），删除 package-lock.json 统一 pnpm
4. 所有 mock 静默降级路径改为显式 throw（x402/execute、relayer-service、subscription-payment-executor、pb-stream-service、payment-service）

### P1 — 短期（让宣称的功能真正跑通）
5. 多签二选一：新建 `/api/multisig/*` → 接 `lib/services/multisig-service.ts`，删 `lib/multisig.ts`
6. 订阅执行：拆分用户 Pay Now（withAuth）与 cron 批处理（CRON_SECRET）两个端点；修 payout-bridge.ts 的 INSERT；把 subscriptions cron 注册进 vercel.json
7. 批量支付收敛为一套：UI 接 `/api/batch-payment/execute` 引擎，修 Disperse 硬编码 Arbitrum，停止伪造 per-recipient 假哈希
8. x402 `/verify` 补真实链上 receipt 校验；MCP get_balance 接现成的 balance-sync-service；execute_payment 改按用户隔离预算
9. Agent 提案 approve 后接通 auto-execute-service
10. 修 webhooks Test 按钮 404；补全 ENV_SETUP.md（至少 DATABASE_URL / AI_JWT_SECRET / AGENT_EXECUTOR_PRIVATE_KEY）

### P2 — 中期（清理与收敛）
11. 删除 §4 全部死代码（~7,000 行）+ 30 个无调用方 API 路由（或接线）
12. 迁移机制收敛为 Prisma migrations 单一来源；删 append_*.js 和重复编号 SQL
13. admin 四件套接真实后端或从导航移除；acquiring/invoices 接 `/api/invoice`
14. Web3 库二选一（建议 viem）；删 solana/redis/query-core 冗余依赖
15. 拆超大页面文件；schema.prisma 按域拆分（Prisma 7 支持 multi-file schema）
16. 建 CI（lint + type-check + jest + next build 至少四道门）；README 把 $PUSD/多签标注为 Roadmap

### P3 — 长期
17. contracts 工程化：清理编译产物出 git、部署地址落 deployments.json、修 yield 合约目录结构
18. packages/sdk 纳入 pnpm workspace 或独立发布
19. 限流迁到 Redis；CSP 收紧
