# Implementation Tasks

## Phase 1: Database Setup & Infrastructure

### Task 1.1: Create Database Schema
**Requirement Reference**: All requirements
**Description**: Create all required tables (auth_users, auth_sessions, embedded_wallets, email_verifications, audit_logs) with proper indexes and constraints.
**Acceptance Criteria**:
- All 5 tables created with correct schema
- All indexes created for performance
- Foreign key constraints enforced
- Timestamps auto-populated

**Implementation Steps**:
1. Create migration file: `migrations/001_create_auth_schema.sql`
2. Define auth_users table with status enum
3. Define auth_sessions table with indexes
4. Define embedded_wallets table with chain_id support
5. Define email_verifications table with token index
6. Define audit_logs table with JSONB details
7. Run migration and verify schema

**Estimated Effort**: 2 hours

---

### Task 1.2: Setup Email Service Integration
**Requirement Reference**: Requirement 1 (Email Verification)
**Description**: Integrate email provider (SendGrid or Resend) for sending Magic Links.
**Acceptance Criteria**:
- Email service configured with API key
- Magic Link template created
- Rate limiting configured (3 per hour)
- Error handling for failed sends

**Implementation Steps**:
1. Install email provider SDK (sendgrid or resend)
2. Create `services/email.service.ts` with send function
3. Create Magic Link email template
4. Implement rate limiting middleware
5. Add error handling and retry logic
6. Test email sending with test account

**Estimated Effort**: 3 hours

---

### Task 1.3: Setup Cryptography Libraries
**Requirement Reference**: Requirement 2 (PIN & Shamir), Requirement 3 (Wallet Creation)
**Description**: Install and configure cryptography libraries for Shamir sharing, AES encryption, and wallet generation.
**Acceptance Criteria**:
- Shamir library installed and tested
- AES-256-GCM encryption working
- BIP39 mnemonic generation working
- Ethereum address derivation working

**Implementation Steps**:
1. Install `@noble/shamir` for Shamir sharing
2. Install `tweetnacl.js` or `libsodium.js` for AES-256-GCM
3. Install `bip39` for mnemonic generation
4. Install `ethers.js` for wallet operations
5. Create `services/crypto.service.ts` with utility functions
6. Test all cryptographic operations

**Estimated Effort**: 2 hours

---

## Phase 2: Core Authentication Flow

### Task 2.1: Implement Magic Link Generation & Sending
**Requirement Reference**: Requirement 1 (Email Verification)
**Description**: Create API endpoint to generate and send Magic Links.
**Acceptance Criteria**:
- POST /api/auth/send-magic-link endpoint created
- Magic Link token generated (32 bytes)
- Token stored hashed in database
- Email sent with Magic Link
- Rate limiting enforced
- Error responses specific

**Implementation Steps**:
1. Create `app/api/auth/send-magic-link/route.ts`
2. Validate email format and check for disposable emails
3. Generate cryptographically secure token (32 bytes)
4. Hash token with SHA-256 before storing
5. Store in email_verifications table with 15-min expiration
6. Send email with Magic Link
7. Implement rate limiting (3 per email per hour)
8. Return success response with expiration time
9. Add comprehensive error handling
10. Add audit logging

**Estimated Effort**: 4 hours

---

### Task 2.2: Implement Magic Link Verification
**Requirement Reference**: Requirement 1 (Email Verification)
**Description**: Create API endpoint to verify Magic Link and create auth session.
**Acceptance Criteria**:
- GET /api/auth/verify-magic-link endpoint created
- Token verified and marked as used
- auth_users record created with status='email_verified'
- Session created for next step
- One-time use enforced
- Expiration checked

**Implementation Steps**:
1. Create `app/api/auth/verify-magic-link/route.ts`
2. Extract token from query parameter
3. Hash token and look up in email_verifications
4. Verify token not already used
5. Verify token not expired
6. Mark token as used
7. Create auth_users record if not exists
8. Update status to 'email_verified'
9. Create temporary session for PIN setup
10. Return session token and next step
11. Add audit logging

**Estimated Effort**: 3 hours

---

### Task 2.3: Implement PIN Setup & Validation
**Requirement Reference**: Requirement 2 (PIN & Shamir)
**Description**: Create API endpoint for PIN setup with validation and Shamir generation.
**Acceptance Criteria**:
- POST /api/auth/setup-pin endpoint created
- PIN validated (6 digits, no sequential)
- Shamir shares generated (2-of-3)
- Share A encrypted with PIN
- Share B encrypted with PIN
- Share C generated as BIP39 mnemonic
- Wallet address derived
- Status updated to 'pin_set'

**Implementation Steps**:
1. Create `app/api/auth/setup-pin/route.ts`
2. Validate session token
3. Validate PIN format (6 digits)
4. Check PIN strength (no sequential like 123456)
5. Hash PIN with Argon2 for storage
6. Generate private key (32 bytes random)
7. Generate Shamir shares (2-of-3 threshold)
8. Encrypt Share A with PIN-derived AES key
9. Encrypt Share B with PIN-derived AES key
10. Generate Share C as 12-word BIP39 mnemonic
11. Derive Ethereum address from private key
12. Store wallet in embedded_wallets table
13. Update user status to 'pin_set'
14. Return wallet address and recovery phrase
15. Add audit logging

**Estimated Effort**: 5 hours

---

### Task 2.4: Implement Recovery Phrase Confirmation
**Requirement Reference**: Requirement 2 (PIN & Shamir)
**Description**: Create API endpoint to confirm user has saved recovery phrase.
**Acceptance Criteria**:
- POST /api/auth/confirm-recovery endpoint created
- Recovery phrase validated against stored phrase
- User must enter 3 random words from phrase
- Status updated to 'wallet_created'
- Session created for dashboard access

**Implementation Steps**:
1. Create `app/api/auth/confirm-recovery/route.ts`
2. Validate session token
3. Select 3 random word positions from recovery phrase
4. Prompt user to enter those words
5. Verify user input matches stored phrase
6. Update user status to 'wallet_created'
7. Create persistent session for dashboard
8. Return success and redirect URL
9. Add audit logging

**Estimated Effort**: 3 hours

---

## Phase 3: Account Validation & Session Management

### Task 3.1: Implement Account-Wallet Association Validator
**Requirement Reference**: Requirement 4 (Account Validation)
**Description**: Create service to validate account-wallet relationships.
**Acceptance Criteria**:
- Validator checks user_id matches
- Validator checks wallet_address is valid
- Validator checks wallet_address is not null
- Validator creates audit log
- Validator prevents login if validation fails

**Implementation Steps**:
1. Create `services/account-validator.service.ts`
2. Implement validateAccountWalletAssociation function
3. Query auth_users and embedded_wallets
4. Verify user_id matches
5. Verify wallet_address is valid Ethereum address
6. Verify wallet_address is not null
7. Create audit log entry
8. Return validation result
9. Add error handling

**Estimated Effort**: 2 hours

---

### Task 3.2: Implement Session Creation & Management
**Requirement Reference**: Requirement 5 (Session Management)
**Description**: Create session management service with HTTP-only cookies.
**Acceptance Criteria**:
- Session created with 30-day expiration
- HTTP-only cookie set
- Session stored in database
- Device fingerprinting implemented
- Session validation on protected routes

**Implementation Steps**:
1. Create `services/session.service.ts`
2. Implement createSession function
3. Generate session token (32 bytes random)
4. Store in auth_sessions table
5. Set HTTP-only cookie with 30-day expiration
6. Implement device fingerprinting (user-agent + IP hash)
7. Store device fingerprint in session
8. Implement validateSession function
9. Implement destroySession function
10. Add session binding checks

**Estimated Effort**: 4 hours

---

### Task 3.3: Implement Protected Route Middleware
**Requirement Reference**: Requirement 5 (Session Management)
**Description**: Create middleware to protect routes and validate sessions.
**Acceptance Criteria**:
- Middleware checks session validity
- Middleware validates device fingerprint
- Middleware redirects to login if invalid
- Middleware works with Next.js API routes

**Implementation Steps**:
1. Create `middleware/auth.middleware.ts`
2. Extract session token from cookie
3. Validate session in database
4. Check session expiration
5. Verify device fingerprint
6. Attach user info to request
7. Return 401 if invalid
8. Add to protected routes
9. Test with multiple routes

**Estimated Effort**: 3 hours

---

## Phase 4: Error Handling & Recovery

### Task 4.1: Implement Error Handling & Recovery Flows
**Requirement Reference**: Requirement 6 (Error Handling)
**Description**: Create comprehensive error handling with recovery options.
**Acceptance Criteria**:
- Specific error messages for each failure
- Recovery options provided
- PIN recovery via recovery phrase
- Account recovery via email
- Clear user guidance

**Implementation Steps**:
1. Create `services/error-handler.service.ts`
2. Define error codes and messages
3. Implement PIN recovery flow
4. Implement account recovery flow
5. Create error response templates
6. Add error logging
7. Test all error scenarios

**Estimated Effort**: 3 hours

---

### Task 4.2: Implement Data Consistency Checks
**Requirement Reference**: Requirement 7 (Data Consistency)
**Description**: Create transaction-based operations to ensure atomicity.
**Acceptance Criteria**:
- Database transactions used for multi-step operations
- Rollback on failure
- No orphaned records
- Referential integrity maintained

**Implementation Steps**:
1. Create `services/transaction.service.ts`
2. Implement transaction wrapper
3. Use database transactions for user creation
4. Use transactions for wallet creation
5. Use transactions for session creation
6. Implement rollback logic
7. Test failure scenarios

**Estimated Effort**: 3 hours

---

## Phase 5: Security & Audit

### Task 5.1: Implement Security Measures
**Requirement Reference**: Requirement 8 (Security)
**Description**: Implement CSRF protection, rate limiting, and input validation.
**Acceptance Criteria**:
- CSRF tokens generated and validated
- Rate limiting on login attempts (5 per IP per hour)
- Input validation on all endpoints
- HTTPS enforced
- Suspicious patterns detected

**Implementation Steps**:
1. Implement CSRF middleware
2. Add rate limiting middleware (5 per IP per hour)
3. Implement input validation service
4. Add email format validation
5. Add address format validation
6. Implement suspicious pattern detection
7. Add IP-based rate limiting
8. Test security measures

**Estimated Effort**: 4 hours

---

### Task 5.2: Implement Audit Logging
**Requirement Reference**: Requirement 7 (Data Consistency)
**Description**: Create comprehensive audit logging for all authentication events.
**Acceptance Criteria**:
- All state transitions logged
- All authentication events logged
- All errors logged
- Audit logs retained for 90 days
- Audit logs queryable by user

**Implementation Steps**:
1. Create `services/audit-logger.service.ts`
2. Log all state transitions
3. Log all authentication events
4. Log all errors with context
5. Store IP address and user agent
6. Implement audit log retention policy
7. Create audit log query endpoints
8. Test audit logging

**Estimated Effort**: 3 hours

---

## Phase 6: Testing & Deployment

### Task 6.1: Create Integration Tests
**Requirement Reference**: All requirements
**Description**: Create comprehensive integration tests for entire flow.
**Acceptance Criteria**:
- Happy path tested end-to-end
- Error scenarios tested
- Recovery flows tested
- All correctness properties verified

**Implementation Steps**:
1. Create test suite for email verification
2. Create test suite for PIN setup
3. Create test suite for wallet creation
4. Create test suite for session management
5. Create test suite for error handling
6. Create test suite for security measures
7. Run all tests and verify passing

**Estimated Effort**: 6 hours

---

### Task 6.2: Deploy to Staging
**Requirement Reference**: All requirements
**Description**: Deploy email login flow to staging environment.
**Acceptance Criteria**:
- All endpoints working in staging
- Database migrations applied
- Email service configured
- Monitoring enabled
- Logs accessible

**Implementation Steps**:
1. Prepare staging environment
2. Run database migrations
3. Configure environment variables
4. Deploy code to staging
5. Verify all endpoints
6. Test email sending
7. Enable monitoring and logging
8. Document deployment steps

**Estimated Effort**: 3 hours

---

### Task 6.3: Create User Documentation
**Requirement Reference**: All requirements
**Description**: Create documentation for email login flow.
**Acceptance Criteria**:
- User guide created
- API documentation created
- Error codes documented
- Recovery procedures documented

**Implementation Steps**:
1. Create user guide for email login
2. Create API documentation
3. Document error codes and meanings
4. Document recovery procedures
5. Create troubleshooting guide
6. Add to project README

**Estimated Effort**: 2 hours

---

## Summary

**Total Estimated Effort**: 60 hours

**Phase Breakdown**:
- Phase 1 (Infrastructure): 7 hours
- Phase 2 (Core Auth): 15 hours
- Phase 3 (Validation & Sessions): 10 hours
- Phase 4 (Error Handling): 6 hours
- Phase 5 (Security & Audit): 7 hours
- Phase 6 (Testing & Deployment): 11 hours

**Recommended Timeline**: 2-3 weeks with 1 developer working full-time
