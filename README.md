# Protocol Bank — The Control Plane for Agent Commerce

<div align="center">

![Protocol Bank Logo](public/logo.png)

**One credential. One server-enforced mandate. Every rail.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)](https://golang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![CI](https://github.com/everest-an/protocol-banks---web3/actions/workflows/ci.yml/badge.svg)](https://github.com/everest-an/protocol-banks---web3/actions/workflows/ci.yml)

[English](#overview) | [中文](#中文文档)

</div>

---

## Overview

Protocol Bank is the **control plane for agent commerce**. An agent gets one credential; the server enforces a mandate across **commerce, payments, cards and trading** — operations, per-call cap, daily cap, allowlist, budgets and audit. Agents can buy services, accept quotes, deliver proof, pay, or trade; cards are coming soon. They cannot widen the mandate or drain the account.

The **Agent API** is the product: commerce orders (services, quotes, delivery proof, payment binding, reputation), EIP-3009/x402 payments, cards in provider onboarding, and a trading-only Hyperliquid agent wallet. See [docs/AGENT_API.md](docs/AGENT_API.md), [docs/AGENT_COMMERCE.md](docs/AGENT_COMMERCE.md) and [docs/PRD_V3_AGENT_COMMERCE.md](docs/PRD_V3_AGENT_COMMERCE.md) for the strategy and reference.

**Core safety properties:**

- **The agent can act, never exceed the mandate** — policy and budgets are enforced server-side
- **Payments are payer-signed** — EIP-3009 moves the payer's own USDC; the platform holds no funds
- **Cards are coming soon** — one card per agent, issued through a provider; the issuer holds the card balance
- **Trading is trading-only** — the Hyperliquid wallet can place and cancel orders, never withdraw
- **Revocable anytime** — pause, rotate the key, or revoke the agent; card freeze follows provider onboarding

## The Product

| Area | Description |
|---|---|
| **Agent API** (`/agent-api`) | The product: one credential, one mandate, commerce + payments + trading; cards coming soon |
| **Agent Commerce** (`/agent-commerce`) | Services, quotes, orders, delivery proof, payment binding, disputes, refunds, reputation (API-first; escrow next) |
| **Trading Agent Wallet** (`/trading`) | Hyperliquid wallet approved with EIP-712 `approveAgent`; trade-only, never withdraw |
| **Agent Cards** (`/agents/[id]`) | Coming soon: virtual Visa cards scoped to one agent; provider onboarding is in progress. Balance will be held by the issuing partner. |
| **AI Trading Cockpit** (`/trading`) | The reference demo: balances, equity curve, plain-language activity feed, positions, pause/stop/reset |
| **Paper Engine** | Real Hyperliquid market data + simulated fills. Momentum (24h z-score) and funding-carry signals, +30% TP / -15% SL, 15% position sizing, 5%/8% daily circuit breakers |
| **Live Mode** | Agent wallet approval flow (EIP-712 `approveAgent`), AES-256-GCM key custody, real IOC orders, uncertain-order halt, per-user isolation |
| **Wallet** (`/balances`) | Multi-chain balances and activity |
| **Business** (collapsed) | Batch payments, invoices, subscriptions, acquiring, vendors — available as rails, no longer the hero |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Clients — HTTP · SDK · MCP · A2A · x402                      │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Agent API (/api/v1/agent)                                    │
│  state · orders · pay · swap · invoice                       │
│  commerce · wallet                                           │
│  one credential · one mandate · server-enforced              │
└──────────────────────────────────────────────────────────────┘
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   Commerce       Payments       Cards          Trading
   services       EIP-3009       Yativo/Rain    Hyperliquid
   quotes         x402           agent-scoped   trading-only
   orders         invoice        budgeted       wallet
   delivery       batch
   reputation     subscription
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Mandate + risk engine (lib/agent, lib/trading)               │
│  ops · per-call cap · daily cap · allowlist · budget · audit │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend — Next.js 15 (App Router, TypeScript, Tailwind)     │
│  Landing → Agent API → Commerce → Wallet/Cards → Trading demo│
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
pnpm install

# Configure (see .env.example / ENV_SETUP.md)
cp .env.example .env.local

# Develop
pnpm dev                # http://localhost:3000

# Run the trading agent headlessly (paper mode)
pnpm trading:agent

# MCP server — control the agent from Claude / any MCP host
pnpm mcp:stdio           # stdio transport (see docs/MCP.md)
pnpm mcp:test            # smoke-test tools/list + tools/call
```

## Testing & Quality Gates

| Command | What it runs |
|---|---|
| `pnpm test` | Jest — 1035 unit/property tests |
| `pnpm test:ui` | Playwright — browser E2E (own dev server on :3100) |
| `pnpm lint` | ESLint 9 (0-error gate; legacy debt as warnings) |
| `npx tsc --noEmit` | TypeScript typecheck |
| `pnpm build` | Production build (Vercel deploy gate) |
| `go test ./...` | Go microservices (in `services/*`) |

CI runs the full frontend suite (tsc + jest + lint) and Go tests on every push — see `.github/workflows/ci.yml`.

## Documentation

| Document | Description |
|---|---|
| [PRD v2 — AI Trading](docs/PRD_V2_AI_TRADING.md) | Product spec: positioning, cockpit, wallet architecture, strategy & risk parameters |
| [PRD v3 — Agent Commerce](docs/PRD_V3_AGENT_COMMERCE.md) | Phase 3 strategy: PayAI due diligence, control plane, x402/card/wallet combination, roadmap and KPIs |
| [MCP Server](docs/MCP.md) | Control the trading agent from Claude Desktop / Claude Code / any MCP host |
| [Usage Guide](https://protocolbanks.com/help) | In-product guide (getting started, cockpit, going live, FAQ) |
| [Risk Disclosure](https://protocolbanks.com/risk-disclosure) | **Read before live trading** |
| [Threat Model](docs/SECURITY_THREAT_MODEL.md) | Assets, trust boundaries and known limitations (uncertain orders, ledger drift, key custody) |
| [Terms](https://protocolbanks.com/terms) / [Privacy](https://protocolbanks.com/privacy) | Legal |
| [ENV_SETUP.md](ENV_SETUP.md) | Environment configuration |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Test infrastructure details |
| [Agent API](docs/AGENT_API.md) | Programmatic surface for agents: policy, endpoints, errors, billing |
| [Agent API contract](docs/api/agent.openapi.json) | OpenAPI 3.1 for the five agent endpoints — policy schema, error classes, real examples |
| [Agent API cases](docs/AGENT_CASES.md) | Four worked integrations with real requests and responses |
| [Agent tools](docs/AGENT_TOOLS.md) | One tool manifest for the Vercel AI SDK, LangChain, OpenAI and Anthropic |
| [Open client (MIT)](https://github.com/everest-an/protocolbanks-sdk) | SDK, tool manifest, MCP proxy and framework starters — open source |
| [Partners](docs/PARTNERS.md) | Partner integration guide (curl, SDK, sandbox, billing) |

Legacy payment-era docs remain in `docs/` for the Business feature set.

## Security Model

- **SIWE + JWT** authentication for wallet users (`lib/auth/siwe.ts`, `lib/middleware/api-auth.ts`)
- **Non-custodial**: user keys never leave their wallet; agent keys are trading-only and encrypted at rest
- **Risk guardrails** enforced before every order (lib/trading/risk.ts)
- **Per-user isolation**: `TradingAccount` / `TradeRecord` models with wallet-address scoping
- Rate limiting, CSRF, replay protection, security headers (middleware.ts)

## License

Copyright (C) 2026 Protocol Banks Contributors.

GNU General Public License v3.0 only (GPL-3.0-only) — see [LICENSE](LICENSE) and [ADDITIONAL_LEGAL_TERMS.md](docs/legal/ADDITIONAL_LEGAL_TERMS.md).

---

## 中文文档

### 项目简介

Protocol Bank 是面向 AI Agent 的 **Agent Commerce 控制面**。一个 agent 凭证，一套由服务端强制的 mandate，覆盖 **commerce / payments / cards / trading**：操作范围、单笔上限、每日上限、白名单、预算与审计。Agent 可以购买服务、接受报价、交付证明、付款、刷卡或交易，但无法放宽 mandate，也无法掏空账户。

**核心安全属性：**

- **Agent 可以行动，但不能越权**——策略与预算在服务端强制
- **付款由付款方签名**——EIP-3009 移动付款方自己的 USDC，平台不持有资金
- **卡按 agent 隔离且有预算**——一卡一 agent，开卡/充值/结算消耗该 agent 预算
- **交易仅限交易权限**——Hyperliquid 钱包可下单/撤单，永远无法提现
- **随时可撤销**——暂停、轮换 key、冻结卡、或在 Hyperliquid 上撤销 agent

### 核心功能

| 模块 | 说明 |
|---|---|
| **Agent API** (`/agent-api`) | 产品本体：一个凭证、一套 mandate，覆盖 commerce + payments + cards + trading |
| **Agent Commerce** (`/agent-commerce`) | 服务、报价、订单、交付证明、付款绑定、争议、退款、声誉（API-first；escrow 下一步） |
| **Trading Agent Wallet** (`/trading`) | Hyperliquid 钱包，EIP-712 approveAgent 批准；可交易、不可提现 |
| **Agent Cards** (`/agents/[id]`) | 按 agent 隔离的虚拟 Visa 卡：通过 Yativo / Rain 开卡；余额由发卡合作方持有 |
| **AI 交易驾驶舱** (`/trading`) | 参考演示：余额、净值曲线、自然语言活动流、持仓、暂停/停止/重置 |
| **Paper 引擎** | 真实 Hyperliquid 行情 + 模拟成交。动量（24h z-score）+ 资金费率信号，+30% 止盈 / -15% 止损，15% 仓位，5%/8% 日内熔断 |
| **Live 模式** | Agent 钱包批准流（EIP-712 approveAgent）、AES-256-GCM 密钥托管、真实 IOC 下单、不确定订单安全停机、每用户隔离 |
| **钱包** (`/balances`) | 多链余额与流水 |
| **Business**（折叠区） | 批量支付、发票、订阅、收单、联系人——作为 rail 保留 |

### 快速开始

```bash
pnpm install
cp .env.example .env.local   # 见 ENV_SETUP.md
pnpm dev                     # http://localhost:3000
pnpm trading:agent           # 后台常驻运行交易 agent（paper 模式）
pnpm mcp:stdio               # MCP server：在 Claude 里查询/控制 agent（见 docs/MCP.md）
```

### 测试与质量门禁

| 命令 | 内容 |
|---|---|
| `pnpm test` | Jest — 1321 项单元/属性测试 |
| `pnpm test:ui` | Playwright 浏览器 E2E |
| `pnpm lint` | ESLint 9（0 错误门禁） |
| `npx tsc --noEmit` | 类型检查 |
| `pnpm build` | 生产构建（Vercel 部署门禁） |
| `go test ./...` | Go 微服务测试 |

### 文档

| 文档 | 说明 |
|---|---|
| [PRD v2 — AI 交易](docs/PRD_V2_AI_TRADING.md) | AI 交易垂直规格 |
| [PRD v3 — Agent Commerce](docs/PRD_V3_AGENT_COMMERCE.md) | 第三阶段战略：PayAI 尽调、控制面、x402/card/wallet 组合、路线图与 KPI |
| [MCP Server](docs/MCP.md) | 在 Claude 等 MCP 客户端里查询/控制交易 agent |
| [使用指南](https://protocolbanks.com/help) | 上手、驾驶舱、上线流程、FAQ |
| [风险披露](https://protocolbanks.com/risk-disclosure) | **实盘前必读** |
| [条款](https://protocolbanks.com/terms) / [隐私](https://protocolbanks.com/privacy) | 法律文档 |

> ⚠️ **风险提示**：自动交易可能导致交易钱包全部损失。AI 是工具而非收益保证，历史表现不代表未来结果。Protocol Bank 不提供投资建议。
