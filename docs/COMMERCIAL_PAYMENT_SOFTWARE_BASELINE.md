# Commercial Payment Software Baseline

This document defines the minimum engineering baseline for commercial payment software features in this repository.

## 1) Data Isolation (Tenant/User Scope)

### Requirements
- All client-side persisted data **must** be namespaced by wallet/user/tenant scope.
- Avoid global keys such as `xxx_settings` for payment-sensitive workflows.
- Backward compatibility is allowed for reads, but all writes must use scoped keys.

### Implemented examples
- `batchPaymentDraft:{wallet}`
- `pos_settings:{merchantOrAddress}`
- `pos_transactions:{merchantOrAddress}`
- `pb:admin:fee-config:{wallet}`
- `pb:admin:contracts:{wallet}`
- `pb:admin:domains:{wallet}`

### Validation checklist
- Two users on same browser cannot see each other’s drafts/config.
- Mixed-case wallet addresses map to one normalized scope (`toLowerCase()`).

## 2) Filter Linkage Consistency

### Requirements
- List/table filters and graph/chart filters must share the same source dataset.
- Tag filtering must drive all dependent widgets (cards, graph, detail panel).
- When filters remove selected nodes, UI must gracefully reselect fallback node.

### Validation checklist
- Changing tag updates list count, graph nodes, and summary cards together.
- No stale selected entity after filter changes.

## 3) Token Switch Consistency

### Requirements
- Token selector (ALL/USDC/USDT/DAI) must affect:
  - Aggregated stats
  - Entity-level metric cards
  - Graph visual emphasis (weight/radius/flow)
- Token-level volume mapping should come from transaction-derived data.

### Validation checklist
- Token switch changes totals and per-entity values immediately.
- Unsupported/missing token volumes safely fallback to `0`.

## 4) Input Normalization and Validation

### Requirements
- Domain values: `trim().toLowerCase()` and regex validation.
- Contract addresses: strict EVM format validation (`0x` + 40 hex chars).
- Reject invalid payloads with explicit user feedback.

## 5) Test Gate (Release Minimum)

### Required automated checks before release
- UAT regression
- Payment flow regression
- Network/token configuration regression
- Subscription regression
- Vendor statistics & linking regression

### Recommended command
```bash
pnpm test -- --runInBand \
  __tests__/uat/user-acceptance.test.ts \
  __tests__/e2e/payment-flow.test.ts \
  __tests__/e2e/network-config.test.ts \
  lib/__tests__/subscription-service.test.ts \
  lib/__tests__/vendor-payment-service.test.ts
```

## 6) Security & Compliance Notes

- Client-side isolation improves UX safety but is **not** access control.
- API-layer ownership verification (`verifySession`, `getAuthenticatedAddress`, owner checks) remains mandatory.
- Audit logging for config changes is recommended for production compliance.

## 7) Next Hardening (Recommended)

- Add Playwright UI smoke tests for:
  - Tag ↔ graph linkage
  - Token switch ↔ chart/graph updates
  - Scoped localStorage isolation behavior
- Add server-side audit records for admin config mutations.
- Add data retention and key management policy document for operations teams.
