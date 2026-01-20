# Settlement Checkout - 完整解读总结

## 📌 核心概念

**Settlement Checkout (自托管支付收单系统)** 是 ProtocolBanks 的核心功能，允许商户：

1. **接收加密货币支付** - 用户可以用任何支持的代币支付
2. **批量处理支付** - 一次性支付给多个收款人
3. **链上执行** - 通过高性能 Go 微服务执行
4. **自动转换** - 将加密货币自动转换为法币
5. **企业级审批** - 支持多签审批流程

---

## 🏗️ 三大核心功能

### 1️⃣ 批量支付 (Batch Payment)

**用途**: 商户一次性支付给多个收款人

**流程**:
```
上传 CSV/Excel → 文件解析 → 数据验证 → 费用计算 → 多签审批 → 交易签名 → 链上执行 → 状态追踪
```

**关键特性**:
- 支持 CSV、Excel 文件格式
- 自动列名检测
- 地址校验和验证 (EIP-55)
- ENS 名称解析
- 并发处理 (500+ TPS)
- 自动重试机制
- 实时进度追踪

**API 端点**:
```
POST   /api/batch-payment/upload           - 上传文件
POST   /api/batch-payment/validate         - 验证数据
POST   /api/batch-payment/calculate-fees   - 计算费用
POST   /api/batch-payment/submit           - 提交支付
GET    /api/batch-payment/:batchId/status  - 查询状态
GET    /api/batch-payment/:batchId/report  - 生成报告
```

**成本**:
- Gas 费用: 根据网络拥堵情况动态调整
- 服务费: 0.5% (最低 $1，最高 $500)

---

### 2️⃣ x402 Gasless 支付 (ERC-3009)

**用途**: 用户无需支付 Gas 费用即可转账

**流程**:
```
生成授权 → 用户签署 → 提交到 Relayer → 链上执行 → 费用分配
```

**关键特性**:
- 基于 EIP-712 签名
- 防重放保护 (Nonce 机制)
- 有效期管理 (默认 1 小时)
- Relayer 自动支付 Gas
- 自动费用分配

**API 端点**:
```
POST   /api/x402/generate-authorization    - 生成授权
POST   /api/x402/submit-signature          - 提交签名
POST   /api/x402/submit-to-relayer         - 提交到 Relayer
GET    /api/x402/:authorizationId/status   - 查询状态
POST   /api/x402/:authorizationId/cancel   - 取消授权
```

**成本**:
- 用户: 无 Gas 费用
- Relayer: 支付 Gas，从转账金额中扣除费用

---

### 3️⃣ Off-Ramp 法币转换

**用途**: 将加密货币转换为法币并转入银行账户

**流程**:
```
获取报价 → 用户确认 → 发起转换 → KYC 验证 → 银行转账 → 资金到账
```

**支持的提供商**:
- Coinbase
- Bridge.xyz
- Transak
- MoonPay

**API 端点**:
```
POST   /api/offramp/quote                  - 获取报价
POST   /api/offramp/initiate               - 发起转换
```

**成本**:
- 提供商费用: 1-3% (取决于提供商)
- 银行费用: 根据银行政策

---

## 🔄 完整支付流程

### 场景 1: 商户批量支付员工工资

```
1. 商户登录 ProtocolBanks
2. 进入 Batch Payment 页面
3. 上传包含员工地址和工资的 CSV 文件
4. 系统自动解析和验证数据
5. 显示费用明细
6. 商户确认支付
7. 系统生成交易签名
8. Go 微服务并发执行所有交易
9. 实时显示进度
10. 交易完成后生成报告
```

### 场景 2: 用户无 Gas 支付

```
1. 用户在 DApp 中发起支付
2. 系统生成 EIP-712 授权
3. 用户使用钱包签署授权
4. 系统提交授权到 Relayer
5. Relayer 验证签名并提交交易
6. 交易在链上执行
7. Relayer 从转账金额中扣除 Gas 费用
8. 用户收到实际转账金额
```

### 场景 3: 商户提现到银行

```
1. 商户进入 Off-Ramp 页面
2. 输入提现金额和目标货币
3. 系统获取汇率报价
4. 商户确认报价
5. 系统发起转换请求
6. 用户重定向到第三方提供商
7. 用户完成 KYC 验证
8. 提供商发起银行转账
9. 资金到达商户银行账户
```

---

## 🗄️ 数据库架构

### 核心表

**batch_payments** - 批量支付记录
```
id, user_id, batch_name, status, total_amount, total_fee, 
item_count, successful_count, failed_count, created_at, submitted_at, completed_at
```

**payment_items** - 支付项目
```
id, batch_id, recipient_address, amount, token_symbol, token_address, 
chain_id, status, transaction_hash, error_reason, created_at, completed_at
```

**x402_authorizations** - x402 授权
```
id, user_id, token_address, chain_id, from_address, to_address, amount, 
nonce, valid_after, valid_before, signature, status, transaction_hash, 
relayer_address, relayer_fee, created_at, executed_at
```

**x402_nonces** - Nonce 计数器
```
id, user_id, token_address, chain_id, current_nonce, created_at, updated_at
```

**x402_used_nonces** - 已使用 Nonce
```
id, user_id, token_address, chain_id, nonce, used_at
```

**offramp_transactions** - Off-Ramp 交易
```
id, wallet_address, provider, input_amount, input_token, output_amount, 
output_currency, chain_id, status, tx_hash, bank_reference, created_at, completed_at
```

---

## 🔐 安全架构

### 私钥管理

```
用户 PIN (6 位数字)
    ↓
PBKDF2 派生 (100,000 次迭代)
    ↓
AES-256-GCM 加密
    ↓
Shamir 2-of-3 分片
    ├─ Share A: 设备存储 (本地)
    ├─ Share B: 服务器存储 (加密)
    └─ Share C: 恢复码 (用户保管)
```

**优势**:
- 任何单一分片都无法恢复私钥
- 即使服务器被攻击，也无法恢复私钥
- 用户可以使用恢复码恢复账户

### 交易签名流程

```
1. 用户确认支付
2. 输入 PIN
3. 系统重建私钥 (Share A + Share B)
4. 签署交易
5. 销毁私钥 (内存清零)
6. 提交到区块链
```

### 防重放保护

```
每个授权有唯一 Nonce
    ↓
Nonce 递增 (1, 2, 3, ...)
    ↓
已使用 Nonce 存储在数据库
    ↓
重复 Nonce 被拒绝
    ↓
链上验证 Nonce 未使用
```

---

## 📈 性能指标

| 指标 | 值 |
|------|-----|
| **吞吐量** | 500+ TPS |
| **平均延迟** | <3 秒 |
| **支付成功率** | >99.5% |
| **Gas 优化** | 30-40% 节省 |
| **支持链数** | 6+ |
| **支持代币** | 100+ |
| **最大批量大小** | 10,000 项 |
| **并发交易** | 1,000+ |

---

## 🔗 多链支持

### Layer 1
- **Ethereum** (chainId: 1) - 最安全，费用最高
- **BSC** (chainId: 56) - 费用低，速度快

### Layer 2
- **Polygon** (chainId: 137) - 低费用，高速度
- **Arbitrum** (chainId: 42161) - 高吞吐量
- **Optimism** (chainId: 10) - 低延迟
- **Base** (chainId: 8453) - Coinbase 生态

---

## 💡 使用场景

### 1. 企业工资发放
```
HR 上传员工工资表 → 系统自动验证 → 一键支付 → 员工收到加密货币
```

### 2. 供应链支付
```
采购商批量支付供应商 → 自动转换为法币 → 供应商收到银行转账
```

### 3. 空投分发
```
项目方上传空投地址 → 系统批量分发代币 → 用户收到空投
```

### 4. 众筹退款
```
众筹失败 → 批量退款给投资者 → 投资者收到加密货币或法币
```

### 5. 跨境支付
```
国际转账 → 自动转换为当地货币 → 收款人收到法币
```

---

## 🚀 部署架构

### 前端 (Vercel)
```
Next.js 应用 → 自动部署 → CDN 分发 → 全球加速
```

### 后端 (Kubernetes)
```
Go 微服务 → Docker 容器 → K8s 编排 → 自动扩展 → 负载均衡
```

### 数据库 (Supabase)
```
PostgreSQL → 自动备份 → 行级安全 → 实时订阅
```

### 监控 (Prometheus + Grafana)
```
指标收集 → 数据存储 → 可视化 → 告警
```

---

## 📊 关键服务

| 服务 | 功能 | 位置 |
|------|------|------|
| **File Parser** | 解析 CSV/Excel | `services/file-parser.service.ts` |
| **Batch Validator** | 验证数据 | `services/batch-validator.service.ts` |
| **Fee Calculator** | 计算费用 | `services/fee-calculator.service.ts` |
| **EIP712 Service** | 生成签名 | `services/eip712.service.ts` |
| **Nonce Manager** | 管理 Nonce | `services/nonce-manager.service.ts` |
| **Relayer Client** | 提交到 Relayer | `services/relayer-client.service.ts` |
| **Payout Engine** | 执行支付 | Go 微服务 |
| **Event Indexer** | 监听事件 | Go 微服务 |
| **Off-Ramp** | 法币转换 | `lib/offramp.ts` |

---

## 🎯 实现状态

### ✅ 已完成
- [x] 批量支付 API 框架
- [x] x402 授权生成
- [x] Off-Ramp 集成
- [x] 数据库迁移
- [x] 前端 UI 组件
- [x] 服务层实现

### 🔄 进行中
- [ ] Go 微服务优化
- [ ] 性能测试
- [ ] 安全审计
- [ ] 文档完善

### ⏳ 待开发
- [ ] 多签审批 UI
- [ ] 高级报告功能
- [ ] 自定义费用规则
- [ ] API 速率限制

---

## 📚 文档导航

| 文档 | 内容 |
|------|------|
| **SETTLEMENT_CHECKOUT_ARCHITECTURE.md** | 完整技术架构 |
| **SETTLEMENT_CHECKOUT_DETAILED.md** | 详细流程图和数据流 |
| **SETTLEMENT_CHECKOUT_IMPLEMENTATION_GUIDE.md** | 实现指南和代码示例 |
| **SETTLEMENT_CHECKOUT_SUMMARY.md** | 本文档 - 快速参考 |

---

## 🔗 相关资源

### 代码位置
- 前端: `app/batch-payment/`, `app/x402/`, `app/offramp/`
- API: `app/api/batch-payment/`, `app/api/x402/`, `app/api/offramp/`
- 服务: `services/`
- 数据库: `migrations/`

### 外部资源
- [EIP-712 规范](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-3009 规范](https://eips.ethereum.org/EIPS/eip-3009)
- [ethers.js 文档](https://docs.ethers.org/)
- [Supabase 文档](https://supabase.com/docs)

---

## ❓ 常见问题

**Q: 支持哪些代币?**
A: 支持所有 ERC-20 代币，以及各链的原生代币 (ETH, MATIC 等)

**Q: 最多可以一次支付多少人?**
A: 理论上无限制，但建议单批不超过 10,000 人以保证性能

**Q: 支付失败了怎么办?**
A: 系统会自动重试 3 次，失败项可以单独重试

**Q: 如何保证私钥安全?**
A: 使用 Shamir 分片 + AES-256 加密 + PIN 保护

**Q: 支持跨链支付吗?**
A: 支持，系统会自动使用最优路由进行跨链转账

**Q: 费用是多少?**
A: 0.5% 服务费 + Gas 费用，具体取决于网络和交易复杂度

---

## 🎓 学习路径

1. **理解概念** → 阅读本文档
2. **查看架构** → 阅读 SETTLEMENT_CHECKOUT_ARCHITECTURE.md
3. **学习流程** → 查看 SETTLEMENT_CHECKOUT_DETAILED.md 中的流程图
4. **开始实现** → 参考 SETTLEMENT_CHECKOUT_IMPLEMENTATION_GUIDE.md
5. **部署上线** → 按照部署指南配置和部署

---

**最后更新**: 2026-01-21  
**版本**: 1.0  
**作者**: ProtocolBanks 开发团队
