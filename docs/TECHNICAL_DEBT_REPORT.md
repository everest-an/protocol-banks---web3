# Protocol Bank Technical Debt Report
**Date:** February 8, 2026
**Status:** Audit Completed
**Focus:** HashKey Integration, RWA, Bridge Infrastructure

## 1. Executive Summary
The core smart contract layer for HashKey (`ProtocolBankUSD`) is **Production Ready** and aligned with the `ERC-3009` and 6-decimal specifications. However, the off-chain infrastructure remains in a **Hybrid State**:
- **Bridge Infrastructure**: Upgraded to "Robust Script" level (State persistence + Confirmations added).
- **RWA/Fiat Webhooks**: **BLOCKED** by missing Database Schema.
- **Key Management**: **HIGH RISK** (Still using local private keys).

---

## 2. Component Analysis

### A. Smart Contracts (✅ Resolved)
- **Status**: Green
- **Details**:
  - `ProtocolBankUSD.sol` fixed to 6 decimals (matching USDC).
  - Test suite passing (100% coverage on core logic).
  - Treasury configured for Base Network.

### B. Bridge Controller (🔄 In Progress)
- **Status**: Yellow (Upgraded)
- **File**: `scripts/pbusd-controller.js`
- **Improvements Applied**:
  - Added `bridge_state.json` for idempotency (prevents double-minting).
  - Added `confirmations` wait logic (Base: 5 blocks, HashKey: 2 blocks).
  - Added Error Handling/Logging.
- **Remaining Gap**: 
  - Needs to be containerized (Docker) for true production deployment.
  - Needs monitoring/alerting (Prometheus/Grafana).

### C. Fiat/RWA Webhooks (❌ Blocked)
- **Status**: Red
- **File**: `services/webhook-handler/internal/handler/rain.go` & `transak.go`
- **Issue**: Source code contains `TODO`s referencing non-existent data models.
- **Root Cause**: `prisma/schema.prisma` is missing models for:
  - `CorporateCard` (for Rain integration)
  - `CardTransaction`
  - `FiatOrder` (for Transak integration, distinct from current Payment model)
- **Action Required**: 
  1. Define RWA Schema in Prisma.
  2. Run `prisma migrate`.
  3. Implement Go `store` methods.

### D. Security & Keys (⚠️ High Risk)
- **Status**: Red
- **File**: `services/payout-engine/internal/service/payout.go`
- **Issue**: Comment `// TODO: Use secure vault implementation`.
- **Current State**: Relies on `BRIDGE_RELAYER_PK` env var (Hot Wallet).
- **Compliance Violation**: HashKey requires MPC/HSM for institutional custody.
- **Action Required**: Integrate Fireblocks, AWS KMS, or HashKey Custody API.

---

## 3. Recommended Roadmap

| Priority | Task | Estimate |
| :--- | :--- | :--- |
| **P0** | **Database Schema Migration** (Add `CorporateCard`, `CardTransaction`) | 2 Days |
| **P1** | **Webhook Implementation** (Connect Rain/Transak to new DB tables) | 3 Days |
| **P1** | **Key Management Upgrade** (Switch to AWS KMS signing) | 4 Days |
| **P2** | **Containerization** (Dockerize `pbusd-controller` & `payout-engine`) | 1 Day |

---

## 4. Immediate Actions Taken
- **Refactored `scripts/pbusd-controller.js`**: Replaced the pseudo-code placeholder with a functional, state-aware bridge bot. It is safely runnable now for testing (Testnet/Mainnet) provided valid `.env` config.

