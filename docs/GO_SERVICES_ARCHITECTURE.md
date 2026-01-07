// ... existing code ...

## Proto 文件

所有 gRPC 服务定义位于 `services/proto/`:
- `payout.proto` - 支付服务
- `multisig.proto` - 多签服务
- `indexer.proto` - 索引服务
- `webhook.proto` - Webhook 服务

生成 Go 代码:
```bash
protoc --go_out=. --go-grpc_out=. proto/*.proto
```

生成 TypeScript 代码 (供 Next.js 使用):
```bash
npx protoc --ts_out=./lib/proto proto/*.proto
```

// <CHANGE> 添加新章节：安全、监控、商用就绪检查清单

## 安全架构

### 密钥管理 (HashiCorp Vault)

```go
// 从 Vault 获取私钥
vaultClient, _ := vault.NewClient(vault.Config{
    Address:   "https://vault.example.com",
    Token:     os.Getenv("VAULT_TOKEN"),
    MountPath: "secret",
    KeyPath:   "protocol-bank/hot-wallet",
})

privateKey, _ := vaultClient.GetPrivateKey(ctx, "main-wallet")
```

**密钥轮换策略：**
- 自动备份旧密钥
- 每 90 天轮换一次
- 支持紧急轮换（私钥泄露时）

### 访问控制

| 组件 | 访问权限 |
|------|----------|
| Payout Engine | 只能访问热钱包私钥 |
| Event Indexer | 只读区块链访问 |
| Webhook Handler | 无私钥访问权限 |

### 输入验证

```go
// 地址验证
func ValidateEthAddress(address string) error {
    if !common.IsHexAddress(address) {
        return errors.New("invalid address format")
    }
    // 检查是否为零地址
    if address == "0x0000000000000000000000000000000000000000" {
        return errors.New("zero address not allowed")
    }
    return nil
}

// 金额验证
func ValidateAmount(amount string, maxAmount *big.Int) error {
    value, ok := new(big.Int).SetString(amount, 10)
    if !ok || value.Sign() <= 0 {
        return errors.New("invalid amount")
    }
    if value.Cmp(maxAmount) > 0 {
        return errors.New("amount exceeds maximum")
    }
    return nil
}
```

### 限流 (Per-User)

```go
// 每用户限流
rateLimiter := security.NewRateLimiter(redis, security.RateLimiterConfig{
    RequestsPerMinute:     100,
    RequestsPerHour:       1000,
    BurstSize:             20,
    BlockDurationMinutes:  30,
})

// 检查限流
if !rateLimiter.Allow(ctx, userID) {
    return errors.New("rate limit exceeded")
}
```

## 监控与告警

### Prometheus 指标

| 指标名称 | 类型 | 描述 |
|----------|------|------|
| `payout_transaction_total` | Counter | 支付交易总数 |
| `payout_queue_depth` | Gauge | 队列深度 |
| `payout_processing_duration_seconds` | Histogram | 处理时间 |
| `payout_error_total` | Counter | 错误计数 |
| `indexer_block_lag` | Gauge | 区块同步延迟 |
| `webhook_signature_verification_total` | Counter | 签名验证结果 |

### 关键告警规则

| 告警 | 条件 | 严重程度 |
|------|------|----------|
| PayoutHighErrorRate | 错误率 > 5% (5分钟) | Critical |
| PayoutQueueBacklog | 队列深度 > 1000 (10分钟) | Warning |
| IndexerBlockLag | 落后 > 100 区块 (5分钟) | Warning |
| WebhookSignatureFailures | 签名失败率 > 1% | Critical |
| ServiceDown | 服务不可用 > 1分钟 | Critical |

### Grafana Dashboard

导入 `k8s/monitoring/grafana-dashboard.json` 获得：
- 服务健康状态面板
- 支付吞吐量图表
- 队列深度趋势
- 错误率统计
- 区块同步状态

## 商用就绪检查清单

### 必须完成 (P0)

- [x] gRPC Proto 定义
- [x] Payout Engine 核心逻辑
- [x] Event Indexer 核心逻辑
- [x] Webhook Handler 核心逻辑
- [x] Next.js gRPC 客户端桥接
- [x] 单元测试 (核心模块)
- [x] CI/CD Pipeline
- [x] Kubernetes 部署配置
- [x] Prometheus 指标
- [x] 告警规则
- [x] HashiCorp Vault 集成
- [x] 输入验证和限流
- [ ] HSM 集成 (硬件安全模块)

### 建议完成 (P1)

- [ ] 集成测试 (testcontainers)
- [ ] 压力测试 (验证 1000+ TPS)
- [ ] 第三方渗透测试
- [ ] SOC 2 合规审计
- [ ] 灾难恢复演练
- [ ] Bug Bounty 计划

### 部署前检查

```bash
# 1. 运行所有测试
cd services && make test

# 2. 安全扫描
make security-scan

# 3. 构建镜像
make build

# 4. 部署到 staging
kubectl apply -f k8s/ --namespace=protocol-bank-staging

# 5. 运行冒烟测试
./scripts/smoke-test.sh staging

# 6. 部署到生产 (Canary)
kubectl set image deployment/payout-engine \
  payout-engine=protocol-bank/payout-engine:$TAG \
  --namespace=protocol-bank
```

## 特性开关

通过环境变量控制 Go 服务启用：

```bash
# Next.js 环境变量
ENABLE_GO_SERVICES=true    # 启用 Go 服务
ENABLE_GO_SERVICES=false   # 回退到 TypeScript

# 可以在 v0 侧边栏的 Vars 中设置
```

**降级机制：**
- Go 服务失败时自动回退到 TypeScript 实现
- 记录降级事件到日志和监控

```typescript
// lib/grpc/client.ts
export async function withGoServicesFallback<T>(
  goOperation: () => Promise<T>,
  tsOperation: () => Promise<T>,
): Promise<T> {
  if (isGoServicesEnabled()) {
    try {
      return await goOperation();
    } catch (error) {
      console.error('[gRPC] Go service failed, falling back:', error);
      return tsOperation();
    }
  }
  return tsOperation();
}
