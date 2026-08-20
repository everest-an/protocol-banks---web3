# Protocol Bank — AI Automated Trading

<div align="center">

![Protocol Bank Logo](public/logo.png)

**Your AI trades. You keep control.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)](https://golang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![CI](https://github.com/everest-an/protocol-banks---web3/actions/workflows/ci.yml/badge.svg)](https://github.com/everest-an/protocol-banks---web3/actions/workflows/ci.yml)

[English](#overview) | [中文](#中文文档)

</div>

---

## Overview

Protocol Bank is an **AI automated trading product**. Users connect a wallet (MetaMask), fund a trading budget on Hyperliquid, approve a trading-only agent wallet, and an AI agent trades perpetual markets around the clock — with strict risk controls, full transparency, and instant revocation. A paper-trading mode runs on real market data with simulated money, so anyone can watch the agent work risk-free.

**Core safety properties:**

- **The AI can trade, never withdraw** — the agent wallet holds trading-only permissions on Hyperliquid
- **Worst case is written on the screen** — the trading wallet is the maximum possible loss
- **Guarded by construction** — per-trade stop-loss, position caps, daily loss circuit breakers
- **Revocable anytime** — pause, emergency stop, or revoke the agent on Hyperliquid

## The Product

| Area | Description |
|---|---|
| **AI Trading Cockpit** (`/trading`) | Post-login landing: balances, equity curve, plain-language AI activity feed, open positions, pause/stop/reset controls |
| **Paper Engine** | Real Hyperliquid market data + simulated fills. Momentum (24h z-score) and funding-carry signals, 2.5% TP/SL, 15% position sizing, 5%/8% daily circuit breakers |
| **Live Mode** | Agent wallet approval flow (EIP-712 `approveAgent`), AES-256-GCM key custody, real order placement, per-user isolation schema |
| **Wallet** (`/balances`) | Multi-chain balances and activity (merged from the legacy dashboard) |
| **Business** (collapsed) | The legacy enterprise payment suite: batch payments, invoices, subscriptions, acquiring, vendors — available but no longer the hero |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend — Next.js 15 (App Router, TypeScript, Tailwind)     │
│  Landing → AI Trading cockpit → Wallet → Business (collapsed)│
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ API Routes (app/api)                                         │
│  /api/trading/overview  — tick-on-demand cockpit state       │
│  /api/trading/actions   — pause / resume / stop / reset      │
│  /api/trading/live/*    — agent wallet lifecycle (SIWE-auth) │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Trading engine (lib/trading)                                 │
│  hyperliquid.ts — market data client (meta/ctxs/candles)     │
│  strategies.ts  — momentum + funding signals (pure)          │
│  risk.ts        — sizing, TP/SL, circuit breakers            │
│  agent.ts       — scan → signal → risk → execute → report    │
│  exchange.ts    — signed live orders (EIP-712)               │
│  keys.ts        — per-user agent key custody (AES-256-GCM)   │
│  store.ts       — paper state (file storage, tmp fallback)  │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
  Hyperliquid (public info API + signed exchange API)
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
| [Usage Guide](https://protocolbanks.com/help) | In-product guide (getting started, cockpit, going live, FAQ) |
| [Risk Disclosure](https://protocolbanks.com/risk-disclosure) | **Read before live trading** |
| [Terms](https://protocolbanks.com/terms) / [Privacy](https://protocolbanks.com/privacy) | Legal |
| [ENV_SETUP.md](ENV_SETUP.md) | Environment configuration |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Test infrastructure details |

Legacy payment-era docs remain in `docs/` for the Business feature set.

## Security Model

- **SIWE + JWT** authentication for wallet users (`lib/auth/siwe.ts`, `lib/middleware/api-auth.ts`)
- **Non-custodial**: user keys never leave their wallet; agent keys are trading-only and encrypted at rest
- **Risk guardrails** enforced before every order (lib/trading/risk.ts)
- **Per-user isolation**: `TradingAccount` / `TradeRecord` models with wallet-address scoping
- Rate limiting, CSRF, replay protection, security headers (middleware.ts)

## License

GNU General Public License v3.0 only (GPL-3.0-only) — see [LICENSE](LICENSE) and [ADDITIONAL_LEGAL_TERMS.md](ADDITIONAL_LEGAL_TERMS.md).

---

## 中文文档

### 项目简介

Protocol Bank 是一款 **AI 自动交易产品**。用户连接钱包（MetaMask），在 Hyperliquid 存入交易预算，批准一个仅有交易权限的 agent 钱包后，AI 代理全天候交易永续合约市场——配有严格风控、全程透明、随时可撤销。Paper 模式使用真实行情 + 模拟资金，任何人都可以零风险体验。

**核心安全属性：**

- **AI 只能交易，永远无法提现**——agent 钱包在 Hyperliquid 上仅有交易权限
- **最大亏损永远写在屏幕上**——交易钱包余额即最大可亏损额
- **风控内建于每笔订单**——止损、仓位上限、日内亏损熔断
- **随时可撤销**——暂停、紧急停止、或在 Hyperliquid 上撤销 agent

### 核心功能

| 模块 | 说明 |
|---|---|
| **AI 交易驾驶舱** (`/trading`) | 登录后落地页：余额、净值曲线、自然语言 AI 活动流、持仓、暂停/停止控制 |
| **Paper 引擎** | 真实 Hyperliquid 行情 + 模拟成交。动量（24h z-score）+ 资金费率信号，±2.5% 止盈止损，15% 仓位，5%/8% 日内熔断 |
| **Live 模式** | Agent 钱包批准流（EIP-712 approveAgent）、AES-256-GCM 密钥托管、真实下单、每用户隔离 schema |
| **钱包** (`/balances`) | 多链余额与流水（合并自旧 Dashboard） |
| **Business**（折叠区） | 企业支付套件：批量支付、发票、订阅、收单、联系人——保留但不再主推 |

### 快速开始

```bash
pnpm install
cp .env.example .env.local   # 见 ENV_SETUP.md
pnpm dev                     # http://localhost:3000
pnpm trading:agent           # 后台常驻运行交易 agent（paper 模式）
```

### 测试与质量门禁

| 命令 | 内容 |
|---|---|
| `pnpm test` | Jest — 1035 项单元/属性测试 |
| `pnpm test:ui` | Playwright 浏览器 E2E |
| `pnpm lint` | ESLint 9（0 错误门禁） |
| `npx tsc --noEmit` | 类型检查 |
| `pnpm build` | 生产构建（Vercel 部署门禁） |
| `go test ./...` | Go 微服务测试 |

### 文档

| 文档 | 说明 |
|---|---|
| [PRD v2 — AI 交易](docs/PRD_V2_AI_TRADING.md) | 产品规格 |
| [使用指南](https://protocolbanks.com/help) | 上手、驾驶舱、上线流程、FAQ |
| [风险披露](https://protocolbanks.com/risk-disclosure) | **实盘前必读** |
| [条款](https://protocolbanks.com/terms) / [隐私](https://protocolbanks.com/privacy) | 法律文档 |

> ⚠️ **风险提示**：自动交易可能导致交易钱包全部损失。AI 是工具而非收益保证，历史表现不代表未来结果。Protocol Bank 不提供投资建议。
