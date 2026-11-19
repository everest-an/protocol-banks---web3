# T3N Private Vendor Vault

Protocol Bank uses Terminal 3's Agent Developer Kit to ask vendor eligibility questions without
exposing the vendor's bank, identity or KYC data to the model, application logs or Protocol Bank
servers.

## Why

Batch payments need to know:

- Is the vendor KYC verified?
- Is the vendor resident in an allowed country?
- Is the vendor account old enough?
- Is the ID document valid?

The old flow would load those fields into application memory so an agent or rule engine could inspect
them. T3N moves the record into a TEE vault and returns only booleans. The agent gets the answer it
needs and never sees the raw value.

## Flow

```
Vendor / data owner
  └─ store(record) in T3N vault
       └─ grant agent only `check`

Protocol Bank agent
  └─ invoke(check, rules)
       └─ TEE reads the encrypted record
            └─ returns { answers: { kyc_verified: true, ... } }
                 └─ no raw field, no log value, no model context
```

## Runtime configuration

| Variable | Meaning |
| --- | --- |
| `T3N_AGENT_API_KEY` | Agent credential used by `invoke()`; never the tenant key |
| `T3N_CONTRACT_ID` | Canonical `z:<tid>:vendor-vault` contract name |
| `T3N_CUSTOMER_DID` | DID of the data owner whose vault is checked |

No T3N key is required for the public status check. `GET /api/t3n/vendor-check` reports whether the
integration is configured.

## One-time setup

1. Claim a developer key at https://terminal3.io/claim-page (self-serve test credits).
2. Build the reference TEE contract:

   ```bash
   cd vendor/agent-vault-starter
   rustup target add wasm32-wasip2
   cargo build --target wasm32-wasip2 --release
   ```

3. Run the setup script:

   ```bash
   T3N_API_KEY=t3n_... npx tsx scripts/t3n/setup-vault.ts
   ```

   It creates an organisation, a funded agent, registers the vault contract, creates the private
   map, stores the demo vendor record, grants the agent `check`, and prints the three runtime values.

4. Add the printed values to `.env.local` and the Vercel production environment.

## API

`POST /api/t3n/vendor-check` requires a SIWE session.

```json
{
  "rules": {
    "kyc_verified": true,
    "id_not_expired": true,
    "residency_in": ["HK", "SG", "GB"],
    "account_open_min_months": 12
  }
}
```

Response:

```json
{
  "answers": {
    "kyc_verified": true,
    "id_not_expired": true,
    "residency_in": true,
    "account_open_min_months": true
  },
  "allPassed": true,
  "configured": true,
  "customerDid": "did:t3n:...",
  "contractId": "z:...:vendor-vault"
}
```

The response never contains the vendor's name, bank account, ID number, balance or income.

## Security properties

- The agent is granted only `check`; `store` and `forget` reject delegated calls.
- The vault contract imports only tenant context, logging and KV-store; it has no HTTP capability.
- Map ACLs name only the contract as reader/writer.
- The Protocol Bank server calls `invoke()` with the agent key and receives booleans.
- T3N's activity log records actor, on-behalf-of DID, function and outcome.

## Demo

- UI: https://www.protocolbanks.com/t3n-vault
- Contract source: `vendor/agent-vault-starter` (reference T3N starter)
- API: `app/api/t3n/vendor-check/route.ts`
- Helper: `lib/t3n/vault.ts`
