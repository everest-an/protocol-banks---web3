# Security Overview — Card Program

**Version:** 1.0 · **Date:** November 2026
**Audience:** card issuer/partner due diligence (Yativo / Rain)

> This is a factual overview of the platform's controls for the card program. It
> is not a certification. No SOC 2, ISO 27001 or PCI DSS attestation is claimed;
> the card issuer remains responsible for cardholder data and BIN sponsorship.
> The source code is public (GPL-3.0-only) and can be reviewed directly.

---

## 1. Architecture in one page

```
User / AI agent
   │  API key (scoped)
   ▼
Protocol Bank policy layer ── allowedOps · per-call cap · daily cap · allowlist
   │  trade / pay / card request
   ├── Hyperliquid agent wallet (trading-only, no withdrawal)
   ├── EIP-3009 payment relayer (payer signs; platform pays gas)
   └── Card provider (KYC, card balance, Visa authorization)
            │
            ▼
        Visa network → merchant
```

- The platform is **non-custodial** for user crypto: it never holds user funds.
- Card balances are held by the card issuer/partner, not by Protocol Bank.
- The platform stores card **metadata** needed to display and control the card;
  full PAN/CVC handling is delegated to the provider (for Rain, decryption is
  browser-side; the exact Yativo data flow is confirmed in the program
  agreement).

## 2. Identity and key management

- Users authenticate by wallet signature, email magic link or OAuth.
- The custom non-custodial wallet uses **Shamir 2-of-3** shares: device
  (encrypted IndexedDB), server (PIN-encrypted in Postgres) and a user recovery
  code. The server cannot reconstruct the key alone.
- PIN-derived encryption: PBKDF2 (100k iterations) + AES-256-GCM.
- Embedded wallets can also be provided through Reown/Privy; private keys are
  never logged.
- Trading uses a Hyperliquid **trading-only agent wallet** authorised by
  EIP-712 `approveAgent`. It can place and cancel orders and **cannot withdraw**.

## 3. Agent API authentication and policy

- API keys are 256-bit random secrets, shown once, stored as **SHA-256 hashes**
  with a short prefix for identification.
- Each key carries a server-enforced policy:
  `allowedOps` (read / trade / pay / swap), `maxNotionalUsd`,
  `dailyCapUsd`, `allowedCoins`, plus rate limits and optional IP/origin
  allowlists.
- A key cannot widen its own policy. A policy violation is refused before any
  order, payment or card action is attempted.
- Every call is recorded in a usage log for reconciliation and investigation.

## 4. Payments (EIP-3009)

- The payer signs an EIP-3009 `TransferWithAuthorization`; the platform validates
  the signer (must be the key owner), recipient, amount, chain/token and
  validity window.
- The relayer submits the signed authorization and pays gas; the payer's own
  USDC moves. The platform never holds the funds.
- The on-chain nonce prevents replay; a used nonce is rejected.
- Payments are metered against the daily cap; refunds/chargebacks are handled by
  the card provider for card transactions and by the counterparty for direct
  transfers.

## 5. Trading controls

- One position per market; notional capped by equity and the key policy.
- Platform risk envelope: position cap, leverage cap, stop-loss, daily loss
  breaker, uncertain-order handling.
- An order that reaches the venue without a confirmed response is marked
  uncertain and reconciled by client-order-id; it is never blindly retried.

## 6. Card-specific controls

- One card per agent; per-card spend limit and freeze/close.
- Card creation requires provider KYC approval.
- Card webhooks are verified by the provider's signature scheme.
- Daily reconciliation of provider balance and card transactions against the
  platform ledger.
- Suspicious or anomalous card activity is escalated to the issuer's MLRO.

## 7. Data and infrastructure

- TLS in transit; secrets held in server-side environment configuration, not in
  the client bundle.
- Database access is server-side only; wallet-scoped queries and database
  isolation policies where enabled.
- Audit events for API keys, policy changes, orders, payments and card actions.
- Backups and access control follow least privilege; production access is
  limited to the operators who need it.

## 8. Incident response

1. **Detect** — monitoring, usage anomalies, provider webhooks, user reports.
2. **Contain** — disable keys, freeze cards, pause relayer/agent wallet.
3. **Assess** — scope, funds at risk, data involved.
4. **Notify** — affected users and the issuer/partner per the program agreement
   and applicable law.
5. **Remediate** — fix, rotate credentials, post-incident review.

Security reports: https://protocolbanks.com/contact (subject: Security). We aim
to acknowledge within 72 hours.

## 9. Known limitations (disclosed)

- No third-party security certification or public bug bounty yet; an internal
  review is in progress and its findings are being remediated.
- The relayer uses a per-instance nonce queue; concurrent submissions across
  serverless instances can collide. Production hardening is tracked.
- Trading is single-venue (Hyperliquid); an outage at the venue affects trading,
  not card balances.
- Card funds and cardholder data are held by the provider; their controls and
  certifications are part of provider due diligence.
- The platform does not currently provide insurance for card or trading losses.

## 10. What the provider can verify

- Public source: https://github.com/everest-an/protocol-banks---web3 (GPL-3.0-only).
- OpenAPI contract: https://protocolbanks.com/api/agent.openapi.json.
- Security contact: the form above; company registration and UBO documents are
  provided separately in the signed KYB submission.
