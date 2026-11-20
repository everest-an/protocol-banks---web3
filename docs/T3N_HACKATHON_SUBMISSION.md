# T3N Private Vendor Vault — Submission Copy

## Short description

Protocol Bank lets agents pay, trade and reconcile under a server-enforced mandate. The T3N Private
Vendor Vault adds the missing privacy layer for supplier onboarding: vendor KYC, bank and identity
data stay inside a Terminal 3 TEE, while the payment agent receives only the boolean answers it
needs.

## Problem

A payment agent needs to know whether a vendor is KYC-verified, resident in an allowed country, and
has an account old enough to pay. Today those fields are loaded into application memory, sent to a
model, or copied into logs. That is exactly the data a compromised agent or prompt injection should
never see.

## Solution

1. The data owner stores a vendor record in a T3N vault.
2. The owner grants the Protocol Bank agent only `check` — not `store` or `forget`.
3. The agent asks rule-based questions: `kyc_verified`, `id_not_expired`, `residency_in`,
   `account_open_min_months`.
4. The TEE evaluates the encrypted record and returns booleans.
5. Protocol Bank uses the booleans to gate a payment; the raw record never enters our server,
   logs, model context, or browser.

## Live demo

- UI: https://www.protocolbanks.com/t3n-vault
- Video: https://www.protocolbanks.com/t3n-vault-demo.mp4
- Source: https://github.com/everest-an/protocol-banks---web3
- Docs: https://github.com/everest-an/protocol-banks---web3/blob/main/docs/T3N_PRIVATE_VENDOR_VAULT.md
- API: `POST /api/t3n/vendor-check` (SIWE), `GET /api/t3n/demo` (fixed demo vendor),
  `GET /api/t3n/status`

## T3N integration evidence

- Network: T3N testnet
- Tenant DID: `did:t3n:1b979545829cbe5ac1899fdaacf4c8b22e67ac2d`
- Agent DID: `did:t3n:088a3e3681aaac82ff085ae4ba1a8ba79973cd50`
- Contract: `z:1b979545829cbe5ac1899fdaacf4c8b22e67ac2d:vendor-vault-v2`
- Agent key: stored only in server environment, never in the repository
- Grant: only `check`; `store` and `forget` reject delegated calls
- Verified local response:

```json
{
  "answers": {
    "account_open_min_months": true,
    "id_not_expired": true,
    "kyc_verified": true,
    "residency_in": true
  },
  "allPassed": true,
  "configured": true
}
```

## Architecture

```
MetaMask / SIWE
      │
      ▼
Protocol Bank API / T3N vault page
      │  (agent invoke; no vendor record)
      ▼
Terminal 3 TEE contract  ──►  encrypted vendor vault
      │
      └── booleans only ──► payment eligibility decision
```

## Why Protocol Bank

- Already ships agent commerce, stablecoin payments, cards and trading under one mandate.
- Already enforces per-call/daily caps, allowlists and server-side risk limits.
- T3N supplies agent DID identity, scoped delegation, confidential compute and tamper-evident logs.
- The combination is a practical “agent can act, but cannot see or leak the sensitive data” design.

## Tech

Next.js 15, TypeScript, SIWE, viem, Terminal 3 ADK, Rust/WASM TEE contract, Vercel, PostgreSQL.

## Security boundaries

- No wallet private keys are stored by T3N or Protocol Bank.
- Vendor records are encrypted and processed inside the TEE.
- The agent has only the `check` function and no outbound HTTP capability in the vault world.
- The UI receives booleans, not raw fields.
- Agent credit and DID binding are separate from the owner tenant.
