# Settlement Checkout - 实现指南与最佳实践

## 🎯 快速开始

### 1. 批量支付实现步骤

#### 前端集成
```typescript
// app/batch-payment/page.tsx
import { BatchPaymentForm } from '@/components/batch-payment/form'
import { useUploadFile } from '@/hooks/useUploadFile'

export default function BatchPaymentPage() {
  const { upload, loading } = useUploadFile()
  
  const handleFileUpload = async (file: File) => {
    const result = await upload(file)
    // 显示预览
  }
  
  return <BatchPaymentForm onUpload={handleFileUpload} />
}
```

#### API 实现
```typescript
// app/api/batch-payment/upload/route.ts
import { FileParserService } from '@/services/file-parser.service'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  
  const parser = new FileParserService()
  const result = await parser.parse(file)
  
  return Response.json(result)
}
```

#### 服务层实现
```typescript
// services/file-parser.service.ts
export class FileParserService {
  async parse(file: File) {
    const buffer = await file.arrayBuffer()
    const data = this.detectFormat(buffer)
    const rows = this.parseRows(data)
    const recipients = this.mapColumns(rows)
    
    return {
      success: true,
      recipients,
      errors: [],
      warnings: []
    }
  }
}
```

### 2. x402 Gasless 支付实现步骤

#### 前端集成
```typescript
// app/x402/page.tsx
import { useX402Authorization } from '@/hooks/useX402Authorization'

export default function X402Page() {
  const { generateAuth, submitSignature } = useX402Authorization()
  
  const handleGaslessPayment = async () => {
    // 1. 生成授权
    const auth = await generateAuth({
      to: recipientAddress,
      amount: paymentAmount,
      token: tokenAddress
    })
    
    // 2. 用户签署
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [userAddress, JSON.stringify(auth)]
    })
    
    // 3. 提交签名
    await submitSignature(auth.id, signature)
  }
  
  return <X402Form onSubmit={handleGaslessPayment} />
}
```

#### API 实现
```typescript
// app/api/x402/generate-authorization/route.ts
import { EIP712Service } from '@/services/eip712.service'
import { NonceManagerService } from '@/services/nonce-manager.service'

export async function POST(req: Request) {
  const { to, amount, token, chainId } = await req.json()
  
  const eip712 = new EIP712Service()
  const nonceManager = new NonceManagerService()
  
  const nonce = await nonceManager.getNextNonce(
    userId,
    token,
    chainId
  )
  
  const authorization = eip712.createAuthorization({
    from: userAddress,
    to,
    amount,
    nonce,
    validBefore: Date.now() + 3600000 // 1 小时
  })
  
  return Response.json(authorization)
}
```

### 3. Off-Ramp 法币转换实现步骤

#### 前端集成
```typescript
// app/offramp/page.tsx
import { useOffRamp } from '@/hooks/useOffRamp'

export default function OffRampPage() {
  const { getQuote, initiate } = useOffRamp()
  
  const handleOffRamp = async () => {
    // 1. 获取报价
    const quote = await getQuote({
      amount: '1000',
      token: 'USDC',
      targetCurrency: 'USD'
    })
    
    // 2. 用户确认
    // 3. 发起转换
    const transaction = await initiate({
      ...quote,
      bankAccount: userBankAccount
    })
    
    // 4. 重定向到提供商
    window.location.href = transaction.redirectUrl
  }
  
  return <OffRampForm onSubmit={handleOffRamp} />
}
```

#### API 实现
```typescript
// app/api/offramp/quote/route.ts
import { OffRampService } from '@/lib/offramp'

export async function POST(req: Request) {
  const { amount, token, targetCurrency } = await req.json()
  
  const offRamp = new OffRampService()
  const quote = await offRamp.getQuote({
    amount,
    token,
    targetCurrency,
    provider: 'coinbase'
  })
  
  return Response.json(quote)
}
```

---

## 🔧 配置与部署

### 环境变量配置

```bash
# .env.local

# 区块链 RPC
NEXT_PUBLIC_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_ARBITRUM_RPC=https://arb-mainnet.g.alchemy.com/v2/...

# 合约地址
NEXT_PUBLIC_BATCH_PAYMENT_CONTRACT=0x...
NEXT_PUBLIC_X402_CONTRACT=0x...

# Relayer 配置
RELAYER_URL=https://relayer.example.com
RELAYER_API_KEY=...

# Off-Ramp 提供商
COINBASE_API_KEY=...
BRIDGE_API_KEY=...

# 数据库
DATABASE_URL=postgresql://...

# Go 微服务
GO_SERVICE_URL=http://localhost:8080
```

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes 部署

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: protocol-banks
spec:
  replicas: 3
  selector:
    matchLabels:
      app: protocol-banks
  template:
    metadata:
      labels:
        app: protocol-banks
    spec:
      containers:
      - name: protocol-banks
        image: protocol-banks:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## 🧪 测试策略

### 单元测试

```typescript
// services/__tests__/file-parser.service.test.ts
import { FileParserService } from '../file-parser.service'

describe('FileParserService', () => {
  it('should parse CSV file correctly', async () => {
    const service = new FileParserService()
    const file = new File(['address,amount\n0x123,100'], 'test.csv')
    
    const result = await service.parse(file)
    
    expect(result.success).toBe(true)
    expect(result.recipients).toHaveLength(1)
    expect(result.recipients[0].address).toBe('0x123')
  })
  
  it('should detect invalid addresses', async () => {
    const service = new FileParserService()
    const file = new File(['address,amount\ninvalid,100'], 'test.csv')
    
    const result = await service.parse(file)
    
    expect(result.errors).toContain('Invalid address')
  })
})
```

### 集成测试

```typescript
// __tests__/batch-payment.integration.test.ts
import { POST as uploadHandler } from '@/app/api/batch-payment/upload/route'

describe('Batch Payment Integration', () => {
  it('should upload and validate batch payment', async () => {
    const formData = new FormData()
    formData.append('file', new File(['...'], 'test.csv'))
    
    const request = new Request('http://localhost/api/batch-payment/upload', {
      method: 'POST',
      body: formData
    })
    
    const response = await uploadHandler(request)
    const data = await response.json()
    
    expect(data.success).toBe(true)
  })
})
```

### E2E 测试

```typescript
// e2e/batch-payment.spec.ts
import { test, expect } from '@playwright/test'

test('complete batch payment flow', async ({ page }) => {
  await page.goto('/batch-payment')
  
  // 上传文件
  await page.setInputFiles('input[type="file"]', 'test.csv')
  await page.click('button:has-text("Upload")')
  
  // 等待验证
  await page.waitForSelector('text=Validation Complete')
  
  // 查看费用
  await page.click('button:has-text("View Fees")')
  
  // 确认支付
  await page.click('button:has-text("Confirm Payment")')
  
  // 等待成功
  await expect(page).toHaveURL(/.*success/)
})
```

---

## 📊 监控与告警

### Prometheus 指标

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'protocol-banks'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

### 自定义指标

```typescript
// lib/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client'

export const paymentCounter = new Counter({
  name: 'payments_total',
  help: 'Total number of payments',
  labelNames: ['status', 'chain']
})

export const paymentDuration = new Histogram({
  name: 'payment_duration_seconds',
  help: 'Payment processing duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
})

export const activePayments = new Gauge({
  name: 'active_payments',
  help: 'Number of active payments'
})
```

### 告警规则

```yaml
# alerts.yml
groups:
  - name: protocol-banks
    rules:
      - alert: HighErrorRate
        expr: rate(payments_total{status="failed"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High payment error rate"
      
      - alert: SlowPayments
        expr: histogram_quantile(0.95, payment_duration_seconds) > 5
        for: 10m
        annotations:
          summary: "Payment processing is slow"
```

---

## 🔐 安全最佳实践

### 1. 私钥管理

```typescript
// lib/key-management.ts
import { Shamir } from 'shamir-secret-sharing'

export class KeyManager {
  // 创建 Shamir 分片
  async createShares(privateKey: string, pin: string) {
    // 1. 使用 PIN 派生密钥
    const derivedKey = await this.deriveKey(pin)
    
    // 2. 加密私钥
    const encrypted = await this.encrypt(privateKey, derivedKey)
    
    // 3. 创建 Shamir 分片 (2-of-3)
    const shares = Shamir.split(encrypted, 3, 2)
    
    return {
      shareA: shares[0], // 设备存储
      shareB: shares[1], // 服务器存储
      shareC: shares[2]  // 恢复码
    }
  }
  
  // 重建私钥
  async reconstructKey(shareA: string, shareB: string, pin: string) {
    // 1. 使用 PIN 派生密钥
    const derivedKey = await this.deriveKey(pin)
    
    // 2. 重建加密数据
    const encrypted = Shamir.combine([shareA, shareB])
    
    // 3. 解密私钥
    const privateKey = await this.decrypt(encrypted, derivedKey)
    
    // 4. 销毁派生密钥
    this.zeroMemory(derivedKey)
    
    return privateKey
  }
  
  private zeroMemory(data: any) {
    // 清零内存
    if (typeof data === 'string') {
      data = data.replace(/./g, '\0')
    }
  }
}
```

### 2. 交易验证

```typescript
// lib/transaction-validator.ts
export class TransactionValidator {
  async validateBatchPayment(batch: BatchPayment) {
    // 1. 验证所有收款人地址
    for (const item of batch.items) {
      if (!this.isValidAddress(item.recipient)) {
        throw new Error(`Invalid address: ${item.recipient}`)
      }
    }
    
    // 2. 验证总金额
    const total = batch.items.reduce((sum, item) => 
      sum + BigInt(item.amount), 0n
    )
    if (total > batch.walletBalance) {
      throw new Error('Insufficient balance')
    }
    
    // 3. 验证费用
    const expectedFee = this.calculateFee(batch)
    if (batch.fee !== expectedFee) {
      throw new Error('Fee mismatch')
    }
    
    return true
  }
  
  private isValidAddress(address: string): boolean {
    // EIP-55 校验和验证
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
}
```

### 3. 速率限制

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true
})

export async function rateLimitMiddleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
}
```

---

## 🚀 性能优化技巧

### 1. 批量数据库操作

```typescript
// services/batch-payment.service.ts
async submitBatch(items: PaymentItem[]) {
  // ❌ 不好: 逐个插入
  for (const item of items) {
    await db.insert('payment_items', item)
  }
  
  // ✅ 好: 批量插入
  await db.insert('payment_items', items)
}
```

### 2. 缓存策略

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis()

export async function getCachedTokenMetadata(tokenAddress: string) {
  // 1. 检查缓存
  const cached = await redis.get(`token:${tokenAddress}`)
  if (cached) return cached
  
  // 2. 从链上获取
  const metadata = await fetchTokenMetadata(tokenAddress)
  
  // 3. 缓存 1 小时
  await redis.setex(`token:${tokenAddress}`, 3600, metadata)
  
  return metadata
}
```

### 3. 并发处理

```typescript
// services/batch-validator.service.ts
async validateBatch(items: PaymentItem[]) {
  // 使用 Promise.all 并发验证
  const results = await Promise.all(
    items.map(item => this.validateItem(item))
  )
  
  return results
}
```

---

## 📋 故障排查指南

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 交易失败 | Gas 不足 | 增加 Gas 限制或使用 Relayer |
| Nonce 冲突 | 并发交易 | 使用 Nonce 管理服务 |
| 签名无效 | 消息格式错误 | 验证 EIP-712 域分隔符 |
| 超时 | 网络拥堵 | 增加 Gas 价格或重试 |
| 余额不足 | 账户余额低 | 充值或使用 Off-Ramp |

### 调试技巧

```typescript
// 启用详细日志
process.env.DEBUG = 'protocol-banks:*'

// 使用 ethers.js 调试
import { ethers } from 'ethers'
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.DEBUG)

// 检查交易状态
const tx = await provider.getTransaction(txHash)
console.log('Transaction:', tx)

// 检查收据
const receipt = await provider.getTransactionReceipt(txHash)
console.log('Receipt:', receipt)
```

---

## 📚 相关资源

- [EIP-712 规范](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-3009 规范](https://eips.ethereum.org/EIPS/eip-3009)
- [Shamir 秘密分享](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing)
- [ethers.js 文档](https://docs.ethers.org/)
- [Supabase 文档](https://supabase.com/docs)
