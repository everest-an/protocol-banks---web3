# Protocol Banks

<div align="center">

![Protocol Banks Logo](public/logo.png)

**Stream Money like Data: Web3 Programmable Commerce Infrastructure for the AI Era**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](#english) | [中文](#中文文档)

</div>

---

<a name="english"></a>

## Overview

Protocol Banks is a **non-custodial, multi-chain payment infrastructure** designed for DAOs, AI Agents, and Web3 enterprises. We're transforming from an enterprise payroll tool into a **programmable commerce infrastructure** that enables:

- **Micro-Payments**: Pay-per-use billing as low as $0.001
- **AI Agent Integration**: Native API for autonomous agents
- **Session Keys**: One-time authorization for automatic payments
- **AI Sentinel**: Intelligent fraud detection and circuit breakers
- **Multi-Chain**: Unified interface across 10+ blockchains

### Our Mission

> **Stream Money like Data**  
> Make financial transactions as seamless as data transmission, enabling AI agents and humans to transact with the same ease.

---

## Product Architecture

### The 5-Layer Protocol Stack

Protocol Banks implements a comprehensive 5-layer architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  L5: PB-Proof    │  Audit & Compliance (ZKP, PDF Reports)       │
├─────────────────────────────────────────────────────────────────┤
│  L4: PB-Rail     │  Multi-Chain Settlement (ZetaChain, Rango)   │
├─────────────────────────────────────────────────────────────────┤
│  L3: PB-Stream   │  Micro-Payment Gateway (HTTP 402, Invoicing) │
├─────────────────────────────────────────────────────────────────┤
│  L2: PB-Guard    │  Authorization (Session Keys, Multi-Sig)     │
├─────────────────────────────────────────────────────────────────┤
│  L1: PB-Link     │  Identity (DID, Wallet Connect, OAuth)       │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Module | Function | Status |
|-------|--------|----------|--------|
| **L1** | **PB-Link** | Identity authentication (DID, Wallet Connect) | Production |
| **L2** | **PB-Guard** | Authorization management (Session Keys, Multi-sig) | Enhanced |
| **L3** | **PB-Stream** | Micro-payment gateway (HTTP 402, Stream payments) | Q2 2026 |
| **L4** | **PB-Rail** | Multi-chain settlement (10+ chains) | Production |
| **L5** | **PB-Proof** | Audit & compliance (ZKP, PDF reports) | Production |


---

## Core Features

### Payment Engine

#### Single Payments
- **Multi-chain support**: Ethereum, Polygon, Arbitrum, Base, Optimism, BNB Chain, Solana
- **Token support**: USDC, USDT, DAI, WETH, native tokens
- **ENS resolution**: Send to `vitalik.eth` instead of `0x...`
- **Real-time gas estimation**: Dynamic fee calculation
- **Transaction simulation**: Preview before execution

#### Batch Payments
- **Excel/CSV import**: Drag-and-drop file upload
- **Concurrent processing**: 500+ TPS via Go microservices
- **Progress tracking**: Real-time status updates
- **Multi-sig optional**: Require approvals for large batches

**Performance:**
- Single payment: <3s average
- 100 transactions: <60s
- Go service throughput: 650 TPS

#### Split Payments
- **Percentage distribution**: Split by % (e.g., 60/30/10)
- **Fixed amounts**: Specific amounts to each recipient
- **Mixed mode**: Combine percentage and fixed
- **Unlimited recipients**: No limit on split count

### Scheduled Payroll

Automated recurring payments for Web3 teams:

- **Flexible schedules**: Daily, weekly, bi-weekly, monthly
- **Multi-recipient**: Pay entire team in one schedule
- **Multi-token**: Different tokens for different employees
- **Approval workflows**: Optional multi-sig approval
- **Balance monitoring**: Alerts when balance insufficient

### Multi-Signature Wallets

Enterprise-grade security with Gnosis Safe integration:

- **Configurable thresholds**: 2-of-3, 3-of-5, custom ratios
- **Role-based signing**: Assign roles (CEO, CFO, Finance)
- **Mobile approval**: PWA with push notifications
- **Audit trail**: Complete history of proposals and approvals

### Cross-Chain Operations

#### Swap (Rango Exchange)
- 50+ blockchains
- 100+ DEX aggregation
- Best price routing
- Slippage protection

#### Bridge (ZetaChain)
- Omnichain messaging
- Bitcoin ↔ EVM bridges
- Cross-chain asset transfers


---

## AI Agent Integration

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent Types                              │
├─────────────────────────────────────────────────────────────────┤
│  Trading Bot  │  Payroll Bot  │  Expense Bot  │  Custom Agent   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Agent Authentication (API Key)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   Budget Management      │    │   Payment Proposals      │
│ • Daily/Monthly limits   │    │ • Create proposals       │
│ • Token restrictions     │    │ • Batch proposals        │
│ • Chain restrictions     │    │ • Auto-execute rules     │
└──────────────────────────┘    └──────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Auto-Execute    │  │  Human       │  │  x402        │
│  (Within Budget) │  │  Approval    │  │  (Gasless)   │
└──────────────────┘  └──────────────┘  └──────────────┘
```

### Agent Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Agent Registration** | Create agents with unique API keys | Done |
| **Budget Management** | Daily/weekly/monthly spending limits | Done |
| **Payment Proposals** | Agents propose, humans approve | Done |
| **Auto-Execute Rules** | Automatic approval within budget | Done |
| **x402 Protocol** | Gasless payments (ERC-3009) | Done |
| **Session Keys** | One-time auth for auto-payments | Q2 2026 |
| **AI Sentinel** | Fraud detection & circuit breakers | Q2 2026 |
| **Webhook Events** | Real-time notifications | Done |

### Agent API Example

```typescript
// Create payment proposal
const response = await fetch('/api/agents/proposals', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer agent_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    recipient_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '100',
    token: 'USDC',
    chain_id: 137,
    reason: 'Monthly API subscription payment',
  }),
});

// Response
{
  "id": "proposal_abc123",
  "status": "executed",
  "auto_executed": true,
  "tx_hash": "0x...",
  "timestamp": "2026-02-02T12:00:00Z"
}
```


---

## Coming Soon: AI Billing Infrastructure (Q2 2026)

### PB-Stream: Micro-Payment Gateway

**HTTP 402 Protocol** for pay-per-use billing:

```typescript
// AI service integration example
import { PBStream } from '@protocolbanks/stream-sdk'

const pbStream = new PBStream({
  apiKey: process.env.PB_API_KEY,
  service: 'my-ai-service',
  ratePerCall: '0.01'  // 0.01 USDC per API call
})

// Express middleware
app.use('/api/ai', pbStream.middleware())
```

**Features:**
- Micro-payments ($0.001+)
- State channels (off-chain accumulation)
- Dynamic pricing (peak hour multipliers)
- SDK support (Node.js, Python, Go)

### Session Keys: Automatic Payments

**One-time authorization for seamless payments:**

```
1. User authorizes: "Max 50 USDC over 30 days"
   ↓
2. Session key generated
   ↓
3. AI calls API 1,000 times (0.01 USDC each)
   ↓
4. Payments happen automatically (no popups)
   ↓
5. Sentinel monitors for anomalies
```

**Features:**
- Temporary authorization keys
- Time-based expiration
- Spending limits
- Emergency freeze
- Silent payments (no wallet popups)

### AI Sentinel: Fraud Detection

**Intelligent monitoring and circuit breakers:**

```go
// Rule 1: Single amount anomaly
if currentAmount > averageAmount * 10 {
    freezeSessionKey("Abnormal single payment")
}

// Rule 2: Frequency anomaly
if callsPerMinute > 100 {
    freezeSessionKey("Abnormal call frequency")
}

// Rule 3: Low balance warning
if remainingBalance < limitAmount * 0.1 {
    sendAlert("Low balance warning")
}
```

**Features:**
- ML-based anomaly detection
- Auto circuit breaker
- Multi-channel alerts (Telegram, Email, Webhook)
- Z-score analysis
- Custom rules


---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  Web (PWA)  │  Mobile (PWA)  │  AI Agents  │  API Clients       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 15)                           │
├─────────────────────────────────────────────────────────────────┤
│  React 19  │  TypeScript  │  Tailwind CSS  │  shadcn/ui         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API Layer (Next.js API Routes)                  │
├─────────────────────────────────────────────────────────────────┤
│  /auth  │  /agents  │  /payments  │  /webhooks  │  /x402        │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  TypeScript      │  │  gRPC        │  │  Go Services     │
│  Services        │  │  Bridge      │  │                  │
├──────────────────┤  └──────────────┘  ├──────────────────┤
│ • agent-service  │         │          │ • payout-engine  │
│ • payment-svc    │◄────────┴─────────►│ • event-indexer  │
│ • webhook-svc    │                    │ • webhook-handler│
│ • multisig-svc   │                    │ • pb-stream      │
└──────────────────┘                    │ • sentinel       │
                                        └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  Vault  │  Blockchain (Multi-chain)    │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

#### Frontend
- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React Context, SWR
- **Web3**: viem, ethers.js, Reown AppKit
- **Animation**: Framer Motion

#### Backend
- **API**: Next.js API Routes (RESTful)
- **Authentication**: Custom (Shamir Secret Sharing)
- **Sessions**: HTTP-only cookies
- **Email**: Resend
- **Database**: Supabase (PostgreSQL + RLS)
- **Storage**: Supabase Storage

#### Go Microservices
- **Language**: Go 1.21+
- **RPC**: gRPC
- **Queue**: Redis
- **Crypto**: go-ethereum, ecdsa
- **Concurrency**: Goroutines

**Services:**
- `payout-engine`: High-throughput payment processing (650 TPS)
- `event-indexer`: Multi-chain event monitoring
- `webhook-handler`: External integrations
- `pb-stream`: Micro-payment gateway (planned)
- `sentinel`: AI fraud detection (planned)

#### Infrastructure
- **Hosting**: Vercel (Next.js), Kubernetes (Go)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis (Upstash)
- **Secrets**: HashiCorp Vault
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: GitHub Actions


### Supported Blockchains

| Chain | Type | Status | Use Case |
|-------|------|--------|----------|
| Ethereum | EVM L1 | Production | Enterprise payments |
| Polygon | EVM L2 | Production | High-frequency micro-payments |
| Arbitrum | EVM L2 | Production | DeFi integrations |
| Base | EVM L2 | Production | Consumer applications |
| Hashkey | EVM L2 | Production | Consumer applications |
| Optimism | EVM L2 | Production | DAO treasuries |
| BNB Chain | EVM | Production | Asian market |
| Solana | SVM | Production | High-speed settlements |
| ZetaChain | Omnichain | Production | Cross-chain messaging |
| Bitcoin | UTXO | Planned | Store of value |
| Aptos (MSafe) | Move | Planned | Institutional custody |

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                                       │
│  • Rate Limiting (100 req/15min)                                │
│  • HTTPS Only (HSTS)                                            │
│  • DDoS Protection (Cloudflare)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Authentication & Authorization                         │
│  • Session Management (HTTP-only cookies)                       │
│  • API Key Auth (HMAC-SHA256)                                   │
│  • Multi-Factor Auth (Biometric)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Data Security                                          │
│  • Row Level Security (Supabase RLS)                            │
│  • Encryption at Rest (AES-256-GCM)                             │
│  • Shamir Secret Sharing (2-of-3)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Key Management                                         │
│  • HashiCorp Vault (Production)                                 │
│  • Key Rotation (90-day cycle)                                  │
│  • Non-Custodial Architecture                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Shamir Secret Sharing (2-of-3):**
- **Share A**: User's device (IndexedDB, encrypted)
- **Share B**: Server (Supabase, PIN-encrypted)
- **Share C**: Recovery code (PDF download)

Any 2 shares can reconstruct the private key. Server alone cannot access funds.


---

## Project Structure

```
protocol-banks/
├── app/                    # Next.js pages and API routes
│   ├── api/               # REST API endpoints
│   │   ├── agents/        # AI Agent management
│   │   ├── auth/          # Authentication
│   │   ├── batch-payment/ # Batch payments
│   │   ├── subscriptions/ # Subscriptions
│   │   ├── webhooks/      # Webhooks
│   │   └── x402/          # x402 protocol
│   ├── agents/            # Agent dashboard pages
│   ├── batch-payment/     # Batch payment pages
│   ├── pay/               # Payment pages
│   └── settings/          # Settings pages
├── components/            # React components
├── contexts/              # React Context
├── hooks/                 # Custom Hooks
├── lib/                   # Core libraries
│   ├── auth/             # Auth logic (Shamir)
│   ├── services/         # Business services
│   │   ├── agent-service.ts
│   │   ├── budget-service.ts
│   │   ├── proposal-service.ts
│   │   └── agent-x402-service.ts
│   ├── middleware/       # API middleware
│   └── grpc/             # gRPC client
├── services/              # Go microservices
│   ├── payout-engine/    # Payment engine
│   ├── event-indexer/    # Event indexer
│   └── webhook-handler/  # Webhook handler
├── k8s/                   # Kubernetes configs
├── scripts/               # Database migrations
└── docs/                  # Documentation
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/everest-an/protocol-banks---web3.git
cd protocol-banks---web3
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Reown AppKit (Wallet Connection)
NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id

# Optional: Go Services
ENABLE_GO_SERVICES=false
```

### 4. Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

### 5. Go Services (Optional)

Go microservices are for high-throughput scenarios. Not required for development.

```bash
# Configure environment
cd services
cp .env.example .env

# Start services (requires Docker)
docker-compose up -d
```


---

## Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Single Payment Latency | <3s | 2.1s | Exceeds |
| Batch Payment (100 tx) | <60s | 45s | Exceeds |
| API Response Time (p95) | <200ms | 180ms | Exceeds |
| Go Service Throughput | 500+ TPS | 650 TPS | Exceeds |
| System Uptime | 99.9% | 99.95% | Exceeds |

---

## Use Cases

### 1. AI Service Provider: Pay-Per-Token Billing

**Customer:** AI chatbot company

**Solution:**
1. User connects wallet, authorizes Session Key (50 USDC, 30 days)
2. AI calls API 5,000 times (0.01 USDC per call)
3. Payments accumulate off-chain
4. Batch settle every 10 USDC
5. Sentinel monitors for anomalies

**Results:**
- 300% increase in conversion rate
- 95% reduction in gas costs
- Zero payment friction

### 2. DePIN Project: Web3 Car Rental

**Customer:** Decentralized car rental platform

**Solution:**
1. User scans QR code, authorizes Session Key
2. Real-time billing (0.5 USDC/hour, peak: 0.75 USDC/hour)
3. User returns car, billing stops
4. Auto-settle total amount
5. PDF invoice sent via email

**Results:**
- No deposits required
- Real-time revenue
- Automated billing

### 3. GPU Platform: Decentralized Compute

**Customer:** Decentralized GPU marketplace

**Solution:**
1. Enterprise pre-funds AI Agent with 100 USDC
2. AI Agent rents GPU (0.001 USDC per second)
3. Real-time billing, automatic deduction
4. Balance low? Auto-alert
5. Monthly invoice with all transactions

**Results:**
- Zero bad debt risk
- Precise budget control
- Automated accounting

### 4. DAO Treasury Management

**Customer:** 500-member DAO with $5M treasury

**Solution:**
1. Set up multi-sig wallet (3-of-5 threshold)
2. Create scheduled payroll (monthly, 50 recipients)
3. Finance proposes, 3 signers approve on mobile
4. Automatic execution
5. Complete audit trail

**Results:**
- 90% reduction in payroll time
- Mobile approval workflow
- Complete transparency


---

## Roadmap

### Phase 1: Foundation (Q1-Q2 2025) - Completed

**Core Infrastructure:**
- Multi-chain payment engine
- Batch payment processing (500+ TPS)
- Dual authentication (Personal/Business)
- Multi-signature wallets (Gnosis Safe)
- Cross-chain swaps (Rango)
- Scheduled payroll
- Subscription management

**AI Agent Integration:**
- Agent API with budget management
- Payment proposals
- Auto-execute rules
- x402 gasless payments
- Webhook system

### Phase 2: AI Billing Infrastructure (Q2-Q3 2026) - In Progress

**PB-Stream (Micro-Payment Gateway):**
- HTTP 402 middleware (Node.js, Python, Go)
- State channel accumulator
- Dynamic pricing engine
- SDK development

**PB-Guard (Session Keys):**
- Session Key smart contracts
- Session Key management UI
- Permission system enhancement
- Emergency freeze mechanism

**Sentinel (AI Fraud Detection):**
- Rule engine (Go)
- Anomaly detection (ML-based)
- Circuit breaker system
- Multi-channel alerts

**Target Metrics:**
- 10+ AI service integrations
- 100,000+ micro-payment transactions
- 60%+ Session Key adoption
- <1% false positive rate

### Phase 3: Ecosystem Expansion (Q4 2026 - Q1 2027) - Planned

**Fiat Integration:**
- Rain Card integration (crypto → fiat)
- Transak on/off ramp
- Virtual card issuance
- Bank account linking

**Additional Chains:**
- Bitcoin native support
- Aptos (MSafe integration)
- Sui blockchain
- Cosmos ecosystem

**Enterprise Features:**
- HSM integration (hardware security)
- SOC 2 compliance
- Advanced analytics dashboard
- Custom reporting

**Developer Tools:**
- GraphQL API
- Webhook builder UI
- Testing sandbox
- API playground

### Phase 4: Advanced Features (Q2-Q4 2027) - Future

**Privacy & Compliance:**
- Zero-Knowledge Proofs (ZKP)
- Privacy-preserving transactions
- Regulatory compliance automation
- KYC/AML integration

**AI Enhancements:**
- Predictive budget management
- Smart contract automation
- Natural language payment interface
- AI-powered fraud detection v2

**Global Expansion:**
- Multi-language support (10+ languages)
- Regional compliance (EU, Asia, LATAM)
- Local payment methods
- Currency localization


---

## Documentation

| Document | Description |
|----------|-------------|
| [WHITEPAPER.md](WHITEPAPER.md) | Complete product whitepaper |
| [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) | Full technical architecture |
| [docs/FEATURES_DOCUMENTATION.md](docs/FEATURES_DOCUMENTATION.md) | Feature usage guide |
| [docs/AI_BILLING_FEATURES.md](docs/AI_BILLING_FEATURES.md) | AI billing infrastructure |
| [docs/GO_SERVICES_ARCHITECTURE.md](docs/GO_SERVICES_ARCHITECTURE.md) | Go services architecture |
| [docs/SECURITY.md](docs/SECURITY.md) | Security architecture |
| [ENV_SETUP.md](ENV_SETUP.md) | Environment configuration |

---

## Competitive Advantages

| Feature | Protocol Banks | Stripe | Gnosis Safe | Request Network |
|---------|----------------|--------|-------------|-----------------|
| **Crypto Payments** | Native | Limited | Yes | Yes |
| **Fiat Integration** | Coming | Native | No | No |
| **Multi-Chain** | 10+ chains | No | EVM only | Limited |
| **Micro-Payments** | $0.001+ | High fees | No | No |
| **AI Agent API** | Native | No | No | No |
| **Session Keys** | Coming | No | No | No |
| **Multi-Sig** | Yes | No | Core | No |
| **Batch Payments** | 500+ TPS | Yes | Limited | No |
| **Real-Time Billing** | Coming | Yes | No | No |
| **Non-Custodial** | Yes | Custodial | Yes | Yes |

---

<a name="中文文档"></a>

## 中文文档

### 项目简介

Protocol Banks 是一个**非托管、多链支付基础设施**，专为 DAO、AI Agent 和 Web3 企业设计。我们正在从企业薪酬工具转型为**可编程商业基础设施**，支持：

- **微支付**: 低至 $0.001 的按量计费
- **AI Agent 集成**: 为自主代理提供原生 API
- **会话密钥**: 一次授权，自动支付
- **AI 哨兵**: 智能欺诈检测和熔断机制
- **多链支持**: 统一接口支持 10+ 区块链

### 我们的使命

> **让资金像数据一样流动**  
> 使金融交易像数据传输一样无缝，让 AI 代理和人类能够以同样的便捷性进行交易。


### 五层协议栈

| 层级 | 模块名 | 功能 | 状态 |
|------|--------|------|------|
| **L1** | **PB-Link** | 身份认证 (DID, 钱包连接) | 生产环境 |
| **L2** | **PB-Guard** | 授权管理 (会话密钥, 多签) | 增强中 |
| **L3** | **PB-Stream** | 微支付网关 (HTTP 402, 流支付) | 2026 Q2 |
| **L4** | **PB-Rail** | 多链结算 (10+ 条链) | 生产环境 |
| **L5** | **PB-Proof** | 审计合规 (ZKP, PDF 报告) | 生产环境 |

### 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| **双模式认证** | 个人 (Email/Google + 嵌入式钱包) / 企业 (硬件钱包) | 已完成 |
| **单笔支付** | 多链支付，支持 ENS 解析，实时 Gas 估算 | 已完成 |
| **批量支付** | Excel/CSV 导入，500+ TPS 并发处理 | 已完成 |
| **分账支付** | 按比例/固定金额分配给多个收款人 | 已完成 |
| **定时发薪** | 自动化周期支付（日/周/月），审批工作流 | 已完成 |
| **多签钱包** | Gnosis Safe 协议，移动端审批，推送通知 | 已完成 |
| **权限系统** | RBAC 角色权限，组织管理，审批规则 | 已完成 |
| **跨链操作** | Rango Exchange 聚合，ZetaChain 桥接 | 已完成 |
| **订阅管理** | 定期支付，自动扣款，余额监控 | 已完成 |
| **AI Agent API** | Agent 预算管理，x402 协议，自动执行 | 已完成 |
| **Webhook** | 事件通知，HMAC 签名验证 | 已完成 |

### AI Agent 功能

- **Agent 注册**: 创建带有唯一 API 密钥的 Agent
- **预算管理**: 设置每日/每周/每月支出限额
- **支付提案**: Agent 提议支付，人工审批或自动执行
- **自动执行规则**: 配置预算内自动审批规则
- **x402 协议**: 使用 ERC-3009 授权的无 Gas 支付
- **会话密钥**: 一次授权，自动扣款（2026 Q2）
- **AI 哨兵**: 智能风控和熔断机制（2026 Q2）
- **Webhook 通知**: 实时事件通知
- **活动追踪**: 完整的 Agent 操作审计日志

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/everest-an/protocol-banks---web3.git
cd protocol-banks---web3

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000

### 性能指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| 单笔支付延迟 | <3s | 2.1s | 超出预期 |
| 批量支付 (100 笔) | <60s | 45s | 超出预期 |
| API 响应时间 (p95) | <200ms | 180ms | 超出预期 |
| Go 服务吞吐量 | 500+ TPS | 650 TPS | 超出预期 |
| 系统可用性 | 99.9% | 99.95% | 超出预期 |


### 支持的区块链

| 链 | 类型 | 状态 | 用途 |
|----|------|------|------|
| Ethereum | EVM L1 | 生产环境 | 企业支付 |
| Polygon | EVM L2 | 生产环境 | 高频微支付 |
| Arbitrum | EVM L2 | 生产环境 | DeFi 集成 |
| Base | EVM L2 | 生产环境 | 消费者应用 |
| Optimism | EVM L2 | 生产环境 | DAO 金库 |
| BNB Chain | EVM | 生产环境 | 亚洲市场 |
| Solana | SVM | 生产环境 | 高速结算 |
| ZetaChain | 全链 | 生产环境 | 跨链消息 |
| Bitcoin | UTXO | 计划中 | 价值存储 |
| Aptos (MSafe) | Move | 计划中 | 机构托管 |

### 技术栈

**前端:**
- Next.js 15 (App Router)
- React 19
- TypeScript 5.x
- Tailwind CSS 4.x
- shadcn/ui
- Framer Motion
- viem / ethers.js
- Reown AppKit

**后端:**
- Next.js API Routes
- Go 1.21 (高性能微服务)
- gRPC
- Supabase (PostgreSQL + RLS)
- Redis (Upstash)

**安全:**
- Shamir 秘密共享 (2-of-3)
- HashiCorp Vault
- AES-256-GCM 加密
- HMAC-SHA256 签名

### 开发路线图

- **Q1-Q2 2025** - 核心支付功能 (已完成)
- **Q2-Q3 2026** - AI 计费基础设施 (进行中)
- **Q4 2026 - Q1 2027** - 生态扩展 (计划中)
- **Q2-Q4 2027** - 高级功能 (未来)

---

## Contact

- **Website**: [protocolbank.vercel.app](https://protocolbank.vercel.app)
- **GitHub**: [github.com/everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)
- **Email**: everest9812@gmail.com

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the AI Era**

</div>
