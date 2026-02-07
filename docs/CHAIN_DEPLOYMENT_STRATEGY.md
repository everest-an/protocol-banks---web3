# Protocol Bank Chain Deployment Strategy

## 1. Executive Summary
Protocol Bank adopts a **Multi-Chain Distributed Architecture**. Rather than replicating the entire protocol on every chain, we deploy specific modules to the networks that best suit their functional characteristics (Cost, Speed, Compliance, Liquidity).

This strategy maximizes efficiency, reduces user costs, and leverages the unique selling points (USP) of partner ecosystems like HashKey and Base.

---

## 2. Chain Selection Matrix

### 🟢 HashKey Chain (Compliance & Enterprise Layer)
**Best For:** High-value, regulated, and corporate functionalities.
**Why?** HashKey is an exchange-backed, regulatory-friendly chain. It is optimizing for institutional RWA (Real World Assets) and compliant stablecoin flows.

| Module | Deployment Rationale |
| :--- | :--- |
| **Enterprise Payroll (BatchTransfer)** | Companies paying salaries need compliance. HashKey's KYC-friendly ecosystem is ideal for B2B settlements. |
| **Compliance/Identity Registry** | Storing "Whitelisted" or "KYC-verified" wallet hashes. HashKey acts as the trusted ledger for verification status. |
| **RWA Vaults** | If offering Treasury Bills or Bond-backed stablecoins, these must live here to satisfy regulatory requirements. |
| **Fiat On/Off Ramp Contracts** | Smart contracts that interact with centralized exchange liquidity for large fiat exits. |

### 🔵 Base (Retail & Consumer Layer)
**Best For:** High-frequency, low-cost, consumer-facing functionalities.
**Why?** Base (Coinbase L2) has massive user liquidity, extremely low fees ($0.01), and a strong consumer app ecosystem.

| Module | Deployment Rationale |
| :--- | :--- |
| **Micro-Payments / Subscriptions** | Recurring $10/month SaaS payments. Users shouldn't pay high gas fees for small transfers. |
| **Merchant POS (Invoicing)** | Retail checkout (Coffee, E-commerce). Speed and generic USDC liquidity are king here. |
| **Social Payment Features** | "Split Bill", "Red Packet" (Airdrop) features. These rely on massive user adoption found on Base. |
| **Freelancer Payouts** | Individual contractors prefer receiving funds on a chain with easy access to Coinbase/Binance off-ramps. |

---

## 3. Hybrid Token Deployment Strategy

Yes, different tokens and assets can and should effectively live on different chains. The **Omnichain Vault** (ZetaChain integration) bridges them for the user.

### A. Stablecoin Separation
*   **HashKey**: **HKD Stablecoins / Compliant USDC**.
    *   *Scenario*: A Hong Kong company pays its local employees in HKD-pegged stablecoins on HashKey Chain.
*   **Base**: **USDC (Native)**.
    *   *Scenario*: A global freelancer receives USD payment on Base for easy liquidity.

### B. Protocol Token (BANK) Utility
*   **Governor Contract (HashKey)**: Institutional voting, protocol parameter changes.
*   **Reward/Staking (Base)**: Cashback for users, referral bonuses.

---

## 4. Architecture Implementation Plan

### Phase 1: The "Split Brain" Operations
- **Contract A (HashKey)**: `BatchTransfer_Enterprise.sol`
    - Enforces KYC check modifier.
    - Higher limits.
    - Fee: 0.1% (Standard B2B).
- **Contract B (Base)**: `BatchTransfer_Lite.sol`
    - Permissionless (Anyone can use).
    - Lower gas optimization focus.
    - Fee: Flat $0.50 per batch (Consumer friendly).

### Phase 2: Inter-Chain Routing
Use the **Payout Engine** to route intelligently:
```typescript
// Pseudo-code in Payment Service
if (payment.type === "SALARY" && company.isKYC) {
  routeTochain("HASHKEY");
} else if (payment.type === "SUBSCRIPTION") {
  routeTochain("BASE");
}
```

### Phase 3: The "Protocol Bank" Stablecoin Solution (pbUSD)
**Problem**: HashKey Chain currently lacks native stablecoins (USDC/USDT), making stable payroll settlements difficult.
**Solution**: Protocol Bank becomes the liquidity provider by issuing a **Synthetic Stablecoin**.

1.  **Issuance**:
    *   User deposits **USDC on Base** (Source of Funds).
    *   Protocol Bank locks funds in the Base Treasury Vault.
    *   Protocol Bank mints equivalent **pbUSD (Protocol Bank USD)** on **HashKey Chain**.
2.  **Settlement**:
    *   Employees receive `pbUSD` on HashKey.
    *   `pbUSD` is pegged 1:1 and guaranteed by the Protocol Treasury.
3.  **Redemption**:
    *   Employee can swap `pbUSD` -> `HSK` (on DEX) for gas/spending.
    *   Employee can bridge `pbUSD` back to Base to unlock native `USDC`.

**Why this wins the pitch**:
*   It solves HashKey's "Empty Chain" problem.
*   It proves why you are a "Bank" (issuing credit/assets).
*   It forces TVL (Total Value Locked) onto their chain.

### 5. Recommendation for HashKey Pitch
Tell HashKey: **"We are deploying our Enterprise Settlement Layer exclusively on HashKey Chain to leverage your compliance infrastructure, while keeping retail traffic on L2s to act as a funnel bringing liquidity INTO HashKey."**

This shows you aren't just "deploying everywhere" blindly, but have a strategic reason to make HashKey the **High-Value Core** of your protocol.
