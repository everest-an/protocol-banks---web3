# TRON Integration - Complete Documentation

**Project:** Protocol Banks - TRON Payment & Settlement Infrastructure
**Last Updated:** 2026-02-08
**Status:** Production Ready (Core) | In Progress (Settlement Protocol)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Feature Documentation](#2-feature-documentation)
3. [Network Configuration](#3-network-configuration)
4. [Codebase Map](#4-codebase-map)
5. [API Reference](#5-api-reference)
6. [Smart Contract Layer](#6-smart-contract-layer)
7. [Testing Guide](#7-testing-guide)
8. [Technical Debt & TODOs](#8-technical-debt--todos)
9. [Development Roadmap](#9-development-roadmap)
10. [Security](#10-security)
11. [Troubleshooting](#11-troubleshooting)

---

## Current Status Summary

> **Last Audited:** 2026-02-08

### Completed Features

| Module | File | Status |
|--------|------|--------|
| TronLink Wallet Connection | `lib/web3.ts` | Done |
| TRC20/TRX Transfers | `lib/services/tron-payment.ts` | Done |
| Address Auto-Detection (EVM/TRON) | `lib/address-utils.ts` | Done |
| Energy/Bandwidth Resource Monitoring | `components/tron/tron-resources.tsx` | Done |
| Transaction Confirmation Waiting | `lib/services/tron-payment.ts` | Done |
| Batch Payments (TRON) | `lib/services/payment-service.ts` | Done |
| Multi-Network Vendor Management | `lib/services/vendor-multi-network.service.ts` | Done |
| Nile Testnet Demo Page | `app/(products)/tron-demo/page.tsx` | Done |
| JustLend Yield Service (TypeScript) | `lib/services/yield/tron-yield.service.ts` | Done |
| Go Payout Engine (Real Broadcast) | `services/payout-engine/internal/service/payout.go` | Done |
| Go TRON Block Indexer (Code) | `services/event-indexer/internal/watcher/tron_watcher.go` | Done |
| Redis Queue (BullMQ, 50 Concurrent) | `lib/services/queue/payment-queue.service.ts` | Done |
| Double-Spend Prevention (5-Layer) | `lib/services/security/double-spend-prevention.service.ts` | Done |
| Error Handling (TronError + 10 Mappings) | `lib/services/tron-payment.ts` | Done |
| Private Key Management (Env-Based) | `services/payout-engine/internal/config/config.go` | Done |
| BigInt Serialization | Various API routes | Done |
| Structured Logging (Winston) | `lib/logger/structured-logger.ts` | Done |

### Pending Work

| Module | Status | Estimate |
|--------|--------|----------|
| `window.tronWeb` TypeScript Interface | Still typed as `any` | 1 day |
| TS Fee Limit Configuration | Hardcoded 100 TRX | 1 day |
| Yield Async Timeout Protection | Missing | 1 day |
| Payment Query Pagination | Missing | 1 day |
| TRON Indexer K8s Deployment | Code complete, not deployed | 1 week |
| OpenAPI/Swagger Docs | Not started | 1 week |
| Multi-Sig TRON Wallet | Not started | 2 weeks |
| ERP Integration API | Not started | 1 week |
| On-Chain Address Verification | Format-only validation | Optional |
| KMS Integration | Env vars work; KMS recommended for production | 1 week |

### Smart Contract Progress

| Contract | Design | Code | Tests | Nile Deploy | Mainnet | Audit |
|----------|--------|------|-------|-------------|---------|-------|
| **Payment Vault** (Multi-Sig) | Done | Pending | - | - | - | - |
| **Payment Splitter** (Auto-Split) | Done | Pending | - | - | - | - |
| **Yield Aggregator (EVM/Aave)** | Done | Done | Partial | - | - | - |
| **Yield Aggregator (TRON/JustLend)** | Done | Pending | - | - | - | - |

> **Contract Summary:** All architecture designs complete. EVM Yield Aggregator coded (`contracts/yield/`). 3 TRON contracts still in design phase - estimated 3-4 weeks for code + test + Nile deploy. Third-party audit (CertiK/SlowMist) required before mainnet.

---

## 1. Architecture Overview

### 1.1 Three-Layer Architecture

```
+-------------------------------------------------------------+
|                  Application Layer                           |
|  +----------------+  +--------------+  +------------------+ |
|  | Merchant       |  | Financial    |  | Reconciliation   | |
|  | Dashboard      |  | Dashboard    |  | Management       | |
|  +----------------+  +--------------+  +------------------+ |
+-------------------------------------------------------------+
                              |
                        RESTful API
                              |
+-------------------------------------------------------------+
|               Core Service Layer                             |
|  +----------------+  +--------------+  +------------------+ |
|  | TRON Indexer   |  | Order        |  | Reconciliation   | |
|  | (Go + TS)     |  | Linking      |  | Engine           | |
|  +----------------+  +--------------+  +------------------+ |
|  +----------------+  +--------------+  +------------------+ |
|  | Webhook System |  | Payment      |  | Yield            | |
|  |                |  | Service      |  | Aggregator       | |
|  +----------------+  +--------------+  +------------------+ |
+-------------------------------------------------------------+
                              |
                     Smart Contract Events
                              |
+-------------------------------------------------------------+
|            Smart Contract Layer                               |
|  +----------------+  +--------------+  +------------------+ |
|  | Multi-sig      |  | Payment      |  | Yield            | |
|  | Management     |  | Splitter     |  | Aggregator       | |
|  +----------------+  +--------------+  +------------------+ |
+-------------------------------------------------------------+
                              |
                       TRON Network (TRC20)
```

### 1.2 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS | SSR + Type Safety |
| **Backend** | Next.js API Routes + Prisma ORM | Serverless |
| **Blockchain** | TronWeb 6 + TronLink + TronGrid API | Mainnet + Nile Testnet |
| **Go Services** | Event Indexer + Payout Engine | gotron-sdk |
| **Database** | PostgreSQL + Prisma 7 | RLS Row-Level Security |
| **Queue** | Redis (optional) | Webhook retry queue |
| **Monitoring** | Prometheus + Grafana | Performance metrics |

### 1.3 Data Flow

```
User --> TronLink --> Next.js App --> Address Validation (lib/address-utils.ts)
                                  --> TRON Payment Service (lib/services/tron-payment.ts)
                                  --> Database Record (Prisma)
                                  --> Event Indexer (Go) --> Poll TRON blocks
                                  --> Webhook Notification
```

### 1.4 Hybrid TypeScript + Go Architecture

The TRON integration spans both TypeScript (frontend + API) and Go (microservices):

- **TypeScript**: Client-side TronLink integration, TRC20 transfers, resource monitoring, yield aggregation
- **Go**: Block watching, event indexing, batch payout processing, gRPC services

Feature flag `ENABLE_GO_SERVICES=true` toggles between Go microservices and TS fallback.

---

## 2. Feature Documentation

### 2.1 Core Payment Features (Production Ready)

| Feature | Status | Description |
|---------|--------|-------------|
| **TronLink Connection** | Done | Browser wallet connection with retry logic |
| **TRC20 Transfers** | Done | USDT, USDC transfers with fee estimation |
| **Native TRX Transfers** | Done | Direct TRX send support |
| **Address Validation** | Done | Base58 format validation, auto-detection |
| **Auto Network Detection** | Done | EVM vs TRON auto-routing by address prefix |
| **Resource Monitoring** | Done | Energy/bandwidth usage and estimation |
| **Transaction Confirmation** | Done | Block confirmation waiting (3-6 seconds) |
| **Batch Payments** | Done | Sequential processing with 3s delay |
| **Balance Queries** | Done | TRC20 token balance real-time queries |
| **Multi-Network Vendors** | Done | One vendor, multiple network addresses |
| **Nile Testnet Demo** | Done | Full demo page at /tron-demo |

### 2.2 Address Detection

Automatic network detection based on address format:

```typescript
// EVM: 0x prefix, 42 characters, hex
"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" --> EVM

// TRON: T prefix, 34 characters, Base58
"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" --> TRON
```

Key functions from `lib/address-utils.ts`:
- `detectAddressType(address)` - Returns "EVM" | "TRON" | "UNKNOWN"
- `validateAddress(address)` - Full validation with checksumming
- `getNetworkForAddress(address)` - Returns default network ID

### 2.3 Resource Management

TRON transactions consume energy and bandwidth:

| Resource | TRC20 Transfer Cost | Regeneration |
|----------|-------------------|--------------|
| **Energy** | ~32,000 units | Daily from frozen TRX |
| **Bandwidth** | ~345 bytes | Free 5,000/day allowance |
| **Fee Limit** | 100 TRX max | Per transaction |

Resource estimation:
```typescript
{
  energy: 32000,           // TRC20 transfer
  bandwidth: 345,          // Transaction size
  feeLimit: 100_000_000    // 100 TRX max fee
}
```

### 2.4 Yield Aggregation (JustLend)

Idle merchant funds auto-deposit into JustLend for interest:

- **Deposit**: USDT --> JustLend jUSDT (earn APY)
- **Withdraw**: jUSDT --> USDT + accumulated interest
- **APY Query**: Real-time rate from JustLend contract
- **Balance Tracking**: Per-merchant principal + interest tracking

### 2.5 Merchant Settlement Protocol (90% Complete)

Three-dimension design:

**Dimension 1 - Smart Contract Layer** (Architecture designed, pending development):
- Non-custodial payment vault with multi-sig
- Automated payment splitting (percentage/fixed/tiered)
- Event-driven design for indexing

**Dimension 2 - Core Service Layer** (95% Complete):
- Chain indexer with multi-node consensus (3s polling)
- Smart order linking (Memo/Address/Amount+Time matching)
- Auto-reconciliation engine with CSV/Excel/PDF reports
- Webhook system with HMAC-SHA256 + exponential backoff

**Dimension 3 - Application Layer** (95% Complete):
- Merchant dashboard with real-time stats
- Financial reporting (daily/weekly/monthly)
- Reconciliation management with one-click run
- Webhook delivery monitoring

---

## 3. Network Configuration

### 3.1 TRON Mainnet (Production)

```typescript
{
  id: "tron",
  name: "TRON Mainnet",
  type: "TRON",
  nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
  rpcUrl: "https://api.trongrid.io",
  blockExplorer: "https://tronscan.org",
  isTestnet: false,
  tokens: [
    { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", symbol: "USDT", decimals: 6 },
    { address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", symbol: "USDC", decimals: 6 }
  ]
}
```

### 3.2 TRON Nile Testnet (Development)

```typescript
{
  id: "tron-nile",
  name: "TRON Nile Testnet",
  type: "TRON",
  nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
  rpcUrl: "https://nile.trongrid.io",        // No API key needed, 50 QPS
  blockExplorer: "https://nile.tronscan.org",
  isTestnet: true,
  tokens: [
    { address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", symbol: "USDT", decimals: 6 }
  ]
}
```

### 3.3 Nile Testnet Resources

| Resource | URL |
|----------|-----|
| Block Explorer | https://nile.tronscan.org |
| Faucet (Test TRX) | https://nileex.io/join/getJoinPage |
| TronGrid API | https://nile.trongrid.io |
| TronScan API | https://nileapi.tronscan.org |

### 3.4 Environment Variables

```bash
# Optional - improves rate limits on mainnet
TRONGRID_API_KEY="your-trongrid-api-key"

# Network selection
NEXT_PUBLIC_TRON_NETWORK="mainnet"  # or "nile"
```

---

## 4. Codebase Map

### 4.1 Core Services (TypeScript)

| File | Description |
|------|-------------|
| `lib/services/tron-payment.ts` | Main TRON payment service - TRC20/TRX transfers, balance queries, resource estimation, confirmation waiting, batch payments |
| `lib/services/yield/tron-yield.service.ts` | JustLend integration - deposit, withdraw, APY calculation, balance tracking |
| `lib/services/yield/unified-yield.service.ts` | Unified yield service bridging EVM + TRON yield |
| `lib/services/yield/yield-aggregator.service.ts` | EVM yield aggregation (Aave), works alongside TRON yield |
| `lib/services/payment-service.ts` | Unified payment service with auto-routing (EVM/TRON) |
| `lib/services/vendor-multi-network.service.ts` | Multi-network vendor CRUD with TRON address support |
| `lib/services/queue/payment-queue.service.ts` | Payment queue with TRON job processing |
| `lib/services/security/double-spend-prevention.service.ts` | Double-spend prevention for both chains |

### 4.2 Utilities & Configuration

| File | Description |
|------|-------------|
| `lib/address-utils.ts` | Address detection, validation, formatting (EVM + TRON) |
| `lib/networks.ts` | Network configs, token addresses, lookup functions |
| `lib/web3.ts` | Web3 connections including `connectTron()` for TronLink |
| `lib/logger/structured-logger.ts` | Winston structured logging with TRON-specific logging |
| `lib/security/future-attack-protection.ts` | Security features supporting TRON |

### 4.3 React Components

| File | Description |
|------|-------------|
| `components/tron/tron-resources.tsx` | Energy/bandwidth resource display with progress bars |
| `components/vendors/vendor-address-manager.tsx` | Multi-network vendor address CRUD |
| `components/vendors/network-badge.tsx` | Network identifier badge (EVM/TRON) |
| `components/transactions/transaction-list.tsx` | Transaction list with network filtering |
| `components/dashboard/multi-network-balance.tsx` | Aggregated balance across EVM + TRON |
| `components/yield/yield-recommendation-banner.tsx` | Yield recommendations including TRON |
| `components/yield/yield-balance-card.tsx` | Yield balance display |
| `components/scheduled-payment-form.tsx` | Scheduled payments with TRON support |
| `components/address-verification-display.tsx` | Address verification for TRON |

### 4.4 Pages & API Routes

| File | Description |
|------|-------------|
| `app/(products)/tron-demo/page.tsx` | Interactive Nile testnet demo page |
| `app/(products)/batch-payment/page.tsx` | Batch payment with TRON auto-routing |
| `app/(products)/receive/page.tsx` | Receive payments with TRON |
| `app/(products)/analytics/page.tsx` | Analytics with TRON data |
| `app/(products)/reconciliation/page.tsx` | Reconciliation with TRON |
| `app/api/payments/route.ts` | Payments API with network filtering |
| `app/api/payments/stats/route.ts` | Payment statistics with TRON |
| `app/api/batch-payment/route.ts` | Batch payment API |
| `app/api/yield/stats/route.ts` | Yield statistics for TRON |
| `app/api/yield/balance/route.ts` | Yield balance API for TRON |
| `app/api/vendors/multi-network/` | Multi-network vendor API routes |

### 4.5 Go Microservices

| File | Description |
|------|-------------|
| `services/event-indexer/internal/watcher/tron_watcher.go` | TRON block watcher for TRC20 Transfer events |
| `services/event-indexer/internal/watcher/watcher.go` | Base watcher with TRON support |
| `services/event-indexer/internal/config/config.go` | Config supporting TRON chains |
| `services/payout-engine/internal/service/payout.go` | Payout processing with TRON (TRC20) |
| `services/payout-engine/internal/config/config.go` | Config with TRON chain definitions |

### 4.6 Database & Migrations

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | Database schema: VendorAddress (multi-network), Payment (energy_used, bandwidth_used, network_type), YieldDeposit |
| `scripts/009_multi_network_support.sql` | SQL migration for multi-network tables, payment alterations, network normalization |

### 4.7 Smart Contracts

| File | Description |
|------|-------------|
| `contracts/yield/` | Yield aggregator contracts (EVM + TRON design) |

### 4.8 Tests

| File | Description |
|------|-------------|
| `lib/__tests__/networks.test.ts` | 34 tests for TRON network configuration |
| `lib/__tests__/address-utils.test.ts` | TRON address validation tests |
| `lib/__tests__/integration.test.ts` | Integration tests with TRON |
| `__tests__/e2e/network-config.test.ts` | E2E network config tests |
| `__tests__/e2e/address-utils.test.ts` | E2E TRON address validation |
| `__tests__/e2e/payment-flow.test.ts` | Payment flow including TRON |
| `__tests__/e2e/yield-integration.test.ts` | Yield integration with TRON |
| `__tests__/e2e/reconciliation.test.ts` | Reconciliation with TRON |
| `__tests__/services/yield/unified-yield.service.test.ts` | Unified yield service tests |
| `__tests__/services/security/double-spend-prevention.test.ts` | Double-spend tests |
| `services/event-indexer/internal/watcher/watcher_test.go` | Go watcher tests (TRON events) |
| `services/payout-engine/internal/service/payout_test.go` | Go payout tests (TRON addresses) |

### 4.9 Contexts & Hooks

| File | Description |
|------|-------------|
| `contexts/web3-context.tsx` | Web3 context with TRON wallet state |
| `hooks/use-batch-payment.ts` | Batch payment hook with TRON support |
| `hooks/use-subscriptions.ts` | Subscriptions hook |

---

## 5. API Reference

### 5.1 Payment APIs

**Send TRON Payment:**
```typescript
// Auto-routed via unified payment service
POST /api/payments
Headers: { "x-user-address": "YOUR_ADDRESS" }
Body: {
  "from_address": "YOUR_TRON_ADDRESS",
  "to_address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  "amount": "10",
  "token": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "token_symbol": "USDT",
  "chain": "tron",
  "type": "sent"
}
```

**Query Payments by Network:**
```typescript
GET /api/payments?network=tron&network_type=TRON&status=completed
Headers: { "x-user-address": "YOUR_ADDRESS" }
```

### 5.2 Vendor APIs

**Create Multi-Network Vendor:**
```typescript
POST /api/vendors/multi-network
Headers: { "x-user-address": "YOUR_ADDRESS" }
Body: {
  "name": "Test Vendor",
  "addresses": [
    {
      "network": "tron",
      "address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      "label": "TRON Mainnet Wallet",
      "isPrimary": true
    }
  ]
}
```

### 5.3 Yield APIs

**Get TRON Yield Stats:**
```typescript
GET /api/yield/stats?network=tron
```

**Get TRON Yield Balance:**
```typescript
GET /api/yield/balance?merchant=YOUR_ADDRESS&network=tron
```

### 5.4 Merchant Settlement APIs (Planned)

```typescript
POST   /api/v1/merchant/orders                    // Create order
GET    /api/v1/merchant/orders                    // List orders
POST   /api/v1/merchant/payments/:txHash/verify   // Verify payment
POST   /api/v1/merchant/reconciliation/run        // Run reconciliation
GET    /api/v1/merchant/reconciliation/reports     // Get reports
GET    /api/v1/merchant/dashboard/stats           // Dashboard stats
```

---

## 6. Smart Contract Layer

### 6.1 Payment Vault (Designed, Pending Development)

```solidity
contract TronPaymentVault {
    mapping(address => bool) public signers;
    uint256 public requiredSignatures;
    uint256 public constant TIMELOCK_PERIOD = 7 days;

    function executePayment(
        address token, address to, uint256 amount,
        bytes[] memory signatures
    ) external;
}
```

### 6.2 Payment Splitter (Designed)

```solidity
contract PaymentSplitter {
    struct Beneficiary { address account; uint256 shares; }
    Beneficiary[] public beneficiaries;

    function splitPayment(address token, uint256 amount) external;
}
```

### 6.3 Yield Aggregator (Designed)

```solidity
contract YieldAggregator {
    IERC20 public immutable usdt;
    IJustLend public immutable jUSDT;
    mapping(address => uint256) public merchantBalances;

    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function calculateInterest(address merchant) public view returns (uint256);
    function getMerchantBalance(address merchant) external view returns (uint256, uint256, uint256);
}
```

### 6.4 Key Events

```solidity
event PaymentReceived(address indexed from, address indexed token, uint256 amount, string orderId);
event PaymentSplit(address indexed beneficiary, address indexed token, uint256 amount);
event WithdrawalRequested(address indexed to, uint256 amount, uint256 unlockTime);
event Deposited(address indexed merchant, uint256 amount);
event Withdrawn(address indexed merchant, uint256 amount, uint256 interest);
```

---

## 7. Testing Guide

### 7.1 Nile Testnet Setup

1. **Install TronLink**: https://www.tronlink.org/
2. **Switch to Nile**: Settings > Node Management > Nile Testnet
3. **Get Test TRX**: https://nileex.io/join/getJoinPage (10,000 test TRX)
4. **Access Demo**: Navigate to `/tron-demo`

### 7.2 Test Scenarios

**Single Transfer:**
```
Recipient: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE
Amount: 1.5
Token: USDT
Expected: Confirmation in 3-6 seconds
```

**Batch Payment:**
```
Recipients: 3x TRON addresses, USDT
Expected: Sequential processing (3s between), all confirmed
```

**Resource Monitoring:**
```
Before: Energy 50,000 / Bandwidth 5,000
After TRC20 transfer: Energy -32,000 / Bandwidth -345
```

**Error Handling:**
```
Insufficient balance --> "Insufficient balance" error
Invalid address     --> "Invalid TRON address" error
User rejection      --> "Transaction was rejected by user" error
Insufficient energy --> "Freeze TRX for energy" suggestion
```

### 7.3 Running Tests

```bash
# Unit tests
pnpm test lib/__tests__/networks.test.ts
pnpm test lib/__tests__/address-utils.test.ts

# E2E tests
pnpm test __tests__/e2e/payment-flow.test.ts

# Go service tests
cd services/event-indexer && go test -v ./internal/watcher/
cd services/payout-engine && go test -v ./internal/service/
```

---

## 8. Technical Debt & TODOs

> **Last Audited:** 2026-02-08

### 8.1 Resolved Issues (Previously Critical)

| Issue | File | Resolution |
|-------|------|------------|
| ~~Go Payout Engine Mocked~~ | `services/payout-engine/internal/service/payout.go` | Real `client.Broadcast(signedTx)` implemented, returns actual tx hashes via `txExt.GetTxid()` |
| ~~Private Key Management~~ | `services/payout-engine/internal/config/config.go` | Loads from env: `PAYOUT_PRIVATE_KEY` (EVM) + `TRON_PRIVATE_KEY` (TRON). Recommend KMS for production |
| ~~TronWeb v6 Constructor~~ | `lib/services/yield/tron-yield.service.ts` | Lazy init via `ensureTronWeb()` + build-time fallback mock. Intentional pattern |
| ~~Redis Queue~~ | `lib/services/queue/payment-queue.service.ts` | BullMQ integrated: 50 concurrent workers, exponential backoff, stalled job detection |
| ~~BigInt Serialization~~ | Various API routes | Properly converted via `.toString()` in all payment responses |
| ~~Error Handling~~ | `lib/services/tron-payment.ts` | Comprehensive `TronError` class + 10+ error mappings (user rejection, energy, bandwidth, etc.) |
| ~~Double-Spend Prevention~~ | `lib/services/security/double-spend-prevention.service.ts` | 5-layer verification: tx uniqueness, on-chain verify, amount match, confirmations, reorg detection |
| ~~Network Detection Duplication~~ | `lib/address-utils.ts` vs `lib/web3.ts` | Not duplicated - complementary: address-utils for format detection, web3.ts for chain config |

### 8.2 Open Issues

| Issue | File | Description | Priority |
|-------|------|-------------|----------|
| **`window.tronWeb` typed as `any`** | `lib/web3.ts:10` | Global `Window.tronWeb` declaration uses `any`. Need proper `ITronWeb` interface definition | P1 |
| **Yield service `as any` casts** | `lib/services/yield/tron-yield.service.ts` | `private tronWeb: any` property. Need typed interface | P2 |
| **Hardcoded fee limits (TS)** | `lib/services/tron-payment.ts:330,570` | 100 TRX hardcoded in TS. Go service is configurable via `TRC20_FEE_LIMIT` env. Centralize to config | P2 |
| **No async yield timeout** | `lib/services/yield/tron-yield.service.ts` | Long-running deposit (approve -> mint) lacks timeout. Add 120s timeout wrapper | P2 |
| **Payment query no pagination** | `app/api/payments/route.ts` | Large merchants could cause OOM. Add limit/offset parameters | P2 |
| **TRON address format-only validation** | `lib/address-utils.ts` | Validates Base58 format only. No on-chain account existence check. By design for perf; optional on-chain check pending | P3 |
| **On-chain address verification** | Not implemented | Could accept non-existent TRON addresses. Add optional TronGrid account check | P3 |
| **TRON reorg handling** | `double-spend-prevention.service.ts` | Basic confirmation depth. No multi-node consensus verification for large amounts | P3 |

### 8.3 Missing Features

| Feature | Status | Estimated Effort |
|---------|--------|-----------------|
| **Payment Vault Contract** | Architecture designed, not coded | 2 weeks |
| **Payment Splitter Contract** | Architecture designed, not coded | 1 week |
| **Yield Aggregator Contract (TRON)** | EVM version exists (`contracts/yield/`), TRON-specific pending | 1 week |
| **TRON Indexer Deployment** | Code complete (`tron_watcher.go`), not deployed to K8s | 1 week |
| **OpenAPI/Swagger Docs** | Not started | 1 week |
| **Multi-sig TRON Wallet** | Not started (EVM multi-sig exists via Safe) | 2 weeks |
| **ERP System Integration API** | Not started | 1 week |
| **Mobile Push for Approvals** | Not started | 1 week |
| **KMS Integration** | Env-based keys work; AWS KMS/Vault recommended for high-value production | 1 week |

### 8.4 Smart Contract Status

| Contract | Design | Code | Tests | Nile Deploy | Mainnet | Audit |
|----------|--------|------|-------|-------------|---------|-------|
| **Payment Vault** | Done | Pending | - | - | - | - |
| **Payment Splitter** | Done | Pending | - | - | - | - |
| **Yield Aggregator (EVM)** | Done | Done | Partial | - | - | - |
| **Yield Aggregator (TRON)** | Done | Pending | - | - | - | - |

### 8.5 Performance Status

| Concern | Previous | Current | Target |
|---------|----------|---------|--------|
| API response (p95) | ~150ms | ~150ms | <200ms |
| Indexer latency | N/A | 3-4s (code ready) | <5s |
| Batch payment throughput | Sequential | 50 concurrent (BullMQ) | 50+ |
| TronGrid API rate limit | 50 QPS (Nile) | 50 QPS (Nile) | Unlimited with API key |
| Double-spend prevention | Basic | 5-layer verification | Production-grade |
| Error handling | Inconsistent | TronError class + 10 mappings | Comprehensive |

---

## 9. Development Roadmap

### Phase 1: Security & Performance (Week 1-2) -- COMPLETE

- [x] Implement Redis queue for high concurrency (BullMQ, 50 concurrent workers)
- [x] Deploy double-spend prevention with 5-layer verification
- [x] Set up structured logging with Winston
- [ ] Performance load testing (pending)

### Phase 2: Yield Aggregation (Week 3-4)

- [ ] Deploy YieldAggregator smart contract to Nile
- [ ] Complete JustLend integration testing
- [ ] Build yield management dashboard UI
- [ ] Contract security audit

### Phase 3: Developer Experience (Week 5)

- [ ] Quick start guide (15-min integration)
- [ ] OpenAPI specification + Swagger UI
- [ ] SDK examples (Node.js, Python)
- [ ] Postman collection

### Phase 4: UI/UX Polish (Week 6)

- [ ] Financial-friendly reconciliation interface
- [ ] Accounting-standard report formats
- [ ] One-click anomaly export
- [ ] Multi-dimension data filtering

### Phase 5: Smart Contracts (Week 7-8)

- [ ] Payment Vault contract development
- [ ] Payment Splitter contract development
- [ ] Contract testing on Nile testnet
- [ ] Third-party security audit

### Phase 6: Integration Testing & Launch (Week 9-10)

- [ ] End-to-end testing (1000+ orders)
- [ ] Performance testing (500 TPS target)
- [ ] User acceptance testing
- [ ] Mainnet deployment

---

## 10. Security

### 10.1 Non-Custodial Architecture

- User funds controlled via TronLink (private keys never touch server)
- All transactions signed client-side
- Payment verification via on-chain data (tamper-proof)

### 10.2 Data Security

- Row-Level Security (RLS) isolates merchant data
- API authentication via `x-user-address` header + JWT
- Webhook signatures: HMAC-SHA256
- All API endpoints enforce HTTPS

### 10.3 Smart Contract Security (Planned)

- Multi-sig threshold minimum 2-of-3
- 7-day timelock on critical operations
- Emergency pause switch
- Recommended auditors: CertiK, PeckShield, SlowMist

### 10.4 Confirmation Depth Strategy

| Confirmations | Risk Level | Recommendation |
|---------------|-----------|----------------|
| 1-2 | High | Display only, no action |
| 3-18 | Medium | Small amounts (<$100) |
| 19+ | Low | Large amounts |
| 50+ | Irreversible | All amounts |

---

## 11. Troubleshooting

### Common Issues

**"TronLink is not available"**
- Install TronLink: https://www.tronlink.org/
- Ensure browser extension is enabled

**"Insufficient energy"**
- Freeze TRX to get energy, or wait for daily regeneration
- Transaction will consume TRX as fee if no energy available

**"Invalid TRON address"**
- Address must start with 'T' and be 34 characters
- Example: `TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`

**"Transaction failed"**
- Check energy/bandwidth availability
- Verify sufficient token balance
- Ensure correct network (Nile vs Mainnet)

**TronWeb build-time error**
- TronWeb v6 cannot be instantiated at build time
- Solution: Lazy initialization in `tron-yield.service.ts` with `ensureTronWeb()` pattern

### Debug Tips

```typescript
// Check TronLink
console.log(window.tronWeb)
console.log(window.tronWeb?.defaultAddress?.base58)

// Verify network
const net = await getTronNetwork()
console.log(net)  // "tron" or "tron-nile"

// Enable verbose logging
localStorage.setItem("debug", "tron:*")
```

### Useful Links

| Resource | URL |
|----------|-----|
| TRON Developer Docs | https://developers.tron.network |
| TronGrid API | https://www.trongrid.io |
| TronWeb SDK | https://tronweb.network |
| TronLink Docs | https://docs.tronlink.org |
| Nile Faucet | https://nileex.io/join/getJoinPage |
| Nile Explorer | https://nile.tronscan.org |

### Performance Benchmarks

| Metric | TRON | Ethereum |
|--------|------|----------|
| Block time | 3s | 12s |
| Transaction fee | ~$0.50 | ~$5-20 |
| Confirmation time | 57s (19 blocks) | 5 min (25 blocks) |
| Network TPS | 2,000 | 15-30 |

### Monthly Operating Cost (1000 orders/month)

```
Vercel deployment:     $20/month (Pro plan)
PostgreSQL:            $25/month (Supabase Pro)
TronGrid API:          $0 (free tier sufficient)
Domain + SSL:          $15/month
Total:                ~$60/month
```
