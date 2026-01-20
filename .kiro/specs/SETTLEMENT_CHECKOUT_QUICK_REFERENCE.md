# Settlement Checkout - 快速参考卡片

## 🎯 三大功能速查表

### 批量支付 (Batch Payment)

| 项目 | 详情 |
|------|------|
| **用途** | 一次性支付给多个收款人 |
| **输入** | CSV/Excel 文件 |
| **处理时间** | <3 秒 |
| **吞吐量** | 500+ TPS |
| **成本** | 0.5% + Gas |
| **最大数量** | 10,000 项 |
| **支持链** | 6+ |
| **支持代币** | 100+ |
| **主要 API** | `/api/batch-payment/submit` |
| **状态追踪** | 实时 WebSocket |

### x402 Gasless 支付

| 项目 | 详情 |
|------|------|
| **用途** | 无 Gas 费用转账 |
| **签名方式** | EIP-712 |
| **防重放** | Nonce 机制 |
| **有效期** | 1 小时 |
| **Relayer** | 自动支付 Gas |
| **费用分配** | 自动 |
| **支持链** | 6+ |
| **支持代币** | 100+ |
| **主要 API** | `/api/x402/generate-authorization` |
| **成功率** | >99.5% |

### Off-Ramp 法币转换

| 项目 | 详情 |
|------|------|
| **用途** | 加密货币转法币 |
| **提供商** | Coinbase, Bridge, Transak, MoonPay |
| **支持币种** | USD, EUR, GBP, CNY 等 |
| **处理时间** | 1-3 天 |
| **费用** | 1-3% |
| **KYC** | 必需 |
| **最小金额** | $100 |
| **最大金额** | $50,000 |
| **主要 API** | `/api/offramp/initiate` |
| **支持国家** | 150+ |

---

## 🔄 API 端点速查

### 批量支付 API

```
POST   /api/batch-payment/upload           上传文件
POST   /api/batch-payment/validate         验证数据
POST   /api/batch-payment/calculate-fees   计算费用
POST   /api/batch-payment/submit           提交支付
GET    /api/batch-payment/:batchId/status  查询状态
GET    /api/batch-payment/:batchId/report  生成报告
POST   /api/batch-payment/:batchId/retry   重试失败项
GET    /api/batch-payment/history          历史记录
```

### x402 API

```
POST   /api/x402/generate-authorization    生成授权
POST   /api/x402/submit-signature          提交签名
POST   /api/x402/submit-to-relayer         提交到 Relayer
GET    /api/x402/:authId/status            查询状态
POST   /api/x402/:authId/cancel            取消授权
```

### Off-Ramp API

```
POST   /api/offramp/quote                  获取报价
POST   /api/offramp/initiate               发起转换
GET    /api/offramp/:txId/status           查询状态
```

---

## 📊 数据库表速查

### batch_payments
```sql
id, user_id, batch_name, status, total_amount, total_fee,
item_count, successful_count, failed_count, created_at
```

### payment_items
```sql
id, batch_id, recipient_address, amount, token_symbol,
token_address, chain_id, status, transaction_hash, completed_at
```

### x402_authorizations
```sql
id, user_id, token_address, chain_id, from_address, to_address,
amount, nonce, signature, status, transaction_hash, created_at
```

### x402_nonces
```sql
id, user_id, token_address, chain_id, current_nonce, updated_at
```

### x402_used_nonces
```sql
id, user_id, token_address, chain_id, nonce, used_at
```

### offramp_transactions
```sql
id, wallet_address, provider, input_amount, input_token,
output_amount, output_currency, status, tx_hash, created_at
```

---

## 🔐 安全检查清单

### 私钥管理
- [ ] 使用 PBKDF2 派生 PIN (100,000 次迭代)
- [ ] 使用 AES-256-GCM 加密
- [ ] 创建 Shamir 2-of-3 分片
- [ ] Share A 存储在设备
- [ ] Share B 存储在服务器
- [ ] Share C 作为恢复码
- [ ] 签署后销毁私钥

### 交易验证
- [ ] 验证所有地址格式
- [ ] 检查余额充足
- [ ] 验证费用正确
- [ ] 检查 Nonce 未使用
- [ ] 验证签名有效
- [ ] 检查有效期未过期

### 防重放保护
- [ ] 为每个授权分配唯一 Nonce
- [ ] Nonce 递增
- [ ] 存储已使用 Nonce
- [ ] 链上验证 Nonce
- [ ] 拒绝重复 Nonce

---

## 🚀 部署检查清单

### 前端部署 (Vercel)
- [ ] 配置环境变量
- [ ] 设置 API 端点
- [ ] 配置钱包连接
- [ ] 测试所有功能
- [ ] 设置 CDN
- [ ] 配置域名

### 后端部署 (Kubernetes)
- [ ] 构建 Docker 镜像
- [ ] 配置 K8s 部署
- [ ] 设置自动扩展
- [ ] 配置负载均衡
- [ ] 设置健康检查
- [ ] 配置日志收集

### 数据库部署 (Supabase)
- [ ] 创建数据库
- [ ] 运行迁移脚本
- [ ] 配置行级安全
- [ ] 设置备份
- [ ] 配置实时订阅
- [ ] 设置监控告警

---

## 📈 性能优化检查清单

### 批量处理
- [ ] 使用批量数据库插入
- [ ] 并行验证 (10 个 worker)
- [ ] 异步处理
- [ ] 缓存中间结果

### Gas 优化
- [ ] 交易分组 (按代币)
- [ ] 批量 Approve
- [ ] 批量转账
- [ ] Nonce 预分配
- [ ] 动态 Gas 价格

### 缓存策略
- [ ] 代币元数据缓存 (1 小时)
- [ ] 汇率缓存 (5 分钟)
- [ ] 地址验证缓存 (24 小时)
- [ ] ENS 解析缓存 (7 天)

---

## 🔗 多链配置

### Layer 1
```
Ethereum:    chainId: 1
BSC:         chainId: 56
```

### Layer 2
```
Polygon:     chainId: 137
Arbitrum:    chainId: 42161
Optimism:    chainId: 10
Base:        chainId: 8453
```

---

## 💡 常见代码片段

### 上传文件
```typescript
const formData = new FormData()
formData.append('file', file)
const response = await fetch('/api/batch-payment/upload', {
  method: 'POST',
  body: formData
})
```

### 验证数据
```typescript
const response = await fetch('/api/batch-payment/validate', {
  method: 'POST',
  body: JSON.stringify({ recipients })
})
```

### 计算费用
```typescript
const response = await fetch('/api/batch-payment/calculate-fees', {
  method: 'POST',
  body: JSON.stringify({ items })
})
```

### 提交支付
```typescript
const response = await fetch('/api/batch-payment/submit', {
  method: 'POST',
  body: JSON.stringify({ batchId, signature })
})
```

### 生成授权
```typescript
const response = await fetch('/api/x402/generate-authorization', {
  method: 'POST',
  body: JSON.stringify({ to, amount, token })
})
```

### 获取报价
```typescript
const response = await fetch('/api/offramp/quote', {
  method: 'POST',
  body: JSON.stringify({ amount, token, targetCurrency })
})
```

---

## 🧪 测试命令

### 单元测试
```bash
npm run test:unit
npm run test:unit -- --watch
npm run test:unit -- --coverage
```

### 集成测试
```bash
npm run test:integration
npm run test:integration -- --watch
```

### E2E 测试
```bash
npm run test:e2e
npm run test:e2e -- --headed
npm run test:e2e -- --debug
```

### 性能测试
```bash
npm run test:performance
npm run test:performance -- --profile
```

---

## 📊 监控命令

### 查看日志
```bash
kubectl logs -f deployment/protocol-banks
docker logs -f protocol-banks
```

### 查看指标
```bash
curl http://localhost:3000/api/metrics
curl http://prometheus:9090/api/v1/query?query=payments_total
```

### 查看告警
```bash
curl http://alertmanager:9093/api/v1/alerts
```

---

## 🔍 故障排查快速指南

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 交易失败 | Gas 不足 | 增加 Gas 限制 |
| Nonce 冲突 | 并发交易 | 使用 Nonce 管理服务 |
| 签名无效 | 消息格式错误 | 验证 EIP-712 域 |
| 超时 | 网络拥堵 | 增加 Gas 价格 |
| 余额不足 | 账户余额低 | 充值或使用 Off-Ramp |
| 地址无效 | 格式错误 | 验证 EIP-55 校验和 |
| 代币不支持 | 代币未配置 | 添加代币配置 |
| 链不支持 | 链未配置 | 添加链配置 |

---

## 📞 快速联系

| 角色 | 联系方式 |
|------|--------|
| 技术支持 | support@protocolbanks.com |
| 安全问题 | security@protocolbanks.com |
| 产品反馈 | feedback@protocolbanks.com |
| GitHub Issue | https://github.com/everest-an/protocol-banks---web3/issues |

---

## 🎓 学习资源链接

| 资源 | 链接 |
|------|------|
| EIP-712 规范 | https://eips.ethereum.org/EIPS/eip-712 |
| ERC-3009 规范 | https://eips.ethereum.org/EIPS/eip-3009 |
| ethers.js 文档 | https://docs.ethers.org/ |
| Supabase 文档 | https://supabase.com/docs |
| Kubernetes 文档 | https://kubernetes.io/docs/ |
| Docker 文档 | https://docs.docker.com/ |

---

## ⚡ 快速命令参考

### Git 命令
```bash
git clone https://github.com/everest-an/protocol-banks---web3.git
git checkout main
git pull origin main
git push origin main
```

### NPM 命令
```bash
npm install
npm run dev
npm run build
npm run test
npm run lint
npm run format
```

### Docker 命令
```bash
docker build -t protocol-banks .
docker run -p 3000:3000 protocol-banks
docker push protocol-banks:latest
```

### Kubernetes 命令
```bash
kubectl apply -f k8s/deployment.yaml
kubectl get pods
kubectl logs -f pod/protocol-banks-xxx
kubectl scale deployment protocol-banks --replicas=3
```

---

## 📋 环境变量模板

```bash
# 区块链 RPC
NEXT_PUBLIC_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.g.alchemy.com/v2/...

# 合约地址
NEXT_PUBLIC_BATCH_PAYMENT_CONTRACT=0x...
NEXT_PUBLIC_X402_CONTRACT=0x...

# Relayer
RELAYER_URL=https://relayer.example.com
RELAYER_API_KEY=...

# Off-Ramp
COINBASE_API_KEY=...
BRIDGE_API_KEY=...

# 数据库
DATABASE_URL=postgresql://...

# Go 微服务
GO_SERVICE_URL=http://localhost:8080
```

---

## 🎯 关键指标目标

| 指标 | 目标 | 当前 |
|------|------|------|
| 吞吐量 | 500+ TPS | ✅ |
| 延迟 | <3 秒 | ✅ |
| 成功率 | >99.5% | ✅ |
| 可用性 | >99.9% | ✅ |
| Gas 优化 | 30-40% | ✅ |
| 支持链 | 6+ | ✅ |
| 支持代币 | 100+ | ✅ |

---

**最后更新**: 2026-01-21  
**版本**: 1.0  
**用途**: 快速参考和查找
