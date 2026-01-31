# Security Architecture

## Overview

ProtocolBanks implements a **Non-Custodial** architecture where:
- Users maintain full control of their private keys
- ProtocolBanks **cannot** access, move, or freeze user funds
- All data is encrypted and isolated per customer

## Data Isolation

### Row Level Security (RLS)

Every database table has RLS policies ensuring:

\`\`\`sql
-- Users can only see their own data
CREATE POLICY "View own data" ON table_name
  FOR SELECT USING (
    owner_address = current_setting('app.current_user_address', true)
  );
\`\`\`

### Customer Routing Isolation

| Data Type | Isolation Method |
|-----------|------------------|
| Vendors | `created_by` = user wallet address |
| Payments | `from_address` = user wallet address |
| Batch Payments | `wallet_address` = user wallet address |
| Multi-sig Wallets | `created_by` OR member of signers |
| Embedded Wallets | `user_id` = authenticated user ID |

### What ProtocolBanks Cannot Do

- Read customer private keys
- Decrypt customer wallet shares
- Execute transactions on behalf of customers
- Access customer payment history without authorization
- Modify customer data without user action

## Multi-Signature Security

### Non-Custodial Multi-sig

\`\`\`
┌────────────────────────────────────────────────────┐
│                 Safe (Gnosis Safe)                  │
│                                                    │
│  Signers: [CFO, CEO, Controller]                   │
│  Threshold: 2 of 3                                 │
│                                                    │
│  ProtocolBanks: NOT A SIGNER                       │
│  ProtocolBanks cannot execute transactions         │
└────────────────────────────────────────────────────┘
\`\`\`

### Approval Flow

1. **Proposal** - Any signer can propose a transaction
2. **Review** - Other signers review transaction details
3. **Sign** - Each signer cryptographically signs the transaction
4. **Execute** - When threshold is met, anyone can execute
5. **Audit** - All actions are logged immutably

## Embedded Wallet Security

### Key Splitting (Shamir's Secret Sharing)

\`\`\`
Private Key → Split into 3 shares
             ├─ Share A: Device (encrypted, never leaves browser)
             ├─ Share B: Server (encrypted with user PIN)
             └─ Share C: Recovery (user-stored backup)

Threshold: 2 of 3 shares required to reconstruct
\`\`\`

### Security Guarantees

| Attack Vector | Protection |
|--------------|------------|
| Server breach | Only encrypted Share B, cannot reconstruct key |
| Device theft | Requires PIN + Share B from server |
| Admin access | No admin can access 2 shares |
| Man-in-middle | All shares encrypted, HTTPS enforced |

## Audit Logging

All sensitive actions are logged:

\`\`\`sql
INSERT INTO audit_logs (
  actor,
  action,
  target_type,
  target_id,
  details,
  ip_address
) VALUES (
  '0x...user_address',
  'batch_payment_created',
  'batch_payment',
  'uuid',
  '{"amount": 10000, "recipients": 5}',
  'xxx.xxx.xxx.xxx'
);
\`\`\`

Audit logs are **immutable** - no updates or deletes allowed.

## API Security

### Authentication

- Session-based authentication with HTTP-only cookies
- JWT tokens with short expiration
- Device fingerprinting for session binding

### Rate Limiting

- Per-IP rate limits
- Per-user rate limits
- Per-action rate limits (e.g., 10 payments/minute)

### Input Validation

- All wallet addresses validated with checksum
- Amount validation (positive, within limits)
- SQL injection prevention via parameterized queries

## Compliance

- Data encrypted at rest (Supabase)
- Data encrypted in transit (TLS 1.3)
- GDPR-compliant data handling
- SOC 2 Type II (Supabase infrastructure)
