# Protocol Banks - AI 计费与微支付功能文档

**版本**: 2.0  
**日期**: 2026-02-02  
**状态**: 规划中

---

## 1. 产品定位升级

Protocol Banks 从 **"企业薪酬工具"** 升级为 **"Web3 可编程商业基础设施"**

### 核心价值主张

> **Stream Money like Data**  
> 让资金像数据一样流动。支持动态定价、按量计费与 AI 风控的下一代支付协议。

---

## 2. 五层协议栈 (The 5-Layer Stack)

| 层级 | 模块名 | 功能定义 | 现状 |
|------|--------|----------|------|
| **L1** | **PB-Link** | 身份认证 (DID, Wallet Connect) | ✅ 已完成 |
| **L2** | **PB-Guard** | 授权管理 (Session Keys, Multi-sig) | 🟡 需增强 |
| **L3** | **PB-Stream** | 流支付通信 (HTTP 402, Invoicing) | 🔴 新增 |
| **L4** | **PB-Rail** | 全链结算 (ZetaChain, Rain) | ✅ 已完成 |
| **L5** | **PB-Proof** | 审计存证 (ZKP, PDF) | ✅ 已完成 |

---

## 3. 新增核心功能

### 3.1 PB-Stream 微支付网关

**解决问题**: AI 服务商无法按量收费，订阅制门槛高

**核心功能**:
- **HTTP 402 协议**: 拦截 API 请求，要求支付后放行
- **状态通道**: 链下累积微小金额，达到阈值后上链结算
- **动态费率**: 支持高峰期加价、使用量阶梯定价
- **SDK 支持**: Node.js, Python, Go 中间件

**使用场景**:
```typescript
// AI 公司集成示例
import { PBStream } from '@protocolbanks/stream-sdk'

const pbStream = new PBStream({
  apiKey: process.env.PB_API_KEY,
  service: 'my-ai-service',
  ratePerCall: '0.01'  // 每次调用 0.01 USDC
})

// Express 中间件
app.use('/api/ai', pbStream.middleware())
```

**客户价值**:
- AI 公司: 按 Token 计费，提高转化率
- 用户: 用多少付多少，无需月费订阅

---

### 3.2 PB-Guard 会话密钥 (Session Keys)

**解决问题**: AI Agent 每次调用都要签名，体验差

**核心功能**:
- **一次授权**: 用户签名生成临时密钥
- **权限限制**: 设置金额上限、有效期、合约白名单
- **静默支付**: AI 调用 API 时无需弹窗
- **紧急冻结**: 检测异常立即停止扣费

**工作流程**:
```
1. 用户授权: "允许 AI 在 30 天内最多花费 50 U"
   ↓
2. 生成 Session Key (临时私钥)
   ↓
3. AI 携带 Session Key 调用 API
   ↓
4. 网关验证权限 → 自动扣费 → 放行请求
   ↓
5. Sentinel 监控异常 → 触发熔断
```

**客户价值**:
- 企业: 为 AI Agent 设置预算，防止费用失控
- 用户: 安全授权，随时可撤销

---

### 3.3 Sentinel AI 哨兵风控

**解决问题**: 担心 AI 把钱刷光，或被黑客盗用

**核心功能**:
- **规则引擎**: 硬性限制（单笔上限、频率上限）
- **异常检测**: 基于历史数据的 Z-Score 分析
- **自动熔断**: 检测到异常立即冻结 Session Key
- **多渠道告警**: Telegram, Email, Webhook

**规则示例**:
```go
// 规则 1: 单次金额异常
if currentAmount > averageAmount * 10 {
    freezeSessionKey("Abnormal single payment")
}

// 规则 2: 频率异常
if callsPerMinute > 100 {
    freezeSessionKey("Abnormal call frequency")
}

// 规则 3: 余额预警
if remainingBalance < limitAmount * 0.1 {
    sendAlert("Low balance warning")
}
```

**客户价值**:
- 用户: 资金安全保障
- 商户: 防止 API 被刷爆

---

### 3.4 动态流支付 (Stream Payments)

**解决问题**: DePIN 项目需要实时按使用量扣费

**核心功能**:
- **实时计费**: 按秒/按分钟/按使用量扣费
- **动态费率**: 高峰期自动调价
- **自动结算**: 用户停止使用时自动结算
- **费率预言机**: 商户可传入动态参数

**使用场景**:
- **Web3 租车**: 按分钟计费，高峰期 x1.5
- **GPU 算力**: 按秒计费，不同型号不同价格
- **链上保险**: 按天购买，随时停止

**工作流程**:
```
1. 用户开始使用服务 (如租车)
   ↓
2. 启动计费会话 (Session)
   ↓
3. 每分钟记录使用量 (链下累积)
   ↓
4. 用户停止使用
   ↓
5. 自动结算总费用 (上链)
   ↓
6. 生成 PDF 账单
```

---

## 4. 目标客户扩展

### 现有客户 (已服务)
- **Web3 企业**: 发工资、批量支付
- **DAO**: 财务管理、多签审批

### 新增客户 (待拓展)

#### 4.1 AI 服务商
- **痛点**: 订阅制门槛高，转化率低
- **解决方案**: PB-Stream 按量计费
- **案例**: OpenAI, Anthropic, Midjourney

#### 4.2 DePIN 项目
- **痛点**: 需要押金，结算周期长
- **解决方案**: 动态流支付
- **案例**: 共享充电宝、Web3 租车、去中心化存储

#### 4.3 GPU 算力平台
- **痛点**: 客户用 USDT 付款，平台需要法币
- **解决方案**: 自动兑换 + 虚拟卡
- **案例**: Akash, Render Network

#### 4.4 API 市场
- **痛点**: 无法处理微支付
- **解决方案**: HTTP 402 网关
- **案例**: 天气数据、金融数据、区块链索引

---

## 5. 技术架构升级

### 5.1 新增数据模型

```prisma
// Session Key (会话密钥)
model SessionKey {
  id           String   @id @default(uuid())
  agentId      String
  publicKey    String   @unique
  permissions  Json     // 权限配置
  limitAmount  Decimal  // 总限额
  currentUsage Decimal  @default(0)
  expiresAt    DateTime
  isFrozen     Boolean  @default(false)
}

// Stream Session (流支付会话)
model StreamSession {
  id           String   @id @default(uuid())
  sessionKeyId String
  serviceId    String
  startTime    DateTime
  endTime      DateTime?
  ratePerUnit  Decimal
  totalUnits   Decimal  @default(0)
  totalAmount  Decimal  @default(0)
  status       String   // active, paused, completed
}

// Micro Payment (微支付记录)
model MicroPayment {
  id           String   @id @default(uuid())
  sessionId    String
  amount       Decimal
  timestamp    DateTime @default(now())
  settled      Boolean  @default(false)
  txHash       String?
}

// Sentinel Event (风控事件)
model SentinelEvent {
  id           String   @id @default(uuid())
  sessionKeyId String
  eventType    String   // anomaly_detected, circuit_breaker_triggered
  severity     String   // low, medium, high, critical
  details      Json
  action       String   // freeze, alert, block
  createdAt    DateTime @default(now())
}
```

### 5.2 新增智能合约

```solidity
// SessionKeyValidator.sol
contract SessionKeyValidator {
    struct SessionKey {
        address owner;
        uint256 limitAmount;
        uint256 currentUsage;
        uint256 expiresAt;
        bool isFrozen;
        address[] allowedContracts;
    }
    
    function createSessionKey(...) external;
    function validateAndRecord(...) external returns (bool);
    function freezeSessionKey(...) external;
}
```

### 5.3 新增 Go 服务

```
services/
├── pb-stream/          # 微支付网关
│   ├── middleware.go   # HTTP 402 拦截器
│   ├── verifier.go     # Session Key 验证
│   └── accumulator.go  # 状态通道累积器
├── sentinel/           # 风控引擎
│   ├── rule_engine.go  # 规则引擎
│   ├── anomaly.go      # 异常检测
│   └── circuit.go      # 熔断机制
```

---

## 6. SDK 与集成

### 6.1 Node.js SDK

```bash
npm install @protocolbanks/stream-sdk
```

```typescript
import { PBStream } from '@protocolbanks/stream-sdk'

const pbStream = new PBStream({
  apiKey: process.env.PB_API_KEY,
  service: 'my-service',
  ratePerCall: '0.01'
})

// Express
app.use('/api', pbStream.middleware())

// NestJS
@UseGuards(PBStreamGuard)
@Controller('api')
export class ApiController {}
```

### 6.2 Python SDK

```bash
pip install protocolbanks-stream
```

```python
from protocolbanks import PBStream

pb_stream = PBStream(
    api_key=os.getenv('PB_API_KEY'),
    service='my-service',
    rate_per_call='0.01'
)

# Flask
@app.route('/api')
@pb_stream.require_payment
def api_endpoint():
    return {'result': 'success'}

# FastAPI
@app.post('/api')
async def api_endpoint(
    session_key: str = Depends(pb_stream.verify)
):
    return {'result': 'success'}
```

### 6.3 Go SDK

```bash
go get github.com/protocolbanks/stream-sdk-go
```

```go
import "github.com/protocolbanks/stream-sdk-go"

middleware := pbstream.New(pbstream.Config{
    APIKey:      os.Getenv("PB_API_KEY"),
    Service:     "my-service",
    RatePerCall: "0.01",
})

// Gin
r.Use(middleware.Gin())

// Echo
e.Use(middleware.Echo())
```

---

## 7. 业务场景示例

### 场景 1: AI 聊天机器人按 Token 计费

**客户**: AI 公司提供聊天 API

**流程**:
1. 用户在 AI 公司官网点击"连接钱包"
2. 授权创建 Session Key (限额 50 U, 30 天)
3. AI 调用 API 时，PB-Stream 验证 Session Key
4. 链下累积计费 (每次 0.01 U)
5. 达到 10 U 时自动上链结算
6. Sentinel 监控异常调用频率

**收益**:
- AI 公司: 转化率提升 300%
- 用户: 只花 5 U 就能试用，无需月费

---

### 场景 2: Web3 租车动态扣费

**客户**: DePIN 租车项目

**流程**:
1. 用户扫码租车，授权 Session Key
2. 开始计时，基础费率 0.5 U/小时
3. 高峰期自动调整为 0.75 U/小时
4. 用户还车，停止计费
5. 自动结算总费用 (如 3.5 小时 = 2.625 U)
6. 生成 PDF 账单发送邮件

**收益**:
- 租车公司: 无需押金，实时收款
- 用户: 用多少付多少，体验好

---

### 场景 3: GPU 算力预付费

**客户**: 去中心化算力平台

**流程**:
1. 企业为 AI Agent 充值 100 U
2. AI Agent 租用 GPU (按秒计费)
3. 每秒扣费 0.001 U
4. 余额不足时自动停止服务
5. 企业收到余额告警
6. 充值后自动恢复服务

**收益**:
- 算力平台: 零坏账风险
- 企业: 精确控制 AI 预算

---

## 8. 竞争优势

| 维度 | 传统方案 (Stripe) | Protocol Banks |
|------|------------------|----------------|
| **微支付** | ❌ 手续费高 (2.9% + $0.30) | ✅ 链下累积，Gas 优化 |
| **实时计费** | ❌ 需要预授权 | ✅ Session Key 静默支付 |
| **跨境支付** | ❌ 慢 (3-5 天) | ✅ 秒级到账 |
| **AI 友好** | ❌ 需要信用卡 | ✅ 原生支持 AI Agent |
| **风控** | ✅ 成熟 | ✅ AI 哨兵实时监控 |
| **合规** | ✅ 全球合规 | 🟡 部分地区 |

---

## 9. 开发路线图

### Phase 1: 基础设施 (Month 1-2)
- [ ] Session Key 智能合约
- [ ] Session Key 管理界面
- [ ] 数据库扩展

### Phase 2: 核心功能 (Month 3-4)
- [ ] PB-Stream 微支付网关 (Go)
- [ ] 状态通道累积器
- [ ] Sentinel 风控引擎

### Phase 3: SDK 与集成 (Month 5-6)
- [ ] Node.js SDK
- [ ] Python SDK
- [ ] Go SDK
- [ ] 前端 Widget

### Phase 4: 生态与优化 (Month 7+)
- [ ] 合作伙伴集成
- [ ] 高级功能
- [ ] 性能优化

---

## 10. 成功指标

- 接入 **10+ AI 服务商**
- 处理 **100,000+ 微支付交易**
- Session Key 使用率 **> 60%**
- Sentinel 拦截异常率 **< 1%**
- 用户满意度 **> 4.5/5**

---

## 11. 下一步行动

1. **技术验证**: 完成 Session Key 合约 POC
2. **客户访谈**: 与 3-5 家 AI 公司沟通需求
3. **MVP 开发**: 2 个月完成核心功能
4. **Beta 测试**: 邀请首批客户试用
5. **正式发布**: 举办线上发布会

---

## 12. 联系方式

**产品咨询**: everest9812@gmail.com  
**技术支持**: GitHub Issues  
**商务合作**: 微信/Telegram

---

**Built for the AI Era** 🚀
