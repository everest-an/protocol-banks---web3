# Protocol Banks

<div align="center">

![Protocol Banks Logo](public/logo.png)

**AI 原生 Web3 支付基础设施 | AI-Native Web3 Payment Infrastructure**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](https://golang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![MCP Server](https://img.shields.io/badge/MCP-8_Tools-purple)](https://app.protocolbanks.com/api/mcp)
[![A2A Protocol](https://img.shields.io/badge/A2A-JSON--RPC_2.0-orange)](https://app.protocolbanks.com/.well-known/agent.json)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent_Card-blue)](https://app.protocolbanks.com/.well-known/agent.json)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

[English](#overview) | [中文](#中文文档)

</div>

---

## Overview

Protocol Banks is the first AI-native, non-custodial, multi-chain payment infrastructure. Designed for DAOs, AI Agents, and enterprises, it enables any AI agent to **discover** (ERC-8004 Agent Card), **communicate** (A2A Protocol), and **call** (MCP Server) payment services — all secured by on-chain signatures.

Beyond standard batch payments, multi-sig approvals, and subscription management, Protocol Banks provides a complete AI agent financial stack: SIWE authentication, JWT session management, autonomous budget execution, and the x402 machine-to-machine micropayment protocol.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                             User Layer                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Web Browser  │  Mobile (PWA)  │  AI Agents (SDK)  │  External AI Agents   │
└──────────────────────────────────────────────────────────────────────────────┘
       │               │                │                      │
       │   Reown/SIWE  │    AI Wallet   │  SIWE + JWT          │  EIP-191 Signed
       │               │     SDK        │                      │  JSON-RPC 2.0
       ▼               ▼                ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      AI Agent Protocol Layer                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  ERC-8004    │ │    A2A       │ │     MCP      │ │  AI Wallet   │       │
│  │ Agent Card   │ │  Protocol    │ │   Server     │ │    SDK       │       │
│  │ (Discovery)  │ │ (Messaging)  │ │  (Tools)     │ │ (SIWE+JWT)   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Frontend Layer (Next.js 15)                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │    Pages     │ │  Components  │ │    Hooks     │ │  Contexts    │       │
│  │   (app/)     │ │ (components/)│ │   (hooks/)   │ │ (contexts/)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js API Routes)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  /api/agents    │  /api/payments  │  /api/vendors    │  /api/webhooks       │
│  /api/a2a       │  /api/x402      │  /api/invoice    │  /api/mcp           │
│  /api/auth/siwe │  /api/subscriptions  │  /.well-known/agent.json          │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼              ▼              ▼
┌─────────────────────────┐┌─────────────┐┌─────────────────────────┐
│  TypeScript Services    ││ gRPC Bridge ││  Go Microservices       │
│  lib/services/          ││             ││  services/              │
├─────────────────────────┤└─────────────┘├─────────────────────────┤
│• agent-service          │      │        │• payout-engine (Go)     │
│• agent-card-service     │      │        │• event-indexer (Go)     │
│• a2a-service            │◄─────┼───────►│• webhook-handler (Go)   │
│• payment-service        │                │                        │
│• webhook-service        │                │ Throughput: 500+ TPS   │
└─────────────────────────┘                └─────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             Data Layer                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  Prisma 7    │ │    Redis     │ │    Vault     │ │  Blockchain  │       │
│  │ (PostgreSQL) │ │   (Queue)    │ │  (Secrets)   │ │  (9 Chains)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Dual Authentication** | Personal (Email/Google + Embedded Wallet) / Business (Hardware Wallets) | ✅ Done |
| **Single Payments** | Multi-chain payments with ENS resolution, real-time gas estimation | ✅ Done |
| **Batch Payments** | Excel/CSV import, 500+ TPS concurrent processing | ✅ Done |
| **Multi-Sig Wallets** | Gnosis Safe protocol, mobile approvals, push notifications | ✅ Done |
| **Cross-Chain** | Rango Exchange aggregation, ZetaChain bridging, CCTP support | ✅ Done |
| **Subscriptions** | Recurring payments, auto-debit, balance monitoring | ✅ Done |
| **AI Agent API** | Agent budget management, x402 protocol, auto-execute | ✅ Done |
| **AI Wallet SDK** | **[NEW]** SIWE (EIP-4361) login + JWT sessions for autonomous AI agents | ✅ Done |
| **ERC-8004 Agent Card** | **[NEW]** On-chain agent identity, DID-based discovery, EIP-191 signed cards | ✅ Done |
| **A2A Protocol** | **[NEW]** Agent-to-Agent JSON-RPC 2.0 messaging with signature verification | ✅ Done |
| **MCP Server** | **[NEW]** Model Context Protocol server — Claude/GPT can directly call payment tools | ✅ Done |
| **Settlement Checkout** | Unified checkout: mixed-currency payments, smart routing, atomic state sync | ✅ Done |
| **Webhooks** | Event notifications with HMAC signature verification | ✅ Done |
| **Analytics** | Real-time balance, transaction history, network visualization | ✅ Done |
| **Vendor Security** | Address change signature verification, 24h cooldown, notifications | ✅ Done |
| **Invoice System** | On-chain invoice generation with blockchain tx linking | ✅ Done |
| **Acquiring (POS)** | Merchant payment acceptance, payment links | ✅ Done |

## AI-Native Infrastructure

Protocol Banks is built as an **AI-native payment service** — any AI agent can discover, authenticate, communicate with, and call our payment capabilities through open standards.

### How AI Agents Interact

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     AI Agent Interaction Patterns                            │
└──────────────────────────────────────────────────────────────────────────────┘

  ① DISCOVER               ② AUTHENTICATE           ③ COMMUNICATE
  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │  ERC-8004        │     │  SIWE (EIP-4361)  │     │  A2A Protocol    │
  │  Agent Card      │     │  + JWT Sessions   │     │  JSON-RPC 2.0   │
  │                  │     │                  │     │                  │
  │  GET /.well-     │     │  1. GET nonce    │     │  POST /api/a2a   │
  │  known/agent.json│     │  2. Sign message │     │  EIP-191 signed  │
  │                  │     │  3. Verify → JWT │     │  messages        │
  │  DID: did:pkh:   │     │  4. Auto-refresh │     │  Nonce replay    │
  │  eip155:1:0x...  │     │                  │     │  protection      │
  └──────────────────┘     └──────────────────┘     └──────────────────┘

  ④ CALL TOOLS              ⑤ EXECUTE                ⑥ MACHINE PAY
  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │  MCP Server      │     │  Agent API       │     │  x402 Protocol   │
  │                  │     │                  │     │                  │
  │  8 payment tools │     │  Budget mgmt     │     │  HTTP 402        │
  │  Streamable HTTP │     │  Proposals       │     │  ERC-3009        │
  │  + stdio         │     │  Auto-execute    │     │  Gasless         │
  │                  │     │  Webhooks        │     │  micropayments   │
  │  Claude / GPT    │     │  Activity log    │     │                  │
  │  can call these  │     │  Emergency pause │     │  AI-to-AI        │
  └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Authentication Paths

| Caller | Method | How It Works |
|--------|--------|-------------|
| **Browser User** | Reown AppKit / Shamir SSS | Wallet signature or embedded wallet |
| **Registered Agent** | API Key (`x-api-key`) | `agent_xxx` key → SHA-256 hash lookup |
| **AI Wallet SDK** | SIWE → JWT (`Authorization: Bearer`) | EIP-4361 sign-in → 1h access + 30d refresh |
| **External Agent (A2A)** | EIP-191 per-message signature | Every JSON-RPC message is cryptographically signed |
| **MCP Client** | JWT Bearer | Claude/GPT authenticate via SIWE first |

### AI Wallet SDK (SIWE + JWT)

AI agents can autonomously log in using their private key — no browser, no human:

```typescript
import { AIWalletSDK } from '@protocol-banks/ai-wallet'

const sdk = new AIWalletSDK({
  baseUrl: 'https://app.protocolbanks.com',
  signer: { address: '0x...', signMessage: async (msg) => wallet.sign(msg) },
})

// 1. SIWE login → JWT (auto-refreshes before expiry)
await sdk.connectAndSignIn()

// 2. Use payment capabilities
await sdk.payments.create({
  to: '0xRecipient', amount: '100', token: 'USDC', network: 'base'
})
await sdk.invoices.create({ amount: '250', token: 'USDT' })
await sdk.sessionKeys.create({ maxAmount: '1000', duration: 86400 })
```

### ERC-8004 Agent Card

Every agent gets a discoverable identity card with DID:

```
GET /.well-known/agent.json
→ {
    "did": "did:pkh:eip155:1:0x...",
    "name": "Protocol Banks Payment Agent",
    "capabilities": {
      "skills": ["payment", "invoice", "batch_payment", "x402"],
      "supported_protocols": ["a2a", "mcp", "x402"]
    },
    "supported_tokens": ["USDT", "USDC", "DAI"],
    "supported_chains": ["ethereum", "base", "arbitrum", "polygon", "tron"],
    "a2a_endpoint": "https://app.protocolbanks.com/api/a2a",
    "mcp_endpoint": "https://app.protocolbanks.com/api/mcp"
  }
```

### A2A Protocol (Agent-to-Agent)

External AI agents communicate via signed JSON-RPC 2.0 messages:

```typescript
POST /api/a2a
{
  "jsonrpc": "2.0",
  "method": "a2a.requestPayment",
  "params": {
    "from_did": "did:pkh:eip155:1:0xSender",
    "to": "0xRecipient",
    "amount": "100",
    "token": "USDT",
    "nonce": "unique-random-string",       // replay protection
    "timestamp": "2026-02-27T10:00:00Z",   // 5-min window
    "signature": "0x..."                    // EIP-191 signature
  }
}
```

Supported methods: `handshake`, `requestPayment`, `paymentQuote`, `confirmPayment`, `paymentStatus`, `cancelPayment`

### MCP Server (Model Context Protocol)

Claude, GPT, and other AI models can directly call payment tools:

| Tool | Auth | Description |
|------|------|-------------|
| `list_supported_tokens` | None | Query supported tokens & networks |
| `get_payment_quote` | None | Fee estimates for any payment |
| `create_payment` | JWT | Create a payment proposal |
| `check_payment_status` | JWT | Check payment by ID |
| `list_payments` | JWT | List recent payments |
| `create_invoice` | JWT | Generate invoice with payment link |
| `list_invoices` | JWT | List invoices |
| `get_balance` | JWT | Query wallet balances |

**Transports:** Streamable HTTP (`POST /api/mcp`) and stdio (`pnpm mcp:stdio` for Claude Desktop)

### Legacy Agent API

Agents with API keys can still use the original proposal workflow:

```typescript
// Create payment proposal
const response = await fetch('/api/agents/proposals', {
  method: 'POST',
  headers: {
    'x-api-key': 'agent_xxxxxxxxxxxxxxxx',
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
```

## Supported Blockchains

| Chain | Type | Status | Batch Payment | Note |
|-------|------|--------|---------------|------|
| Ethereum | EVM | ✅ Done | ✅ Supported | Mainnet, high-value settlement |
| Polygon | EVM L2 | ✅ Done | ✅ Supported | Low cost, high throughput |
| Arbitrum | EVM L2 | ✅ Done | ✅ Supported | Leading L2 solution |
| Base | EVM L2 | ✅ Done | ✅ Supported | Coinbase ecosystem, Web2 onboarding |
| Optimism | EVM L2 | ✅ Done | 🚧 Planned | OP Stack ecosystem |
| BNB Chain | EVM | ✅ Done | ✅ Supported | Asia's largest ecosystem |
| Solana | Non-EVM | ✅ Done | 🚧 Planned | High-speed, low-cost payments |
| Bitcoin | Non-EVM | ✅ Done | 🚧 Planned | Native BTC transfer support |
| **Tron (波场)** | Non-EVM | 🚧 Integrating | 🚧 Planned | **[NEW]** TRC20-USDT deep integration |
| HashKey | EVM L1 | ✅ Done | 🚧 Planned | RWA settlement, compliance-first |

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
- Go 1.21 (High-performance microservices: Payout Engine, Event Indexer)
- gRPC (service-to-service communication)
- Prisma 7 (Serverless ORM with pg adapter)
- PostgreSQL (via Supabase with RLS)
- Vercel Cron (scheduled jobs)
- Redis (Upstash)

**AI Agent Protocols:**
- ERC-8004 Agent Card (DID-based discovery)
- A2A Protocol (JSON-RPC 2.0, EIP-191 signatures)
- MCP Server (@modelcontextprotocol/sdk)
- SIWE / EIP-4361 (AI Wallet authentication)
- JWT (HMAC-SHA256, Web Crypto API)

**Security:**
- Shamir Secret Sharing (2-of-3)
- HashiCorp Vault
- AES-256-GCM encryption
- HMAC-SHA256 signatures
- EIP-191 signature verification (A2A, Agent Card)
- Nonce-based replay protection

## Project Structure

```
protocol-banks/
├── app/                          # Next.js App Router
│  ├── page.tsx                   # Marketing landing page
│  ├── (products)/                # Route group (with sidebar layout)
│  │  ├── dashboard/              # User dashboard
│  │  ├── pay/                    # Send payment
│  │  ├── receive/                # Receive payment
│  │  ├── batch-payment/          # Batch payments
│  │  ├── balances/               # Multi-chain balances
│  │  ├── history/                # Transaction history
│  │  ├── vendors/                # Contacts / Wallet tags
│  │  ├── agents/                 # AI Agent dashboard
│  │  ├── swap/                   # Token swap (Rango)
│  │  ├── omnichain/              # Cross-chain vault
│  │  ├── checkout/               # Payment checkout
│  │  ├── subscriptions/          # Subscription management
│  │  ├── acquiring/              # POS / Merchant acquiring
│  │  ├── terminal/               # Payment terminal
│  │  ├── analytics/              # Analytics dashboard
│  │  └── products/               # Products overview
│  ├── .well-known/agent.json/    # ERC-8004 Agent Card discovery
│  ├── api/                       # REST API endpoints
│  │  ├── agents/                 # AI Agent management + Agent Cards
│  │  ├── a2a/                    # A2A protocol (messages, tasks)
│  │  ├── mcp/                    # MCP Streamable HTTP transport
│  │  ├── auth/siwe/              # SIWE nonce, verify, refresh
│  │  ├── payments/               # Payment processing
│  │  ├── vendors/                # Vendor CRUD + batch update
│  │  ├── subscriptions/          # Subscription management
│  │  ├── webhooks/               # Webhook delivery
│  │  ├── invoice/                # Invoice system
│  │  ├── x402/                   # x402 protocol
│  │  └── notifications/          # Email + push notifications
│  ├── admin/                     # Admin panel
│  └── settings/                  # User settings
├── components/                   # React components
├── contexts/                     # React Context
├── hooks/                        # Custom Hooks
├── lib/                          # Core libraries
│  ├── auth/                      # Auth logic (Shamir, SIWE, JWT)
│  ├── a2a/                       # A2A protocol (types, verifier, router, handlers)
│  ├── mcp/                       # MCP server (tools, auth, resources, stdio)
│  ├── ai-wallet/                 # AI Wallet SDK (SIWE client, sub-clients)
│  ├── services/                  # Business services (agent-card, a2a, etc.)
│  ├── security/                  # Security middleware + utilities
│  └── prisma.ts                  # Prisma client (serverless)
├── services/                     # Go microservices
├── contracts/                    # Solidity smart contracts
├── prisma/                       # Prisma schema
│  └── schema.prisma              # Database schema
├── scripts/                      # SQL migrations & deploy scripts
└── docs/                         # Documentation
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
# Database (Prisma + Supabase PostgreSQL)
DATABASE_URL=your_postgresql_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

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
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Security Layers                                    │
└──────────────────────────────────────────────────────────────────────────────┘
Layer 1: Network
┌──────────────────────────────────────────────────────────────────────────────┐
│  • Rate Limiting (100 req/15min per user)                                   │
│  • HTTPS Only (HSTS)                                                        │
│  • Security Headers (X-Frame-Options, CSP)                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 2: Authentication
┌──────────────────────────────────────────────────────────────────────────────┐
│  • Session Management (HTTP-only Cookies)                                   │
│  • API Key Authentication (HMAC-SHA256)                                     │
│  • SIWE / EIP-4361 (AI Agent wallet-based login)                            │
│  • JWT Sessions (HMAC-SHA256, 1h access + 30d refresh)                      │
│  • A2A Message Signatures (EIP-191 per-message verification)                │
│  • Nonce Replay Protection (DB unique constraint + 5-min timestamp window)  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 3: Data
┌──────────────────────────────────────────────────────────────────────────────┐
│  • Row Level Security (Supabase RLS)                                        │
│  • Encryption at Rest (AES-256)                                             │
│  • Shamir Secret Sharing (2-of-3)                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 4: Keys
┌──────────────────────────────────────────────────────────────────────────────┐
│  • HashiCorp Vault (Production)                                             │
│  • Key Rotation (90 days)                                                   │
│  • Zero-Knowledge Architecture                                              │
└──────────────────────────────────────────────────────────────────────────────┘
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
| [docs/FEATURES_DOCUMENTATION.md](docs/FEATURES_DOCUMENTATION.md) | Feature usage guide |
| [docs/GO_SERVICES_ARCHITECTURE.md](docs/GO_SERVICES_ARCHITECTURE.md) | Go services architecture |
| [docs/SECURITY.md](docs/SECURITY.md) | Security architecture |
| [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | Security audit report |
| [docs/HASHKEY_INTEGRATION.md](docs/HASHKEY_INTEGRATION.md) | HashKey Chain integration |
| [ENV_SETUP.md](ENV_SETUP.md) | Environment configuration |
| [REOWN_SETUP.md](REOWN_SETUP.md) | Reown AppKit integration guide |

## Roadmap

- [x] **Q4 2024** - Core payment features (single pay, batch pay, multi-sig)
- [x] **Q1 2025** - Multi-sig wallets, AI Agent API, x402 protocol
- [x] **Q2 2025** - Invoice system, POS acquiring, vendor security hardening
- [x] **Q3 2025** - Prisma migration, Vercel Cron, multi-chain balance dashboard
- [x] **Q4 2025** - Omnichain vault, session keys, subscription MCP
- [x] **Q1 2026** - Agent Link API, Settlement Checkout, HashKey Chain integration
- [x] **Q1 2026** - AI Wallet SDK (SIWE + JWT), ERC-8004 Agent Card, A2A Protocol, MCP Server
- [ ] **Q2 2026** - Tron TRC20 full support, mobile native app, fiat on/off ramp
- [ ] **Q3 2026** - AI-powered budget analytics, ZK privacy payments
- [ ] **Q4 2026** - HSM hardware security module, MSafe (Aptos) integration

---

## 中文文档

### 项目简介

Protocol Banks 是首个 **AI 原生**的非托管多链支付基础设施，专为 DAO、AI Agent 和企业级用户设计。任何 AI Agent 都可以通过开放标准**发现**（ERC-8004 Agent Card）、**通信**（A2A 协议）和**调用**（MCP Server）我们的支付服务 —— 所有操作均由链上签名保障安全。

在标准的批量支付、多签审批和订阅管理之外，Protocol Banks 提供完整的 AI Agent 金融栈：SIWE 钱包认证、JWT 会话管理、自主预算执行和 x402 机器间微支付协议。

### 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| **双模式认证** | 个人用户 (Email/Google + 嵌入式钱包) / 企业用户 (硬件钱包) | ✅ 已完成 |
| **单笔支付** | 多链支付，支持 ENS 解析，实时 Gas 估算 | ✅ 已完成 |
| **批量支付** | Excel/CSV 导入，500+ TPS 并发处理 | ✅ 已完成 |
| **多签钱包** | Gnosis Safe 协议，移动端审批，推送通知 | ✅ 已完成 |
| **跨链操作** | Rango Exchange 聚合，ZetaChain 桥接，CCTP 支持 | ✅ 已完成 |
| **订阅管理** | 定期支付，自动扣款，余额监控 | ✅ 已完成 |
| **AI Agent API** | Agent 预算管理，x402 协议，自动执行 | ✅ 已完成 |
| **AI Wallet SDK** | **[新增]** SIWE (EIP-4361) 钱包登录 + JWT 会话，AI Agent 自主认证 | ✅ 已完成 |
| **ERC-8004 Agent Card** | **[新增]** 链上 Agent 身份卡，DID 标识，EIP-191 签名验证 | ✅ 已完成 |
| **A2A 协议** | **[新增]** Agent 间 JSON-RPC 2.0 通信，签名验证 + 防重放 | ✅ 已完成 |
| **MCP Server** | **[新增]** 模型上下文协议服务器 — Claude/GPT 可直接调用支付工具 | ✅ 已完成 |
| **Settlement Checkout** | 统一结算收银台，支持多币种混合支付与智能路由 | ✅ 已完成 |
| **Webhook** | 事件通知，HMAC 签名验证 | ✅ 已完成 |
| **联系人安全** | 地址变更签名验证、24h 冷却期、邮件/推送通知 | ✅ 已完成 |
| **发票系统** | 链上发票生成，区块链交易关联 | ✅ 已完成 |
| **收单 (POS)** | 商户收款、支付链接 | ✅ 已完成 |

### AI 原生基础设施

Protocol Banks 是 **AI 原生支付服务** —— 任何 AI Agent 都可通过开放标准发现、认证、通信和调用支付能力。

**六大交互模式：**

| 模式 | 协议/技术 | 说明 |
|------|----------|------|
| ① 发现 | ERC-8004 Agent Card | `GET /.well-known/agent.json` 返回 Agent 身份卡，DID 格式：`did:pkh:eip155:<chainId>:<address>` |
| ② 认证 | SIWE + JWT | AI 用私钥签名登录 → 获取 1h JWT + 30d 刷新令牌，全程无需浏览器 |
| ③ 通信 | A2A 协议 | `POST /api/a2a` JSON-RPC 2.0 格式，每条消息附带 EIP-191 签名 + nonce 防重放 |
| ④ 工具 | MCP Server | 8 个支付工具，支持 Streamable HTTP (`/api/mcp`) 和 stdio (`pnpm mcp:stdio`) |
| ⑤ 执行 | Agent API | 预算管理、支付提案、自动执行、Webhook 通知、活动审计 |
| ⑥ 机器支付 | x402 协议 | HTTP 402 + ERC-3009 无 Gas 授权，AI 间微支付 |

**认证路径：**

| 调用方 | 方式 | 流程 |
|--------|------|------|
| 浏览器用户 | Reown AppKit / Shamir SSS | 钱包签名或嵌入式钱包 |
| 注册 Agent | API Key (`x-api-key`) | `agent_xxx` 密钥 → SHA-256 哈希查找 |
| AI Wallet SDK | SIWE → JWT | EIP-4361 签名登录 → 1h 访问令牌 + 30d 刷新令牌 |
| 外部 Agent (A2A) | EIP-191 逐条签名 | 每条 JSON-RPC 消息都带密码学签名 |
| MCP 客户端 | JWT Bearer | Claude/GPT 先通过 SIWE 认证获取 JWT |

**MCP 工具列表：**

| 工具 | 认证 | 说明 |
|------|------|------|
| `list_supported_tokens` | 无需 | 查询支持的代币和链 |
| `get_payment_quote` | 无需 | 查询费用估算 |
| `create_payment` | JWT | 创建支付提案 |
| `check_payment_status` | JWT | 查询支付状态 |
| `list_payments` | JWT | 查询支付列表 |
| `create_invoice` | JWT | 创建收款发票 |
| `list_invoices` | JWT | 查询发票列表 |
| `get_balance` | JWT | 查询钱包余额 |

### 支持的区块链

| 链 | 类型 | 状态 | 说明 |
|----|------|------|------|
| **Ethereum** | EVM | ✅ | 主网支持，高价值结算 |
| **Polygon** | EVM L2 | ✅ | 低成本，高吞吐量 |
| **Arbitrum** | EVM L2 | ✅ | 领先的 L2 解决方案 |
| **Optimism** | EVM L2 | ✅ | OP Stack 生态 |
| **Base** | EVM L2 | ✅ | Coinbase 生态，连接 Web2 用户 |
| **BNB Chain** | EVM | ✅ | 亚洲最大生态 |
| **Solana** | Non-EVM | ✅ | 高性能，极速确认 |
| **Bitcoin** | Non-EVM | ✅ | 原生 BTC 转账支持 |
| **Tron (波场)** | Non-EVM | 🚧 | **[新增]** TRC20-USDT 深度集成中 |
| **HashKey** | EVM L1 | ✅ | RWA 结算，合规优先 |

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
- [功能文档](docs/FEATURES_DOCUMENTATION.md)
- [Go 服务架构](docs/GO_SERVICES_ARCHITECTURE.md)
- [安全架构](docs/SECURITY.md)
- [安全审计](docs/SECURITY_AUDIT.md)
- [HashKey 集成](docs/HASHKEY_INTEGRATION.md)

---

## AI Agent Quick Connect

### Use with Claude Desktop (MCP)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "protocol-banks": {
      "url": "https://app.protocolbanks.com/api/mcp"
    }
  }
}
```

Or download the full config: [mcp-config.json](https://app.protocolbanks.com/mcp-config.json)

### Use with OpenAI GPTs

Import the action schema when creating a custom GPT:

```text
https://app.protocolbanks.com/openai-action.json
```

### Use Programmatically (AI Wallet SDK)

```typescript
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

// 1. Get nonce
const { nonce } = await fetch('https://app.protocolbanks.com/api/auth/siwe/nonce').then(r => r.json())

// 2. Sign SIWE message & verify
const message = `app.protocolbanks.com wants you to sign in with your Ethereum account:\n${account.address}\n\nSign in to Protocol Banks\n\nURI: https://app.protocolbanks.com\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`
const signature = await account.signMessage({ message })
const { accessToken } = await fetch('https://app.protocolbanks.com/api/auth/siwe/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature })
}).then(r => r.json())

// 3. Make payments with JWT
await fetch('https://app.protocolbanks.com/api/payments', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: '0x...', amount: '100', token: 'USDC', chain: 'base' })
})
```

### Discovery Endpoints

| URL | Purpose |
| --- | ------- |
| [`/.well-known/agent.json`](https://app.protocolbanks.com/.well-known/agent.json) | ERC-8004 Agent Card |
| [`/llms.txt`](https://app.protocolbanks.com/llms.txt) | AI crawler summary |
| [`/llms-full.txt`](https://app.protocolbanks.com/llms-full.txt) | Full AI integration docs |
| [`/api/openapi`](https://app.protocolbanks.com/api/openapi) | OpenAPI 3.1 spec |
| [`/mcp-config.json`](https://app.protocolbanks.com/mcp-config.json) | MCP Server config |
| [`/openai-action.json`](https://app.protocolbanks.com/openai-action.json) | OpenAI GPT Action schema |

## Contact

- **Website**: [protocolbanks.com](https://protocolbanks.com)
- **GitHub**: [github.com/everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)
- **Email**: everest9812@gmail.com

## License

GNU General Public License v3.0 only (GPL-3.0-only) - see [LICENSE](LICENSE) for details.

For additional infringement and commercial compliance terms, see [ADDITIONAL_LEGAL_TERMS.md](ADDITIONAL_LEGAL_TERMS.md).

---

<div align="center">

**Built for the Web3 Future 🚀**

</div>
