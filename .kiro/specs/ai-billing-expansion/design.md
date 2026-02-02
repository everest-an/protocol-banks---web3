# AI 计费与微支付系统 - 设计文档

**版本**: 1.0  
**日期**: 2026-02-02

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户层                                    │
├─────────────────────────────────────────────────────────────────┤
│  Web App  │  AI Agent  │  DePIN Device  │  API Client          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PB-Stream 微支付网关                          │
├─────────────────────────────────────────────────────────────────┤
│  HTTP 402 拦截器  │  Session Key 验证  │  计费累积器           │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PB-Guard        │  │  PB-Rail     │  │  Sentinel AI     │
│  会话密钥管理     │  │  结算引擎    │  │  风控引擎        │
└──────────────────┘  └──────────────┘  └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    数据层 & 区块链                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  ZetaChain  │  State Channels        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心模块设计

### 2.1 PB-Stream 微支付网关

#### 2.1.1 HTTP 402 中间件

**Node.js 实现**:
```typescript
// lib/middleware/pb-stream.ts
import { Request, Response, NextFunction } from 'express'
import { verifySessionKey } from './session-key-verifier'
import { recordUsage } from './usage-recorder'

export function pbStreamMiddleware(options: {
  ratePerCall: string  // "0.01" USDC
  service: string
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionKey = req.headers['x-session-key'] as string
    
    if (!sessionKey) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Please provide a valid session key',
        paymentInfo: {
          service: options.service,
          rate: options.ratePerCall,
          currency: 'USDC'
        }
      })
    }
    
    // 验证 Session Key
    const validation = await verifySessionKey(sessionKey)
    if (!validation.valid) {
      return res.status(403).json({
        error: 'Invalid Session Key',
        reason: validation.reason
      })
    }
    
    // 检查余额
    if (validation.remainingBalance < parseFloat(options.ratePerCall)) {
      return res.status(402).json({
        error: 'Insufficient Balance',
        required: options.ratePerCall,
        available: validation.remainingBalance
      })
    }
    
    // 记录使用（链下累积）
    await recordUsage({
      sessionKey,
      amount: options.ratePerCall,
      service: options.service,
      timestamp: new Date()
    })
    
    // 放行请求
    next()
  }
}
```

**Go 实现**:
```go
// services/pb-stream/middleware.go
package pbstream

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

type StreamMiddleware struct {
    RatePerCall string
    Service     string
    Verifier    *SessionKeyVerifier
    Recorder    *UsageRecorder
}

func (m *StreamMiddleware) Handle() gin.HandlerFunc {
    return func(c *gin.Context) {
        sessionKey := c.GetHeader("X-Session-Key")
        
        if sessionKey == "" {
            c.JSON(402, gin.H{
                "error": "Payment Required",
                "paymentInfo": gin.H{
                    "service": m.Service,
                    "rate": m.RatePerCall,
                },
            })
            c.Abort()
            return
        }
        
        // 验证 Session Key
        validation, err := m.Verifier.Verify(sessionKey)
        if err != nil || !validation.Valid {
            c.JSON(403, gin.H{"error": "Invalid Session Key"})
            c.Abort()
            return
        }
        
        // 记录使用
        m.Recorder.Record(UsageRecord{
            SessionKey: sessionKey,
            Amount:     m.RatePerCall,
            Service:    m.Service,
        })
        
        c.Next()
    }
}
```

#### 2.1.2 状态通道累积器

```go
// services/pb-stream/accumulator.go
package pbstream

import (
    "context"
    "github.com/go-redis/redis/v8"
    "time"
)

type UsageAccumulator struct {
    redis     *redis.Client
    threshold float64  // 累积到此金额后上链
}

func (a *UsageAccumulator) Accumulate(sessionKey string, amount float64) error {
    ctx := context.Background()
    
    // Redis 原子增加
    key := "usage:" + sessionKey
    newTotal, err := a.redis.IncrByFloat(ctx, key, amount).Result()
    if err != nil {
        return err
    }
    
    // 检查是否达到阈值
    if newTotal >= a.threshold {
        // 触发链上结算
        go a.settleOnChain(sessionKey, newTotal)
        
        // 重置计数器
        a.redis.Set(ctx, key, 0, 24*time.Hour)
    }
    
    return nil
}

func (a *UsageAccumulator) settleOnChain(sessionKey string, amount float64) {
    // 调用智能合约结算
    // 更新数据库
    // 发送 Webhook 通知
}
```

---

### 2.2 PB-Guard 会话密钥系统

#### 2.2.1 Session Key 生成

```typescript
// lib/services/session-key-service.ts
import { ethers } from 'ethers'
import { prisma } from '@/lib/prisma'

export async function createSessionKey(params: {
  agentId: string
  permissions: {
    allowedContracts: string[]
    maxAmount: string
    expiresIn: number  // 秒
  }
}) {
  // 生成临时密钥对
  const wallet = ethers.Wallet.createRandom()
  
  // 计算过期时间
  const expiresAt = new Date(Date.now() + params.permissions.expiresIn * 1000)
  
  // 存储到数据库
  const sessionKey = await prisma.sessionKey.create({
    data: {
      agentId: params.agentId,
      publicKey: wallet.address,
      privateKeyEncrypted: encryptPrivateKey(wallet.privateKey),
      permissions: params.permissions,
      limitAmount: params.permissions.maxAmount,
      expiresAt
    }
  })
  
  // 在链上注册 Session Key
  await registerSessionKeyOnChain({
    agentAddress: agent.walletAddress,
    sessionKey: wallet.address,
    permissions: params.permissions
  })
  
  return {
    sessionKey: wallet.privateKey,  // 只返回一次
    publicKey: wallet.address,
    expiresAt
  }
}
```

#### 2.2.2 智能合约设计

```solidity
// contracts/SessionKeyValidator.sol
pragma solidity ^0.8.20;

contract SessionKeyValidator {
    struct SessionKey {
        address owner;
        uint256 limitAmount;
        uint256 currentUsage;
        uint256 expiresAt;
        bool isFrozen;
        address[] allowedContracts;
    }
    
    mapping(address => SessionKey) public sessionKeys;
    
    event SessionKeyCreated(address indexed sessionKey, address indexed owner);
    event UsageRecorded(address indexed sessionKey, uint256 amount);
    event SessionKeyFrozen(address indexed sessionKey, string reason);
    
    function createSessionKey(
        address _sessionKey,
        uint256 _limitAmount,
        uint256 _duration,
        address[] memory _allowedContracts
    ) external {
        require(sessionKeys[_sessionKey].owner == address(0), "Key exists");
        
        sessionKeys[_sessionKey] = SessionKey({
            owner: msg.sender,
            limitAmount: _limitAmount,
            currentUsage: 0,
            expiresAt: block.timestamp + _duration,
            isFrozen: false,
            allowedContracts: _allowedContracts
        });
        
        emit SessionKeyCreated(_sessionKey, msg.sender);
    }
    
    function validateAndRecord(
        address _sessionKey,
        uint256 _amount,
        address _targetContract
    ) external returns (bool) {
        SessionKey storage key = sessionKeys[_sessionKey];
        
        // 验证
        require(key.owner != address(0), "Invalid key");
        require(!key.isFrozen, "Key frozen");
        require(block.timestamp < key.expiresAt, "Key expired");
        require(key.currentUsage + _amount <= key.limitAmount, "Limit exceeded");
        require(isAllowedContract(key, _targetContract), "Contract not allowed");
        
        // 记录使用
        key.currentUsage += _amount;
        emit UsageRecorded(_sessionKey, _amount);
        
        return true;
    }
    
    function freezeSessionKey(address _sessionKey, string memory _reason) external {
        SessionKey storage key = sessionKeys[_sessionKey];
        require(msg.sender == key.owner || msg.sender == address(this), "Unauthorized");
        
        key.isFrozen = true;
        emit SessionKeyFrozen(_sessionKey, _reason);
    }
    
    function isAllowedContract(SessionKey storage key, address target) internal view returns (bool) {
        for (uint i = 0; i < key.allowedContracts.length; i++) {
            if (key.allowedContracts[i] == target) return true;
        }
        return false;
    }
}
```

---

### 2.3 Sentinel AI 风控引擎

#### 2.3.1 规则引擎

```go
// services/sentinel/rule_engine.go
package sentinel

type Rule struct {
    ID          string
    Name        string
    Condition   func(session *StreamSession) bool
    Action      func(session *StreamSession) error
    Severity    string  // low, medium, high, critical
}

type RuleEngine struct {
    rules []Rule
}

func NewRuleEngine() *RuleEngine {
    return &RuleEngine{
        rules: []Rule{
            // 规则 1: 单次金额异常
            {
                ID:   "R001",
                Name: "Single Amount Anomaly",
                Condition: func(s *StreamSession) bool {
                    return s.LastPaymentAmount > s.AverageAmount * 10
                },
                Action: func(s *StreamSession) error {
                    return freezeSessionKey(s.SessionKeyID, "Abnormal single payment")
                },
                Severity: "high",
            },
            
            // 规则 2: 频率异常
            {
                ID:   "R002",
                Name: "Frequency Anomaly",
                Condition: func(s *StreamSession) bool {
                    return s.CallsPerMinute > 100
                },
                Action: func(s *StreamSession) error {
                    return freezeSessionKey(s.SessionKeyID, "Abnormal call frequency")
                },
                Severity: "medium",
            },
            
            // 规则 3: 余额耗尽预警
            {
                ID:   "R003",
                Name: "Low Balance Warning",
                Condition: func(s *StreamSession) bool {
                    remaining := s.LimitAmount - s.CurrentUsage
                    return remaining < s.LimitAmount * 0.1  // 剩余 < 10%
                },
                Action: func(s *StreamSession) error {
                    return sendAlert(s.OwnerAddress, "Low balance warning")
                },
                Severity: "low",
            },
        },
    }
}

func (e *RuleEngine) Evaluate(session *StreamSession) []RuleViolation {
    violations := []RuleViolation{}
    
    for _, rule := range e.rules {
        if rule.Condition(session) {
            // 执行动作
            err := rule.Action(session)
            
            violations = append(violations, RuleViolation{
                RuleID:   rule.ID,
                RuleName: rule.Name,
                Severity: rule.Severity,
                Error:    err,
            })
        }
    }
    
    return violations
}
```

#### 2.3.2 异常检测

```go
// services/sentinel/anomaly_detector.go
package sentinel

import (
    "math"
)

type AnomalyDetector struct {
    // 基于历史数据的基准线
    baseline map[string]*Baseline
}

type Baseline struct {
    AverageAmount    float64
    StdDeviation     float64
    AverageFrequency float64
    SampleSize       int
}

func (d *AnomalyDetector) DetectAnomaly(sessionKey string, currentAmount float64, currentFreq float64) bool {
    baseline, exists := d.baseline[sessionKey]
    if !exists {
        // 新 Session Key，建立基准线
        d.baseline[sessionKey] = &Baseline{
            AverageAmount:    currentAmount,
            AverageFrequency: currentFreq,
            SampleSize:       1,
        }
        return false
    }
    
    // Z-Score 异常检测
    zScore := (currentAmount - baseline.AverageAmount) / baseline.StdDeviation
    
    // 如果 Z-Score > 3，认为是异常
    if math.Abs(zScore) > 3.0 {
        return true
    }
    
    // 更新基准线
    d.updateBaseline(sessionKey, currentAmount, currentFreq)
    
    return false
}

func (d *AnomalyDetector) updateBaseline(sessionKey string, amount float64, freq float64) {
    baseline := d.baseline[sessionKey]
    n := float64(baseline.SampleSize)
    
    // 增量更新平均值
    newAvg := (baseline.AverageAmount*n + amount) / (n + 1)
    
    // 更新标准差
    newStdDev := math.Sqrt(
        (baseline.StdDeviation*baseline.StdDeviation*n + 
         math.Pow(amount-newAvg, 2)) / (n + 1),
    )
    
    baseline.AverageAmount = newAvg
    baseline.StdDeviation = newStdDev
    baseline.SampleSize++
}
```

---

## 3. 数据流设计

### 3.1 微支付流程

```
1. AI Agent 发起 API 请求
   ↓
2. PB-Stream 拦截请求
   ↓
3. 验证 Session Key (Redis 缓存)
   ↓
4. 检查余额 (Redis)
   ↓
5. 记录使用 (Redis INCRBY)
   ↓
6. 放行请求
   ↓
7. 后台累积器检查阈值
   ↓
8. 达到阈值 → 触发链上结算
   ↓
9. 更新数据库 (PostgreSQL)
   ↓
10. 发送 Webhook 通知
```

### 3.2 风控流程

```
1. Sentinel 监听所有支付事件
   ↓
2. 规则引擎评估
   ↓
3. 异常检测器分析
   ↓
4. 发现异常 → 触发熔断
   ↓
5. 冻结 Session Key (链上 + 数据库)
   ↓
6. 发送告警 (Telegram/Email/Webhook)
   ↓
7. 记录事件日志
```

---

## 4. API 设计

### 4.1 创建会话密钥

```http
POST /api/agents/{agentId}/session-keys
Authorization: Bearer {api_key}

{
  "permissions": {
    "allowedContracts": ["0x..."],
    "maxAmount": "50",
    "expiresIn": 2592000  // 30 天
  }
}

Response:
{
  "sessionKey": "0x...",  // 私钥，只返回一次
  "publicKey": "0x...",
  "expiresAt": "2026-03-04T00:00:00Z",
  "permissions": {...}
}
```

### 4.2 查询使用情况

```http
GET /api/session-keys/{publicKey}/usage

Response:
{
  "sessionKey": "0x...",
  "limitAmount": "50",
  "currentUsage": "12.34",
  "remainingBalance": "37.66",
  "callCount": 1234,
  "lastUsedAt": "2026-02-02T12:00:00Z",
  "status": "active"
}
```

### 4.3 冻结/解冻会话密钥

```http
POST /api/session-keys/{publicKey}/freeze
Authorization: Bearer {api_key}

{
  "reason": "Suspicious activity detected"
}

Response:
{
  "success": true,
  "frozenAt": "2026-02-02T12:00:00Z"
}
```

---

## 5. SDK 设计

### 5.1 Node.js SDK

```typescript
// @protocolbanks/stream-sdk
import { PBStream } from '@protocolbanks/stream-sdk'

const pbStream = new PBStream({
  apiKey: process.env.PB_API_KEY,
  service: 'my-ai-service',
  ratePerCall: '0.01'
})

// Express 中间件
app.use('/api/ai', pbStream.middleware())

// 手动验证
app.post('/api/custom', async (req, res) => {
  const validation = await pbStream.verify(req.headers['x-session-key'])
  if (!validation.valid) {
    return res.status(402).json({ error: 'Payment required' })
  }
  
  await pbStream.recordUsage(req.headers['x-session-key'], '0.05')
  res.json({ result: 'success' })
})
```

### 5.2 Python SDK

```python
# pip install protocolbanks-stream
from protocolbanks import PBStream

pb_stream = PBStream(
    api_key=os.getenv('PB_API_KEY'),
    service='my-ai-service',
    rate_per_call='0.01'
)

# Flask 装饰器
@app.route('/api/ai')
@pb_stream.require_payment
def ai_endpoint():
    return {'result': 'success'}

# FastAPI 依赖
from fastapi import Depends

@app.post('/api/ai')
async def ai_endpoint(session_key: str = Depends(pb_stream.verify)):
    await pb_stream.record_usage(session_key, 0.05)
    return {'result': 'success'}
```

---

## 6. 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Next.js (Vercel)│  │  Go Workers  │  │  Sentinel    │
│  - API Gateway   │  │  - Stream    │  │  - Rules     │
│  - Dashboard     │  │  - Billing   │  │  - Anomaly   │
└──────────────────┘  └──────────────┘  └──────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL      │  │  Redis       │  │  ZetaChain   │
│  (Neon/Supabase) │  │  (Upstash)   │  │  (Contracts) │
└──────────────────┘  └──────────────┘  └──────────────┘
```

---

## 7. 监控与告警

### 7.1 关键指标

- Session Key 创建数
- 微支付交易数
- 平均响应时间
- 异常检测触发次数
- 熔断事件数
- 链上结算成功率

### 7.2 告警规则

- 响应时间 > 500ms
- 错误率 > 1%
- Redis 连接失败
- 链上结算失败
- Sentinel 触发 critical 级别事件

---

## 8. 安全考虑

### 8.1 Session Key 安全

- 私钥只返回一次，不存储明文
- 支持密钥轮换
- 支持紧急撤销
- 所有操作需签名验证

### 8.2 防重放攻击

- 每个请求包含时间戳
- 验证时间窗口（5 分钟）
- Nonce 机制

### 8.3 DDoS 防护

- Cloudflare 防护
- Rate Limiting
- IP 黑名单

---

## 9. 测试策略

### 9.1 单元测试

- Session Key 生成和验证
- 规则引擎逻辑
- 异常检测算法

### 9.2 集成测试

- 完整支付流程
- 熔断机制
- 链上结算

### 9.3 压力测试

- 10,000 并发请求
- 100,000 微支付/小时
- Redis 性能测试

---

## 10. 文档与支持

### 10.1 开发者文档

- 快速开始指南
- API 参考
- SDK 文档
- 最佳实践

### 10.2 示例代码

- Node.js 示例
- Python 示例
- Go 示例
- 智能合约示例

### 10.3 故障排查

- 常见错误代码
- 调试指南
- 性能优化建议
