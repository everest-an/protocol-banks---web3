# 生产环境就绪 - 设计文档

**版本**: 1.0  
**日期**: 2026-02-03

---

## 1. 监控系统设计

### 1.1 Sentry 错误监控

#### 1.1.1 Next.js 集成

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  
  // 性能监控
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ["localhost", /^https:\/\/api\.protocolbanks\.com/],
    }),
  ],
  
  // 错误过滤
  beforeSend(event, hint) {
    // 过滤掉已知的非关键错误
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null
    }
    return event
  },
  
  // 用户上下文
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') {
      return null // 不记录 console 日志
    }
    return breadcrumb
  },
})
```

#### 1.1.2 Go 服务集成

```go
// services/shared/sentry.go
package shared

import (
    "github.com/getsentry/sentry-go"
    "time"
)

func InitSentry(dsn string, environment string) error {
    return sentry.Init(sentry.ClientOptions{
        Dsn:              dsn,
        Environment:      environment,
        TracesSampleRate: 1.0,
        BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
            // 添加自定义上下文
            event.Tags["service"] = "payout-engine"
            return event
        },
    })
}

func CaptureError(err error, context map[string]interface{}) {
    sentry.WithScope(func(scope *sentry.Scope) {
        for key, value := range context {
            scope.SetContext(key, value)
        }
        sentry.CaptureException(err)
    })
    sentry.Flush(2 * time.Second)
}
```

---

### 1.2 Prometheus 指标收集

#### 1.2.1 Next.js 指标导出

```typescript
// lib/monitoring/metrics.ts
import { Counter, Histogram, Registry } from 'prom-client'

export const register = new Registry()

// HTTP 请求计数器
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
})

// HTTP 请求延迟
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
})

// 支付成功率
export const paymentSuccessRate = new Counter({
  name: 'payment_success_total',
  help: 'Total number of successful payments',
  labelNames: ['chain', 'token'],
  registers: [register],
})

// 批量支付吞吐量
export const batchPaymentThroughput = new Histogram({
  name: 'batch_payment_throughput',
  help: 'Batch payment throughput (transactions per second)',
  buckets: [10, 50, 100, 500, 1000],
  registers: [register],
})
```

#### 1.2.2 指标导出端点

```typescript
// app/api/metrics/route.ts
import { NextResponse } from 'next/server'
import { register } from '@/lib/monitoring/metrics'

export async function GET() {
  const metrics = await register.metrics()
  
  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
    },
  })
}
```

#### 1.2.3 Go 服务指标

```go
// services/shared/metrics.go
package shared

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // 支付处理时间
    PaymentProcessingDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "payment_processing_duration_seconds",
            Help:    "Payment processing duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"chain", "token"},
    )
    
    // 并发支付数
    ConcurrentPayments = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "concurrent_payments",
            Help: "Number of concurrent payment operations",
        },
    )
    
    // 失败重试次数
    PaymentRetries = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "payment_retries_total",
            Help: "Total number of payment retries",
        },
        []string{"reason"},
    )
)
```

---

### 1.3 Grafana 仪表盘

#### 1.3.1 仪表盘配置

```json
{
  "dashboard": {
    "title": "Protocol Banks - Production Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "rate(payment_success_total[5m])",
            "legendFormat": "{{chain}} - {{token}}"
          }
        ]
      }
    ]
  }
}
```

---

### 1.4 告警系统

#### 1.4.1 Alertmanager 配置

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:3000/api/alerts/webhook'
  
  - name: 'critical-alerts'
    telegram_configs:
      - bot_token: '${TELEGRAM_BOT_TOKEN}'
        chat_id: ${TELEGRAM_CHAT_ID}
        message: |
          🚨 Critical Alert
          Alert: {{ .GroupLabels.alertname }}
          Summary: {{ .CommonAnnotations.summary }}
    email_configs:
      - to: 'ops@protocolbanks.com'
        from: 'alerts@protocolbanks.com'
        smarthost: 'smtp.gmail.com:587'
  
  - name: 'warning-alerts'
    webhook_configs:
      - url: 'http://localhost:3000/api/alerts/webhook'
```

#### 1.4.2 告警规则

```yaml
# prometheus-rules.yml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # 高错误率
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected ({{ $value }})"
          description: "Error rate is above 5% for 5 minutes"
      
      # 慢响应时间
      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API response time is slow ({{ $value }}s)"
      
      # 支付失败率高
      - alert: HighPaymentFailureRate
        expr: |
          rate(payment_failures_total[5m]) / 
          rate(payment_attempts_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Payment failure rate is high ({{ $value }})"
      
      # 数据库连接池耗尽
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          database_connections_active / 
          database_connections_max > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool is nearly exhausted"
      
      # Redis 连接失败
      - alert: RedisConnectionFailure
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis connection is down"
```

---

## 2. 测试系统设计

### 2.1 单元测试框架

#### 2.1.1 Jest 配置

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
```

#### 2.1.2 测试工具函数

```typescript
// lib/test-utils/test-helpers.ts
import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

export function createMockRequest(options: any = {}) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>(options)
  return { req, res }
}

export function mockSupabaseClient() {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
}

export function mockEthersProvider() {
  return {
    getBalance: jest.fn().mockResolvedValue(ethers.parseEther('10')),
    getTransactionCount: jest.fn().mockResolvedValue(0),
    estimateGas: jest.fn().mockResolvedValue(21000n),
    sendTransaction: jest.fn().mockResolvedValue({
      hash: '0x123...',
      wait: jest.fn().mockResolvedValue({ status: 1 }),
    }),
  }
}
```

### 2.2 集成测试

#### 2.2.1 API 端点测试

```typescript
// app/api/payments/__tests__/create.test.ts
import { POST } from '../route'
import { createMockRequest } from '@/lib/test-utils/test-helpers'

describe('POST /api/payments', () => {
  it('should create a payment successfully', async () => {
    const { req } = createMockRequest({
      method: 'POST',
      body: {
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: '100',
        token: 'USDC',
        chain_id: 137,
      },
      headers: {
        'authorization': 'Bearer test-api-key',
      },
    })
    
    const response = await POST(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('tx_hash')
    expect(data.status).toBe('pending')
  })
  
  it('should reject invalid recipient address', async () => {
    const { req } = createMockRequest({
      method: 'POST',
      body: {
        recipient: 'invalid-address',
        amount: '100',
        token: 'USDC',
        chain_id: 137,
      },
    })
    
    const response = await POST(req)
    
    expect(response.status).toBe(400)
  })
})
```

### 2.3 E2E 测试

#### 2.3.1 Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

#### 2.3.2 支付流程 E2E 测试

```typescript
// e2e/payment-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Payment Flow', () => {
  test('should complete single payment', async ({ page }) => {
    // 登录
    await page.goto('/auth/signin')
    await page.fill('[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')
    
    // 等待登录完成
    await page.waitForURL('/dashboard')
    
    // 导航到支付页面
    await page.goto('/pay')
    
    // 填写支付表单
    await page.fill('[name="recipient"]', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')
    await page.fill('[name="amount"]', '100')
    await page.selectOption('[name="token"]', 'USDC')
    await page.selectOption('[name="chain"]', '137')
    
    // 提交支付
    await page.click('button:has-text("Send Payment")')
    
    // 等待确认
    await expect(page.locator('text=Payment Successful')).toBeVisible()
    
    // 验证交易哈希
    const txHash = await page.locator('[data-testid="tx-hash"]').textContent()
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
  
  test('should complete batch payment', async ({ page }) => {
    await page.goto('/batch-payment')
    
    // 上传 CSV 文件
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./fixtures/batch-payment.csv')
    
    // 等待验证完成
    await expect(page.locator('text=Validation Complete')).toBeVisible()
    
    // 查看摘要
    const recipientCount = await page.locator('[data-testid="recipient-count"]').textContent()
    expect(recipientCount).toBe('10')
    
    // 执行批量支付
    await page.click('button:has-text("Execute Batch Payment")')
    
    // 等待完成
    await expect(page.locator('text=Batch Payment Complete')).toBeVisible({ timeout: 60000 })
  })
})
```

---

## 3. 安全系统设计

### 3.1 密钥轮换机制

#### 3.1.1 自动轮换脚本

```typescript
// scripts/rotate-api-keys.ts
import { createClient } from '@supabase/supabase-js'
import { hashApiKey } from '@/lib/hash-key'
import crypto from 'crypto'

async function rotateApiKeys() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // 查找需要轮换的密钥（90 天以上）
  const { data: keysToRotate } = await supabase
    .from('api_keys')
    .select('*')
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .eq('status', 'active')
  
  for (const key of keysToRotate || []) {
    // 生成新密钥
    const newKey = `pb_${crypto.randomBytes(32).toString('hex')}`
    const hashedKey = await hashApiKey(newKey)
    
    // 更新数据库
    await supabase
      .from('api_keys')
      .update({
        key_hash: hashedKey,
        rotated_at: new Date().toISOString(),
      })
      .eq('id', key.id)
    
    // 发送通知给用户
    await sendKeyRotationNotification(key.user_id, newKey)
    
    console.log(`Rotated API key for user ${key.user_id}`)
  }
}

async function sendKeyRotationNotification(userId: string, newKey: string) {
  // 发送邮件通知
  // 实现邮件发送逻辑
}

// 定时任务（每天运行）
rotateApiKeys().catch(console.error)
```

### 3.2 HashiCorp Vault 集成

```typescript
// lib/vault/client.ts
import vault from 'node-vault'

export class VaultClient {
  private client: any
  
  constructor() {
    this.client = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    })
  }
  
  async getSecret(path: string): Promise<any> {
    try {
      const result = await this.client.read(path)
      return result.data
    } catch (error) {
      console.error('Failed to read secret from Vault:', error)
      throw error
    }
  }
  
  async setSecret(path: string, data: any): Promise<void> {
    try {
      await this.client.write(path, { data })
    } catch (error) {
      console.error('Failed to write secret to Vault:', error)
      throw error
    }
  }
  
  async rotateSecret(path: string): Promise<string> {
    const newSecret = crypto.randomBytes(32).toString('hex')
    await this.setSecret(path, { value: newSecret })
    return newSecret
  }
}

export const vaultClient = new VaultClient()
```

---

## 4. 用户体验设计

### 4.1 新手引导系统

```typescript
// components/onboarding/onboarding-tour.tsx
'use client'

import { useState } from 'react'
import Joyride, { Step } from 'react-joyride'

const steps: Step[] = [
  {
    target: '[data-tour="wallet-connect"]',
    content: '首先，连接你的钱包以开始使用 Protocol Banks',
    disableBeacon: true,
  },
  {
    target: '[data-tour="balance"]',
    content: '这里显示你的余额和资产分布',
  },
  {
    target: '[data-tour="send-payment"]',
    content: '点击这里发送单笔支付',
  },
  {
    target: '[data-tour="batch-payment"]',
    content: '或者使用批量支付功能一次性支付多个收款人',
  },
  {
    target: '[data-tour="agents"]',
    content: '创建 AI Agent 来自动化你的支付流程',
  },
]

export function OnboardingTour() {
  const [run, setRun] = useState(true)
  
  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      styles={{
        options: {
          primaryColor: '#3b82f6',
        },
      }}
      callback={(data) => {
        if (data.status === 'finished' || data.status === 'skipped') {
          setRun(false)
          localStorage.setItem('onboarding-completed', 'true')
        }
      }}
    />
  )
}
```

### 4.2 错误处理优化

```typescript
// lib/errors/error-handler.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public userMessage: string,
    public solution?: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ErrorCodes = {
  INSUFFICIENT_BALANCE: {
    code: 'INSUFFICIENT_BALANCE',
    message: 'Insufficient balance for transaction',
    userMessage: '余额不足',
    solution: '请充值或减少支付金额',
    statusCode: 400,
  },
  INVALID_ADDRESS: {
    code: 'INVALID_ADDRESS',
    message: 'Invalid recipient address',
    userMessage: '收款地址无效',
    solution: '请检查地址格式是否正确',
    statusCode: 400,
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    userMessage: '网络连接失败',
    solution: '请检查网络连接后重试',
    statusCode: 503,
  },
}

export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.userMessage,
      solution: error.solution,
      statusCode: error.statusCode,
    }
  }
  
  // 未知错误
  return {
    code: 'UNKNOWN_ERROR',
    message: '发生未知错误',
    solution: '请稍后重试或联系支持团队',
    statusCode: 500,
  }
}
```

---

## 5. 文档系统设计

### 5.1 OpenAPI 规范

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Protocol Banks API
  version: 2.0.0
  description: Web3 Programmable Commerce Infrastructure

servers:
  - url: https://api.protocolbanks.com
    description: Production
  - url: http://localhost:3000
    description: Development

paths:
  /api/payments:
    post:
      summary: Create a payment
      tags:
        - Payments
      security:
        - ApiKeyAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePaymentRequest'
      responses:
        '200':
          description: Payment created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: Authorization
      
  schemas:
    CreatePaymentRequest:
      type: object
      required:
        - recipient
        - amount
        - token
        - chain_id
      properties:
        recipient:
          type: string
          example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        amount:
          type: string
          example: "100"
        token:
          type: string
          enum: [USDC, USDT, DAI, WETH]
        chain_id:
          type: integer
          example: 137
        reason:
          type: string
          example: "Invoice payment"
    
    PaymentResponse:
      type: object
      properties:
        id:
          type: string
        tx_hash:
          type: string
        status:
          type: string
          enum: [pending, confirmed, failed]
        created_at:
          type: string
          format: date-time
```

---

## 6. CI/CD 流程设计

### 6.1 GitHub Actions 工作流

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run linter
        run: pnpm lint
      
      - name: Run unit tests
        run: pnpm test:unit
      
      - name: Run integration tests
        run: pnpm test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Run E2E tests
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
  
  deploy:
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 7. 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Vercel      │  │  Kubernetes  │  │  Supabase    │      │
│  │  (Next.js)   │  │  (Go)        │  │  (Database)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Sentry      │  │  Prometheus  │  │  Grafana     │      │
│  │  (Errors)    │  │  (Metrics)   │  │  (Dashboard) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

