# Protocol Banks — Feature Documentation

> **Enterprise-Grade Non-Custodial Multi-Chain Web3 Payment Infrastructure**
>
> Designed for DAOs, AI Agents, and Enterprise Treasury Management
>
> Live: [protocolbank.vercel.app](https://protocolbank.vercel.app) · Last updated: 2026-02-07

---

## Table of Contents

- [1. Payment Engine](#1-payment-engine)
- [2. AI Agent Framework](#2-ai-agent-framework)
- [3. Merchant Acquiring & POS](#3-merchant-acquiring--pos)
- [4. Multi-Chain Support](#4-multi-chain-support)
- [5. Cross-Chain Operations](#5-cross-chain-operations)
- [6. Authentication & Identity](#6-authentication--identity)
- [7. Security Framework](#7-security-framework)
- [8. Treasury & Financial Management](#8-treasury--financial-management)
- [9. Team & Access Control](#9-team--access-control)
- [10. Developer Platform](#10-developer-platform)
- [11. Admin & Operations](#11-admin--operations)
- [12. Integrations](#12-integrations)

---

## 13. Upcoming: pbUSD Stablecoin

**Synthetic Stablecoin for Emerging Chains**

To solve liquidity fragmentation on new chains (like HashKey Chain) that lack native stablecoin support, Protocol Bank issues its own backed asset.

- **Backed 1:1**: Every `pbUSD` is backed by USDC held in our Base Treasury.
- **Instant Bridge**: "Mint-and-Burn" mechanism allows near-instant transfers between Base and HashKey.
- **Payroll Ready**: Designed specifically for payroll settlement where recipients accept the asset within the Protocol Bank ecosystem.

See [pbUSD Design Doc](PBUSD_DESIGN.md) for technical details.


### 1.1 Single Payment

Send crypto to any wallet address on any supported chain.

| Feature | Details |
|---------|---------|
| **Supported tokens** | USDC, USDT, DAI, WETH, WBTC + native tokens |
| **Address resolution** | ENS, raw hex, TRON Base58 |
| **Gas estimation** | Real-time gas price + fee preview |
| **Transaction tracking** | On-chain confirmation with Etherscan/Tronscan links |
| **Sound feedback** | Ambient audio branding (Personal mode: airy/shimmer, Business mode: heavy/mechanical) |

**Route**: `/pay`, `/send`
**API**: `POST /api/payment`

---

### 1.2 Batch Payment

Process hundreds of payments in a single operation with CSV/Excel import.

| Feature | Details |
|---------|---------|
| **Throughput** | 500+ TPS via Go payout-engine |
| **File formats** | CSV, Excel (.xlsx) |
| **Chunk processing** | Large batches split into manageable chunks |
| **Status tracking** | Real-time progress: pending → processing → completed/partial_failure/failed |
| **Smart contract** | `BatchTransfer.sol` — batch ERC-20 transfers in single tx (max 200 per tx) |
| **Platform fee** | Configurable basis points collected per transfer |
| **Retry queue** | Failed transactions auto-retry with exponential backoff |

**Route**: `/batch-payment`
**API**: `POST /api/batch-payment`, `POST /api/batch-payment/execute`
**Cron**: `/api/cron/process-batch` (every minute)

---

### 1.3 Split Payment

Revenue distribution to multiple recipients with configurable ratios.

| Feature | Details |
|---------|---------|
| **Split types** | Percentage-based, fixed-amount |
| **Templates** | Reusable split templates (e.g., "Team Salary", "Revenue Share") |
| **Execution** | Atomic multi-recipient distribution |
| **Calculation** | Real-time preview with `/api/split-payment/calculate` |

**Route**: `/split-payments`
**API**: `POST /api/split-payment`, `GET /api/split-payment/templates`

---

### 1.4 Scheduled / Recurring Payment

Set up automatic payments on a schedule.

| Feature | Details |
|---------|---------|
| **Frequencies** | Daily, weekly, monthly, custom |
| **Timezone** | User-configurable timezone |
| **Execution** | Server-side cron-based execution |
| **Monitoring** | Execution logs with success/failure tracking |

**Route**: `/subscriptions`
**API**: `POST /api/scheduled-payments`
**Cron**: `/api/cron/execute-scheduled-payments` (every hour)

---

### 1.5 Subscription Auto-Pay

Enterprise-grade recurring billing with ERC-3009 authorization.

| Feature | Details |
|---------|---------|
| **Authorization** | ERC-3009 `transferWithAuthorization` — gasless for payers |
| **Balance checks** | Pre-execution balance verification |
| **Notifications** | Reminder before charge, receipt after charge |
| **Management** | Pause, resume, cancel subscriptions |
| **MCP integration** | Model Context Protocol subscription management |

**Route**: `/subscriptions`, `/subscriptions/mcp`
**API**: `POST /api/subscriptions`, `POST /api/subscriptions/[id]/execute`

---

### 1.6 x402 Protocol — Gasless Payments

Native HTTP 402 payment protocol using ERC-3009 gasless token transfers.

| Feature | Details |
|---------|---------|
| **Standard** | ERC-3009 `transferWithAuthorization` |
| **Supported tokens** | USDC, USDT, DAI (on Ethereum, Polygon, Base, Arbitrum) |
| **Flow** | Generate auth → Sign (client-side EIP-712) → Store signature → Execute via relayer |
| **Relayer** | Configurable relayer network for meta-transactions |
| **Settlement** | On-chain settlement with proof tracking |
| **Fee** | Configurable protocol fee per transaction |

**API**: `POST /api/x402/authorize`, `POST /api/x402/execute`, `POST /api/x402/settle`, `POST /api/x402/verify`

---

### 1.7 Multi-Sig Payments

Gnosis Safe protocol integration for multi-signature treasury management.

| Feature | Details |
|---------|---------|
| **Protocol** | Gnosis Safe (EIP-1271) |
| **Thresholds** | Configurable (2-of-3, 3-of-5, etc.) |
| **Proposal flow** | Create → Approve → Execute |
| **Mobile approval** | Approve transactions from any device |
| **Wallet management** | Create, import, configure multi-sig wallets |

**Route**: `/settings/multisig`

---

### 1.8 Payment Channels

Off-chain payment channels for high-frequency micro-payments.

| Feature | Details |
|---------|---------|
| **Channel lifecycle** | Open → Fund → Transact → Settle → Close |
| **Settlement** | On-chain settlement with final state proof |
| **Use case** | Streaming payments, API metering, gaming |

---

## 2. AI Agent Framework

### 2.1 Agent Management

Register and manage AI agents that can autonomously propose and execute payments.

| Feature | Details |
|---------|---------|
| **Registration** | Create agents with name, description, capabilities |
| **API key auth** | Each agent gets its own API key for authentication |
| **Status management** | Active, paused, deactivated |
| **Emergency controls** | Pause all / resume all agents for an owner |

**Route**: `/agents`, `/agents/[id]`
**API**: `POST /api/agents`, `PATCH /api/agents/[id]`

---

### 2.2 Payment Proposals

Agents propose payments that can be auto-executed or require human approval.

| Feature | Details |
|---------|---------|
| **Proposal flow** | Propose → (Auto-approve OR Manual review) → Execute |
| **Auto-execute rules** | Max amount, allowed tokens, allowed recipients, allowed chains |
| **Human-in-the-loop** | Owner receives notification for manual approval when rules are violated |

**Route**: `/agents/proposals`
**API**: `POST /api/agents/proposals`

---

### 2.3 Budget Management

Configurable spending limits for AI agents.

| Feature | Details |
|---------|---------|
| **Budget periods** | Daily, weekly, monthly |
| **Per-token budgets** | Set limits per token (e.g., 1000 USDC/month) |
| **Auto-reset** | Cron-based budget reset on period expiry |
| **Budget alerts** | Notifications when budget is running low |
| **Availability check** | Pre-execution budget verification |

**Cron**: `/api/cron/budget-reset` (every 30 min)

---

### 2.4 Auto-Execute Engine

Rules-based automatic payment execution for trusted agent operations.

| Feature | Details |
|---------|---------|
| **Execution strategy** | x402/relayer (gasless) → Payout bridge (Go engine / TS fallback) |
| **Rule types** | `max_single_amount`, `allowed_tokens`, `allowed_recipients`, `allowed_chains` |
| **Budget enforcement** | Payment must be within budget to auto-execute |
| **Notifications** | Owner notified of every auto-execution and every manual-approval-needed event |
| **Activity logging** | Full audit trail of all agent activities |

---

### 2.5 Agent Analytics

| Feature | Details |
|---------|---------|
| **Metrics** | Total payments, success rate, budget utilization |
| **Activity logs** | Timestamped event log (created, approved, executed, failed) |
| **Webhook delivery** | Agent-specific webhook events |

**API**: `GET /api/agents/analytics`, `GET /api/agents/activities`

---

## 3. Merchant Acquiring & POS

### 3.1 Merchant Management

| Feature | Details |
|---------|---------|
| **Onboarding** | Register merchants with business details |
| **API keys** | Merchant-specific API keys for SDK integration |
| **Balance tracking** | Per-merchant balance accounting |
| **Order management** | Create, track, and manage orders |

**Route**: `/acquiring`, `/acquiring/merchants`
**API**: `POST /api/acquiring/merchants`, `GET /api/acquiring/orders`

---

### 3.2 Payment Links

Shareable payment links with optional branding and QR codes.

| Feature | Details |
|---------|---------|
| **Shareable URL** | `/p/[id]` — public payment pages |
| **QR codes** | Auto-generated QR codes for in-person use |
| **Customization** | Amount, token, description, expiry |
| **Event tracking** | Views, payments, completions logged |

**Route**: `/receive`, `/p/[id]`
**API**: `POST /api/acquiring/payment-links`

---

### 3.3 Invoicing

On-chain invoices with PDF export and blockchain transaction linking.

| Feature | Details |
|---------|---------|
| **Invoice creation** | Items, amounts, due dates, payment terms |
| **PDF export** | Professional invoice PDF generation |
| **Blockchain linking** | Link on-chain tx hash to invoice |
| **Status tracking** | Draft → Sent → Paid → Overdue |

**Route**: `/acquiring/invoices`
**API**: `POST /api/invoice`, `GET /api/invoice/export`

---

### 3.4 POS Terminal

In-person payment terminal with QR code display.

| Feature | Details |
|---------|---------|
| **QR display** | Full-screen QR code for customer scanning |
| **Amount entry** | Keypad input with token selection |
| **Crypto/fiat toggle** | Switch between crypto and fiat display |
| **Settings persistence** | LocalStorage-based configuration |

**Route**: `/terminal`

---

### 3.5 Checkout & Embed SDK

Embeddable checkout widget for third-party websites.

| Feature | Details |
|---------|---------|
| **Embed widget** | `<iframe>` or JS SDK for any website |
| **Checkout flow** | Amount → Wallet connect → Pay → Confirm |
| **Demo mode** | Sandbox mode for testing |
| **Payment verification** | Server-side verification via `/api/verify-payment` |

**Route**: `/checkout`, `/embed`, `/embed/pay`

---

## 4. Multi-Chain Support

### 4.1 EVM Networks

| Network | Chain ID | RPC | Explorer |
|---------|----------|-----|----------|
| Ethereum Mainnet | 1 | Infura/Alchemy | etherscan.io |
| Sepolia Testnet | 11155111 | Infura | sepolia.etherscan.io |
| Base | 8453 | Base RPC | basescan.org |
| Arbitrum One | 42161 | Arbitrum RPC | arbiscan.io |
| BNB Smart Chain | 56 | BSC RPC | bscscan.com |
| Polygon | 137 | Polygon RPC | polygonscan.com |
| Optimism | 10 | Optimism RPC | optimistic.etherscan.io |
| HashKey Chain | 177 | HashKey RPC | hashkey explorer |
| ZetaChain | 7000 | ZetaChain RPC | zetachain explorer |

### 4.2 Non-EVM Networks

| Network | Address Format | Status |
|---------|---------------|--------|
| TRON Mainnet | Base58 (T-prefix, 34 chars) | ✅ Full support |
| TRON Nile Testnet | Base58 (T-prefix) | ✅ Testnet |
| Bitcoin | Via ZetaChain ZRC-20 bridge | ✅ Bridge support |
| Solana | Via ZetaChain ZRC-20 bridge | ✅ Bridge support |

### 4.3 Token Support

| Token | ERC-3009 Gasless | Chains |
|-------|-----------------|--------|
| USDC | ✅ | ETH, Polygon, Base, Arbitrum |
| USDT | ✅ | ETH, Polygon, Base, Arbitrum |
| DAI | ✅ | ETH, Polygon, Base, Arbitrum |
| WETH | ❌ | All EVM chains |
| WBTC | ❌ | All EVM chains |
| Native (ETH/MATIC/BNB) | ❌ | Respective chains |

### 4.4 Vendor Multi-Network Addresses

Vendors can register addresses across multiple networks:

```
Vendor "Acme Corp"
├── EVM:  0x742d35Cc6634C0532925a3b844Bc9E7595f0beB2
├── TRON: TN3W4H6rK2ce4vX9YnFQHwKENnHjoxbSfR
├── SOL:  7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
└── BTC:  bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
```

**API**: `POST /api/vendors/[id]/addresses`

---

## 5. Cross-Chain Operations

### 5.1 Cross-Chain Swap (Rango Exchange)

| Feature | Details |
|---------|---------|
| **Aggregator** | Rango Exchange — 50+ chains, 100+ DEXs |
| **Swap types** | Same-chain swap, cross-chain bridge+swap |
| **Quote engine** | Best route selection across protocols |
| **Slippage** | Configurable slippage tolerance |

**Route**: `/swap`
**API**: `GET /api/rango`

---

### 5.2 Omnichain Vault (ZetaChain)

| Feature | Details |
|---------|---------|
| **Protocol** | ZetaChain omnichain messaging |
| **Capabilities** | BTC/SOL/ETH bridging via ZRC-20 tokens |
| **DEX** | ZunoDex integration for ZRC-20 swaps |
| **Cross-chain calls** | Omnichain smart contract interactions |

**Route**: `/omnichain`

---

### 5.3 Off-Ramp (Crypto → Fiat)

| Provider | Method | Currencies |
|----------|--------|------------|
| Coinbase | Direct conversion | USD, EUR, GBP |
| Bridge.xyz | API integration | USD |
| Transak | Widget + webhook | 60+ currencies |
| MoonPay | Widget | 30+ currencies |

**Route**: `/offramp`
**API**: `POST /api/offramp`

---

## 6. Authentication & Identity

### 6.1 Consumer Authentication (Reown AppKit)

| Feature | Details |
|---------|---------|
| **Wallet connectors** | 300+ wallets (MetaMask, Coinbase, WalletConnect, etc.) |
| **Social login** | Email, Google, Apple → embedded wallet |
| **Fiat on-ramp** | Built-in fiat purchase integration |
| **Session management** | Persistent wallet connection |

### 6.2 Enterprise Authentication (Custom Non-Custodial)

| Feature | Details |
|---------|---------|
| **Key management** | Shamir Secret Sharing (2-of-3 threshold) in GF(256) |
| **Share A** | Device (IndexedDB, AES-256-GCM encrypted) |
| **Share B** | Server (PostgreSQL via Prisma, PIN-encrypted) |
| **Share C** | Recovery code (given to user at registration) |
| **Magic Link** | Email-based passwordless auth (15-min expiry, 5 max attempts) |
| **OAuth** | Google, Apple sign-in |
| **PIN** | PBKDF2 (100,000 iterations) → AES-256-GCM |
| **Zero-knowledge** | Server cannot reconstruct private keys alone |
| **Sessions** | 30-day sessions, 7-day refresh threshold |

### 6.3 Session Keys

Delegated session keys for scoped, time-limited operations.

| Feature | Details |
|---------|---------|
| **Scoping** | Limit to specific operations and amounts |
| **Expiry** | Configurable TTL |
| **Revocation** | Instant revocation by owner |

**Route**: `/settings/session-keys`
**API**: `POST /api/session-keys`

---

## 7. Security Framework

### 7.1 Input & Address Security

- **EIP-55 checksum** verification (safe for mixed-case addresses)
- **Homograph attack** prevention (Unicode confusable detection)
- **Address poisoning** detection
- **ENS resolution** validation
- **Input sanitization** — XSS, SQL injection, path traversal prevention

### 7.2 Transaction Security

- **Amount verification** — client vs. server cross-check
- **Transaction integrity hashing** — tamper-proof payment records
- **Double-spend prevention** — nonce management service
- **Replay protection** — chain-specific signature verification

### 7.3 DeFi Attack Prevention

- **MEV/Sandwich attack** analysis and warnings
- **Flash loan** protection detection
- **Malicious approval** detection (unlimited allowance)
- **Permit2 phishing** protection
- **Contract upgrade attack** detection (proxy backdoors)
- **State corruption** detection
- **Griefing** prevention

### 7.4 Network Security

- **DNS rebinding** detection
- **BGP hijacking** indicators
- **Rate limiting** — 100 req/min general, 30 req/min for protected paths
- **CSRF protection** — token-based
- **Security headers** — HSTS, X-Frame-Options, CSP

### 7.5 Smart Contract Verification

- **Source code verification** check
- **Proxy backdoor** detection (`selfdestruct`, `delegatecall`)
- **Verified contract whitelist** — known-safe contracts
- **Flash loan integration** detection

### 7.6 Monitoring & Alerts

- **Real-time attack monitoring** with severity levels
- **Security alert database** — persisted to `SecurityAlert` model
- **Audit logging** — all sensitive operations logged to `AuditLog` model
- **Suspicious user-agent blocking** (sqlmap, nikto, nessus, nmap)

---

## 8. Treasury & Financial Management

### 8.1 Balance Dashboard

| Feature | Details |
|---------|---------|
| **Multi-chain** | Aggregated balances across all connected chains |
| **Token breakdown** | Per-token balance with USD value |
| **Activity feed** | Recent transactions with filtering |
| **Distribution chart** | Visual balance distribution |

**Route**: `/balance`

---

### 8.2 Analytics & Reporting

| Feature | Details |
|---------|---------|
| **Payment analytics** | Volume, count, success rate, average size |
| **Time series** | Daily/weekly/monthly trends |
| **Financial reports** | Exportable PDF/CSV reports |
| **Business metrics** | Burn rate, runway, cash flow |

**Route**: `/analytics`
**API**: `GET /api/analytics`, `GET /api/reports`

---

### 8.3 Fee System

| Feature | Details |
|---------|---------|
| **Tiered pricing** | Volume-based fee tiers |
| **Volume discounts** | Progressive discounts for high-volume users |
| **Fee preview** | Real-time fee display before payment |
| **Treasury collection** | Automatic platform fee distribution |
| **Customizable** | Admin-configurable fee schedules |

**Route**: `/fees`

---

### 8.4 Accounting Export

| Format | Details |
|--------|---------|
| **PDF** | Professional reports via @react-pdf/renderer + jsPDF |
| **CSV** | Standard CSV export for accounting software |
| **Excel** | .xlsx export via SheetJS |

---

## 9. Team & Access Control

### 9.1 Team Management

| Feature | Details |
|---------|---------|
| **Roles** | Owner, Admin, Member, Viewer |
| **Invite** | Email-based team invitations |
| **Audit trail** | Full team activity logging (`TeamAuditLog` model) |
| **Billing** | Team-level billing and subscription plans |

**Route**: `/settings/team`
**API**: `POST /api/teams`

---

### 9.2 Billing & Plans

| Feature | Details |
|---------|---------|
| **Plans** | Free, Pro, Enterprise tiers |
| **Usage metering** | Transaction count, API calls, storage |
| **Billing history** | Full payment history |
| **Upgrade/downgrade** | Self-service plan changes |

**Route**: `/settings/billing`
**API**: `GET /api/billing`

---

## 10. Developer Platform

### 10.1 API Keys

| Feature | Details |
|---------|---------|
| **Key types** | Live, test, agent-specific |
| **Rate limiting** | Per-key rate limits with usage logging |
| **Scoping** | Permission-based key scoping |
| **Management** | Create, rotate, revoke via dashboard |

**Route**: `/settings/api-keys`
**API**: `POST /api/session-keys`

---

### 10.2 Webhooks

| Feature | Details |
|---------|---------|
| **Events** | payment.completed, payment.failed, batch.completed, subscription.charged, agent.proposal.created, etc. |
| **Security** | HMAC-SHA256 signed payloads |
| **Retry** | Exponential backoff with configurable retry count |
| **Delivery log** | Full delivery history with response codes |
| **Verification** | Signature verification endpoint |

**Route**: `/settings/webhooks`
**API**: `POST /api/webhooks`, `POST /api/webhooks/verify`

---

### 10.3 Embed SDK / Checkout

| Feature | Details |
|---------|---------|
| **Widget** | Embeddable `<iframe>` payment widget |
| **JS SDK** | Protocol Banks streaming SDK client |
| **Demo mode** | Sandbox testing environment |
| **Verification** | Server-side payment verification |

**Route**: `/embed`, `/checkout`

---

## 11. Admin & Operations

### 11.1 Admin Dashboard

| Feature | Details |
|---------|---------|
| **System monitoring** | Service health, error rates, uptime |
| **Fee management** | Configure protocol fee schedules |
| **Domain management** | DNS and domain configuration |
| **Contract management** | Deploy and manage smart contracts |
| **Security alerts** | Real-time security event monitoring |

**Route**: `/admin`, `/admin/monitoring`, `/admin/fees`, `/admin/domains`, `/admin/contracts`

---

### 11.2 Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Process batch queue | Every minute | Execute queued batch payments |
| Execute scheduled payments | Every hour | Run due recurring payments |
| Budget reset | Every 30 min | Reset expired agent budgets |

---

### 11.3 Health & Monitoring

| Feature | Details |
|---------|---------|
| **Health endpoint** | `GET /api/health` |
| **System status** | `GET /api/status` |
| **Prometheus metrics** | tx counts, queue depth, error rates |
| **Grafana dashboards** | Visual monitoring (production) |

---

## 12. Integrations

| Integration | Purpose | Type |
|-------------|---------|------|
| **Rango Exchange** | Cross-chain swap aggregation (50+ chains, 100+ DEXs) | API |
| **ZetaChain** | Omnichain messaging, BTC/SOL bridging | SDK |
| **Gnosis Safe** | Multi-sig wallet protocol | SDK |
| **Reown AppKit** | Wallet connection (300+ wallets) | SDK |
| **Coinbase** | Crypto → fiat off-ramp | API |
| **Bridge.xyz** | Crypto → fiat off-ramp | API |
| **Transak** | Crypto → fiat (widget + webhook) | Widget + API |
| **MoonPay** | Crypto → fiat off-ramp | Widget |
| **Resend** | Transactional email delivery | API |
| **Redis** | Queue management, distributed locking | Service |
| **HashiCorp Vault** | Production secrets management | Service |
| **Prometheus + Grafana** | Metrics & monitoring | Service |

---

## Appendix: Notification System

| Event | Channel | Details |
|-------|---------|---------|
| Payment received | Push, In-app | Amount, token, sender |
| Payment sent | Push, In-app | Amount, token, recipient, tx hash |
| Subscription reminder | Push, Email | Upcoming charge notification |
| Subscription charged | Push, In-app | Charge amount and tx hash |
| Multi-sig proposal | Push, In-app | Proposal details, approval needed |
| Multi-sig executed | Push, In-app | Execution confirmation |
| Agent proposal created | Push, In-app | Agent name, amount, reason |
| Agent payment executed | Push, In-app | Auto/manual, tx hash |
| Agent budget alert | Push, In-app | Budget utilization warning |
| Vendor address change | Email | Security notification |

**Push notifications**: Service Worker + Web Push API (`lib/sw.ts`)
**Preferences**: Per-event toggle via `/api/notifications/preferences`
