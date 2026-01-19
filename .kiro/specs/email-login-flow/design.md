# Design Document

## System Architecture

### High-Level Flow

```
User Email Input
    ↓
Email Verification (Magic Link)
    ↓
PIN Setup & Shamir Generation
    ↓
Wallet Creation (Multi-chain)
    ↓
Account-Wallet Association
    ↓
Session Creation
    ↓
User Active
```

### Component Interactions

```
Frontend (Next.js)
    ↓
API Routes (/api/auth/*)
    ↓
Auth Service (Business Logic)
    ├─ Email Verifier
    ├─ Wallet Creator
    ├─ Account Validator
    └─ Session Manager
    ↓
Database (PostgreSQL)
    ├─ auth_users
    ├─ auth_sessions
    ├─ embedded_wallets
    └─ audit_logs
    ↓
External Services
    ├─ Email Provider (SendGrid/Resend)
    └─ Blockchain RPC (Alchemy/Infura)
```

## Database Schema

### auth_users Table

```sql
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  -- Status values: pending_verification, email_verified, pin_set, wallet_created, active
  pin_hash VARCHAR(255), -- Argon2 hash of PIN
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  verification_attempts INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_status ON auth_users(status);
```

### auth_sessions Table

```sql
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  device_fingerprint VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

### embedded_wallets Table

```sql
CREATE TABLE embedded_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  public_key VARCHAR(255) NOT NULL,
  chain_id INT NOT NULL, -- 1=Ethereum, 137=Polygon, 1=Solana, etc.
  share_a_encrypted TEXT NOT NULL, -- Encrypted with PIN
  share_b_encrypted TEXT NOT NULL, -- Encrypted with PIN
  share_c_recovery TEXT NOT NULL, -- 12-word BIP39 mnemonic
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_embedded_wallets_user_id ON embedded_wallets(user_id);
CREATE INDEX idx_embedded_wallets_address ON embedded_wallets(wallet_address);
```

### email_verifications Table

```sql
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
```

### audit_logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## API Interfaces

### POST /api/auth/send-magic-link

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Magic link sent to email",
  "expiresIn": 900
}
```

**Response (429):**
```json
{
  "error": "Too many requests. Try again in 1 hour."
}
```

### GET /api/auth/verify-magic-link?token=xxx

**Response (200):**
```json
{
  "success": true,
  "sessionToken": "sess_xxx",
  "nextStep": "pin_setup"
}
```

**Response (400):**
```json
{
  "error": "Invalid or expired token"
}
```

### POST /api/auth/setup-pin

**Request:**
```json
{
  "pin": "123456",
  "sessionToken": "sess_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "walletAddress": "0x...",
  "recoveryPhrase": "word1 word2 ... word12",
  "nextStep": "confirm_recovery"
}
```

### POST /api/auth/confirm-recovery

**Request:**
```json
{
  "recoveryPhrase": "word1 word2 ... word12",
  "sessionToken": "sess_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Account setup complete",
  "redirectTo": "/dashboard"
}
```

## Cryptographic Implementation

### Shamir Secret Sharing

- **Library**: `secrets.js` or `@noble/shamir`
- **Threshold**: 2-of-3 (need 2 shares to reconstruct private key)
- **Share A**: Stored on device (encrypted with PIN)
- **Share B**: Stored on server (encrypted with PIN)
- **Share C**: Recovery phrase (12-word BIP39 mnemonic)

### PIN Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Salt**: 32 bytes random per user
- **IV**: 12 bytes random per encryption

### Magic Link Token

- **Length**: 32 bytes (256 bits)
- **Encoding**: Base64URL
- **Expiration**: 15 minutes
- **Storage**: Hashed in database (SHA-256)

## State Machine

```
┌─────────────────────────────────────────────────────────────┐
│ pending_verification                                        │
│ - User enters email                                         │
│ - Magic Link sent                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ Magic Link clicked
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ email_verified                                              │
│ - Email verified                                            │
│ - Prompt for PIN setup                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ PIN set
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ pin_set                                                     │
│ - Shamir shares generated                                   │
│ - Wallet created                                            │
│ - Recovery phrase shown                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ Recovery phrase confirmed
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ wallet_created                                              │
│ - Account-wallet association verified                       │
│ - Session created                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ Validation passed
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ active                                                      │
│ - User can access dashboard                                 │
│ - Session valid for 30 days                                 │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

### Retry Logic

- **Email sending**: Retry 3 times with exponential backoff
- **Wallet creation**: Retry 2 times, then fail with recovery option
- **Session creation**: Fail immediately, user must re-verify email

### Recovery Paths

1. **Lost PIN**: Use recovery phrase to restore wallet
2. **Lost Recovery Phrase**: Use email verification to reset account
3. **Corrupted Wallet**: Audit log shows state, manual recovery by support

## Security Considerations

### Threat Model

1. **Email Interception**: Mitigated by HTTPS, short expiration (15 min)
2. **Session Hijacking**: Mitigated by device fingerprinting, IP binding
3. **Private Key Exposure**: Mitigated by Shamir sharing, PIN encryption
4. **Replay Attacks**: Mitigated by one-time use tokens, nonce tracking
5. **Brute Force**: Mitigated by rate limiting, account lockout

### Rate Limiting

- Magic Link requests: 3 per email per hour
- Login attempts: 5 per IP per hour
- PIN attempts: 3 per session, then lockout 15 minutes

### Audit Trail

- All state transitions logged
- All authentication events logged
- All errors logged with context
- Retention: 90 days

## Correctness Properties

### Property 1: Email Verification Atomicity
**Invariant**: If email_verified status is set, then email_verifications.is_used must be true
**Test**: Verify that email verification token is marked as used before status update

### Property 2: Wallet-User Association
**Invariant**: Every active user must have exactly one embedded_wallet
**Test**: Query all active users and verify each has exactly one wallet

### Property 3: Session Validity
**Invariant**: If session is active, then user status must be 'active'
**Test**: Query all active sessions and verify corresponding users are active

### Property 4: PIN Encryption Consistency
**Invariant**: If PIN is set, then pin_hash must be non-null and valid Argon2 hash
**Test**: Verify all users with status >= 'pin_set' have valid pin_hash

### Property 5: Recovery Phrase Integrity
**Invariant**: Recovery phrase must be valid 12-word BIP39 mnemonic
**Test**: Validate all recovery phrases against BIP39 word list

### Property 6: Shamir Share Reconstruction
**Invariant**: Share A + Share B must reconstruct to valid private key
**Test**: For each wallet, decrypt shares and verify reconstruction

### Property 7: Address Derivation Correctness
**Invariant**: Wallet address must match derived address from public key
**Test**: Derive address from public key and compare with stored address

### Property 8: Session Expiration
**Invariant**: If current_time > session.expires_at, then session must be inactive
**Test**: Query expired sessions and verify is_active = false

### Property 9: Audit Log Completeness
**Invariant**: Every status transition must have corresponding audit log entry
**Test**: For each user, verify audit logs match status transitions

### Property 10: Email Uniqueness
**Invariant**: No two users can have same email
**Test**: Query for duplicate emails, should return 0

### Property 11: Device Fingerprint Consistency
**Invariant**: Same device should have consistent fingerprint across sessions
**Test**: Create multiple sessions from same device, verify fingerprint matches

### Property 12: IP Address Binding
**Invariant**: Session should be rejected if IP changes significantly
**Test**: Create session from IP A, attempt access from IP B, verify rejection

### Property 13: Magic Link One-Time Use
**Invariant**: Each magic link token can only be used once
**Test**: Use token once, attempt reuse, verify rejection

### Property 14: PIN Strength Validation
**Invariant**: PIN must not be sequential (123456, 654321, etc.)
**Test**: Attempt to set sequential PIN, verify rejection

### Property 15: Rate Limit Enforcement
**Invariant**: More than 3 magic link requests per hour should be rejected
**Test**: Send 4 requests in 1 hour, verify 4th is rejected

### Property 16: Transaction Atomicity
**Invariant**: If user creation fails, no partial records should exist
**Test**: Simulate failure during user creation, verify rollback

### Property 17: Referential Integrity
**Invariant**: All foreign keys must reference existing records
**Test**: Query for orphaned records (user without wallet, session without user)

### Property 18: Timestamp Consistency
**Invariant**: updated_at >= created_at for all records
**Test**: Query all records, verify timestamp ordering

### Property 19: Status Transition Validity
**Invariant**: Status can only transition forward (pending → verified → pin_set → wallet_created → active)
**Test**: Attempt invalid status transitions, verify rejection

### Property 20: Session Token Uniqueness
**Invariant**: No two sessions can have same token
**Test**: Query for duplicate session tokens, should return 0

## Implementation Notes

- Use TypeScript for type safety
- Implement comprehensive error handling with specific error codes
- Use database transactions for multi-step operations
- Implement comprehensive logging for debugging
- Use environment variables for configuration (expiration times, rate limits)
- Implement health checks for external services (email provider, RPC)
