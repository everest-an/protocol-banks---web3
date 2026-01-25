# Protocol Banks

<div align="center">

![Protocol Banks Logo](public/logo.png)

**Enterprise-Grade Web3 Payment Infrastructure for the AI Era**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](#overview) | [中文](#中文文档)

</div>

---

## Overview

Protocol Banks is a non-custodial, multi-chain payment solution designed for DAOs, AI Agents, and enterprise users. It abstracts blockchain complexity and provides a unified financial management interface with batch payments, multi-sig approvals, subscription management, and AI agent integration.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Layer                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Web Browser (PWA)  │  Mobile App (PWA)  │  AI Agents  │  API Clients       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer (Next.js 15)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pages     │  │ Components  │  │   Hooks     │  │  Contexts   │        │
│  │  (app/)     │  │(components/)│  │  (hooks/)   │  │ (contexts/) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API Layer (Next.js API Routes)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/auth  │  /api/agents  │  /api/payments  │  /api/webhooks  │  /api/x402│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│   TypeScript Services   │ │ gRPC Bridge │ │   Go Microservices      │
│   lib/services/         │ │             │ │   services/             │
├─────────────────────────┤ └─────────────┘ ├─────────────────────────┤
│ • agent-service         │       │         │ • payout-engine (Go)    │
│ • payment-service       │       │         │ • event-indexer (Go)    │
│ • webhook-service       │◄──────┴────────►│ • webhook-handler (Go)  │
│ • subscription-service  │                 │                         │
│ • multisig-service      │                 │ Throughput: 500+ TPS    │
└─────────────────────────┘                 └─────────────────────────┘
                    │                                   │
                    └───────────────┬───────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Data Layer                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Supabase   │  │   Redis     │  │  Vault      │  │ Blockchain  │        │
│  │ (PostgreSQL)│  │  (Queue)    │  │  (Secrets)  │  │  (Multi)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| 🔐 **Dual Authentication** | Personal (Email/Google + Embedded Wallet) / Business (Hardware Wallets) | ✅ |
| 💳 **Single Payments** | Multi-chain payments with ENS resolution, real-time gas estimation | ✅ |
| 📦 **Batch Payments** | Excel/CSV import, 500+ TPS concurrent processing | ✅ |
| 🔏 **Multi-Sig Wallets** | Gnosis Safe protocol, mobile approvals, push notifications | ✅ |
| 🔄 **Cross-Chain** | Rango Exchange aggregation, ZetaChain bridging | ✅ |
| 📅 **Subscriptions** | Recurring payments, auto-debit, balance monitoring | ✅ |
| 🤖 **AI Agent API** | Agent budget management, x402 protocol, auto-execute | ✅ |
| 🔔 **Webhooks** | Event notifications with HMAC signature verification | ✅ |
| 📊 **Analytics** | Real-time balance, transaction history, network visualization | ✅ |

## 🤖 AI Agent Integration

Protocol Banks provides a comprehensive API for AI agents to interact with the treasury system programmatically.

### AI Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI Agent Integration                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Trading Bot  │  │ Payroll Bot  │  │ Expense Bot  │  │ Custom Agent │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     Agent Authentication     │
                    │   (API Key: agent_xxxxxx)    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                              ▼
         ┌─────────────────────┐      ┌─────────────────────┐
         │   Budget Service    │      │  Proposal Service   │
         │                     │      │                     │
         │ • Daily/Monthly     │      │ • Create proposals  │
         │ • Token limits      │      │ • Batch proposals   │
         │ • Chain restrictions│      │ • Auto-execute      │
         └─────────────────────┘      └──────────┬──────────┘
                                                 │
                    ┌────────────────────────────┴────────────────────────────┐
                    ▼                            ▼                            ▼
         ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
         │   Auto-Execute      │      │   Human Approval    │      │   x402 Protocol     │
         │   (Within Budget)   │      │   (Over Budget)     │      │   (Gasless)         │
         └─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

### AI Agent Features

| Feature | Description |
|---------|-------------|
| **Agent Registration** | Create agents with unique API keys (`agent_xxxxxx`) |
| **Budget Management** | Set daily/weekly/monthly spending limits per token/chain |
| **Payment Proposals** | Agents propose payments, humans approve or auto-execute |
| **Auto-Execute Rules** | Configure rules for automatic approval within budget |
| **x402 Protocol** | Gasless payments using ERC-3009 authorization |
| **Webhook Notifications** | Real-time events (proposal.approved, payment.executed) |
| **Activity Tracking** | Full audit trail of all agent actions |
| **Emergency Pause** | Instantly pause all agents with one click |

### Agent Types

- **Trading Agent**: Automated trading operations
- **Payroll Agent**: Scheduled salary payments
- **Expense Agent**: Vendor and expense management
- **Subscription Agent**: Recurring payment automation
- **Custom Agent**: User-defined automation

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
    recipient_address: '0x...',
    amount: '100',
    token: 'USDC',
    chain_id: 1,
    reason: 'Monthly subscription payment',
  }),
});

// Response
{
  "id": "proposal_123",
  "status": "pending",  // or "executed" if auto-execute enabled
  "auto_executed": false
}
```

## Supported Blockchains

| Chain | Type | Status |
|-------|------|--------|
| Ethereum | EVM | ✅ |
| Polygon | EVM L2 | ✅ |
| Arbitrum | EVM L2 | ✅ |
| Base | EVM L2 | ✅ |
| Optimism | EVM L2 | ✅ |
| BNB Chain | EVM | ✅ |
| Solana | SVM | ✅ |
| Bitcoin | UTXO | 🔜 Planned |
| Aptos (MSafe) | Move | 🔜 Planned |

## Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript 5.x
- Tailwind CSS 4.x
- shadcn/ui
- Framer Motion
- viem / ethers.js
- Reown AppKit

**Backend:**
- Next.js API Routes
- Go 1.21 (High-performance microservices)
- gRPC
- Supabase (PostgreSQL + RLS)
- Redis (Upstash)

**Security:**
- Shamir Secret Sharing (2-of-3)
- HashiCorp Vault
- AES-256-GCM encryption
- HMAC-SHA256 signatures

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

## Go Services (Optional)

Go microservices are for high-throughput scenarios. Not required for development.

```bash
# Configure environment
cd services
cp .env.example .env

# Start services (requires Docker)
docker-compose up -d
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Security Layers                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: Network
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Rate Limiting (100 req/15min per user)                                  │
│  • HTTPS Only (HSTS)                                                       │
│  • Security Headers (X-Frame-Options, CSP)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 2: Authentication
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Session Management (HTTP-only Cookies)                                  │
│  • API Key Authentication (HMAC-SHA256)                                    │
│  • Agent Authentication (JWT + Permissions)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 3: Data
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Row Level Security (Supabase RLS)                                       │
│  • Encryption at Rest (AES-256)                                            │
│  • Shamir Secret Sharing (2-of-3)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 4: Keys
┌─────────────────────────────────────────────────────────────────────────────┐
│  • HashiCorp Vault (Production)                                            │
│  • Key Rotation (90 days)                                                  │
│  • Zero-Knowledge Architecture                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Single Payment Latency | <3s | 2.1s |
| Batch Payment (100 tx) | <60s | 45s |
| API Response Time (p95) | <200ms | 180ms |
| Go Service Throughput | 500+ TPS | 650 TPS |
| System Availability | 99.9% | 99.95% |

## Documentation

| Document | Description |
|----------|-------------|
| [WHITEPAPER.md](WHITEPAPER.md) | Project whitepaper |
| [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) | Full technical architecture |
| [docs/FEATURES_DOCUMENTATION.md](docs/FEATURES_DOCUMENTATION.md) | Feature usage guide |
| [docs/GO_SERVICES_ARCHITECTURE.md](docs/GO_SERVICES_ARCHITECTURE.md) | Go services architecture |
| [docs/SECURITY.md](docs/SECURITY.md) | Security architecture |
| [ENV_SETUP.md](ENV_SETUP.md) | Environment configuration |

## Roadmap

- [x] **Q4 2024** - Core payment features
- [x] **Q1 2025** - Multi-sig wallets, AI Agent API
- [ ] **Q2 2025** - MSafe (Aptos) integration
- [ ] **Q3 2025** - Fiat on/off ramp (Transak/Rain)
- [ ] **Q4 2025** - HSM hardware security module

---

## 中文文档

### 项目简介

Protocol Banks 是一个非托管、多链支付解决方案，专为 DAO、AI Agent 和企业级用户设计。通过抽象链上复杂性，提供统一的财务管理界面，支持批量支付、多签审批、订阅管理和 AI Agent 集成。

### 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| 🔐 **双模式认证** | 个人用户 (Email/Google + 嵌入式钱包) / 企业用户 (硬件钱包) | ✅ |
| 💳 **单笔支付** | 多链支付，支持 ENS 解析，实时 Gas 估算 | ✅ |
| 📦 **批量支付** | Excel/CSV 导入，500+ TPS 并发处理 | ✅ |
| 🔏 **多签钱包** | Gnosis Safe 协议，移动端审批，推送通知 | ✅ |
| 🔄 **跨链操作** | Rango Exchange 聚合，ZetaChain 桥接 | ✅ |
| 📅 **订阅管理** | 定期支付，自动扣款，余额监控 | ✅ |
| 🤖 **AI Agent API** | Agent 预算管理，x402 协议，自动执行 | ✅ |
| 🔔 **Webhook** | 事件通知，HMAC 签名验证 | ✅ |

### AI Agent 功能

- **Agent 注册**: 创建带有唯一 API 密钥的 Agent
- **预算管理**: 设置每日/每周/每月支出限额
- **支付提案**: Agent 提议支付，人工审批或自动执行
- **自动执行规则**: 配置预算内自动审批规则
- **x402 协议**: 使用 ERC-3009 授权的无 Gas 支付
- **Webhook 通知**: 实时事件通知
- **活动追踪**: 完整的 Agent 操作审计日志
- **紧急暂停**: 一键暂停所有 Agent

### 快速开始

```bash
# 克隆
git clone https://github.com/everest-an/protocol-banks---web3.git
cd protocol-banks---web3

# 安装
pnpm install

# 配置
cp .env.example .env.local
# 编辑 .env.local

# 运行
pnpm dev
```

### 详细文档

- [白皮书](WHITEPAPER.md)
- [技术架构](docs/TECHNICAL_ARCHITECTURE.md)
- [功能文档](docs/FEATURES_DOCUMENTATION.md)
- [安全架构](docs/SECURITY.md)

---

## Contact

- **Website**: [protocolbank.vercel.app](https://protocolbank.vercel.app)
- **GitHub**: [github.com/everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)
- **Email**: everest9812@gmail.com

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the Web3 Future**

</div>
