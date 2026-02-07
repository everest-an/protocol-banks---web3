# Protocol Banks

<div align="center">

![Protocol Banks Logo](public/logo.png)

**企业级 Web3 支付基础设施 | Enterprise-Grade Web3 Payment Infrastructure**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 📢 项目简介
Protocol Banks 是一个非托管、多链支付解决方案，专为 DAO、AI Agent 和企业级用户设计。通过抽象链上复杂性，提供统一的财务管理界面，支持批量支付、多签审批、订阅管理等企业级功能。我们致力于连接传统金融工作流与 Web3 价值网络，为下一代数字经济体提供可编程的资金管理层。

### 🏗️ 系统架构

```
┌────────────────────────────────────────────────────────┐
│                      用户层 (User Layer)               │
├────────────────────────────────────────────────────────┤
│  Web Browser (PWA)  │  Mobile App (PWA)  │  API Clients│
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      前端层 (Frontend Layer)           │
├────────────────────────────────────────────────────────┤
│                       Next.js 15 (App Router)          │
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      API 层 (API Layer)                │
├────────────────────────────────────────────────────────┤
│                    Next.js API Routes / gRPC           │
│ /auth | /agents | /payments | /webhooks | /x402        │
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      服务层 (Services Layer)           │
├────────────────────────────────────────────────────────┤
│  Go 微服务集群 (Microservices)                         │
│ Payout Engine | Event Indexer | Agent Service          │
│ Webhook Handler | Subscription | Settlement            │
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      数据与基础设施层                   │
├────────────────────────────────────────────────────────┤
│ PostgreSQL | Redis | Vault | Blockchain (Multi-Chain)  │
└────────────────────────────────────────────────────────┘
```

### ✅ 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| 🔐 **双模式认证** | 个人用户 (Email/Google + 嵌入式钱包) / 企业用户 (硬件钱包) | ✅ 已完成 |
| 💸 **单笔支付** | 多链支付，支持 ENS 解析，实时 Gas 估算 | ✅ 已完成 |
| 📤 **批量支付** | Excel/CSV 导入，500+ TPS 并发处理，支持 x402 协议代付 Gas | ✅ 已完成 |
| 🛡️ **多签钱包** | Gnosis Safe 协议，移动端审批，推送通知 | ✅ 已完成 |
| 🌉 **跨链操作** | Rango Exchange 聚合，ZetaChain 桥接，CCTP 支持 | ✅ 已完成 |
| 📅 **订阅管理** | 定期支付，自动扣款，余额监控 | ✅ 已完成 |
| 🤖 **Agent Link API** | [新增] 专为 AI Agent 设计的金融接口，支持预算申请与自动执行 | ✅ 已完成 |
| 🛒 **Settlement Checkout** | [新增] 统一结算收银台，支持多币种混合支付与智能路由 | ✅ 已完成 |
| 🔔 **Webhook** | 事件通知，HMAC 签名验证 | ✅ 已完成 |
| 📊 **分析仪表板** | 实时余额，交易历史，网络图可视化 | ✅ 已完成 |

### 🔗 支持的区块链

我们致力于全链支持，打破生态壁垒：

| 链 | 类型 | 状态 | 说明 |
|----|------|------|------|
| **Ethereum** | EVM | ✅ | 主网支持，适合高价值结算 |
| **Polygon** | EVM L2 | ✅ | 低成本，高吞吐量 |
| **Arbitrum** | EVM L2 | ✅ | 领先的 L2 解决方案 |
| **Optimism** | EVM L2 | ✅ | OP Stack 生态支持 |
| **Base** | EVM L2 | ✅ | Coinbase 生态，连接 Web2 用户 |
| **Solana** | Non-EVM | ✅ | 高性能链，极速确认 |
| **Bitcoin** | Non-EVM | ✅ | 原生 BTC 转账支持 |
| **Tron (波场)** | Non-EVM | 🚧 | **[新增]** TRC20-USDT 深度集成中 |

---

## English

### 📢 Introduction
Protocol Banks is a non-custodial, multi-chain payment solution designed for DAOs, AI Agents, and enterprise users. By abstracting on-chain complexities, it provides a unified financial management interface supporting batch payments, multi-sig approvals, subscription management, and more. We bridge traditional financial workflows with the Web3 value network, enabling a programmable treasury layer for the next-generation digital economy.

### 🏗️ Architecture

(See Architecture Diagram above)

### ✅ Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| 🔐 **Dual Auth** | Personal (Email/Google) / Enterprise (Hardware Wallet) | ✅ Live |
| 💸 **Payments** | Multi-chain support, ENS resolution, Real-time Gas estimation | ✅ Live |
| 📤 **Batch Pay** | Excel/CSV import, 500+ TPS, x402 Protocol (Gasless) | ✅ Live |
| 🛡️ **Multi-Sig** | Gnosis Safe integration, Mobile approvals | ✅ Live |
| 🌉 **Cross-Chain** | Rango & CCTP integration for seamless bridging | ✅ Live |
| 📅 **Subscriptions**| Recurring payments, auto-debit logic | ✅ Live |
| 🤖 **Agent Link** | **[NEW]** Financial API for AI Agents (Budgeting & Execution) | ✅ Live |
| 🛒 **Settlement** | **[NEW]** Unified Checkout supporting mixed-currency payments | ✅ Live |
| 🔔 **Webhooks** | Event notifications with HMAC security | ✅ Live |
| 📊 **Analytics** | Real-time balances, transaction graphs | ✅ Live |

### 🔗 Supported Chains

| Chain | Type | Status | Note |
|-------|------|--------|------|
| **Ethereum** | EVM | ✅ | Mainnet for high-value settlement |
| **Polygon** | EVM L2 | ✅ | Low cost, high throughput |
| **Arbitrum** | EVM L2 | ✅ | Leading L2 solution |
| **Optimism** | EVM L2 | ✅ | OP Stack ecosystem |
| **Base** | EVM L2 | ✅ | Coinbase layer |
| **Solana** | Non-EVM | ✅ | High performance |
| **Bitcoin** | Non-EVM | ✅ | Native BTC support |
| **Tron** | Non-EVM | 🚧 | **[NEW]** TRC20-USDT integration coming soon |

### 🚀 Getting Started

1.  **Clone Repository**
    ```bash
    git clone https://github.com/everest-an/protocol-banks---web3.git
    cd protocol-banks---web3
    ```

2.  **Install Dependencies**
    ```bash
    pnpm install
    ```

3.  **Environment Setup**
    Copy `.env.example` to `.env.local` and configure your API keys (Supabase, Alchemy, etc.).

4.  **Run Development Server**
    ```bash
    pnpm dev
    ```

### 📄 License

MIT License. See [LICENSE](LICENSE) for details.
