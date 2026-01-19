# Implementation Tasks

## Phase 1: Database Setup & Infrastructure

### Task 1.1: Create Database Schema
**Requirement Reference**: All requirements
**Description**: Create all required tables (x402_authorizations, x402_nonces, x402_used_nonces, x402_executions, x402_audit_logs) with proper indexes and constraints.
**Acceptance Criteria**:
- All 5 tables created with correct schema
- All indexes created for performance
- Foreign key constraints enforced
- Timestamps auto-populated

**Implementation Steps**:
1. Create migration file: `migrations/003_create_x402_schema.sql`
2. Define x402_authorizations table with status enum
3. Define x402_nonces table with unique constraint
4. Define x402_used_nonces table with unique constraint
5. Define x402_executions table with tx hash index
6. Define x402_audit_logs table with JSONB details
7. Create indexes for common queries
8. Run migration and verify schema

**Estimated Effort**: 2 hours

---

### Task 1.2: Setup EIP-712 Signing Infrastructure
**Requirement Reference**: Requirement 1 (EIP-712 Signing)
**Description**: Create infrastructure for EIP-712 domain separator and message hashing.
**Acceptance Criteria**:
- Domain separator generation working
- Message hashing working
- Signature verification working
- Multi-chain support

**Implementation Steps**:
1. Create `services/eip712.service.ts`
2. Implement domain separator generation
3. Implement message hashing
4. Implement signature verification
5. Support multiple chains
6. Cache domain separators
7. Test EIP-712 operations

**Estimated Effort**: 3 hours

---

### Task 1.3: Setup Relayer Integration
**Requirement Reference**: Requirement 4 (Relayer Architecture)
**Description**: Create integration with relayer service for transaction submission.
**Acceptance Criteria**:
- Relayer API client created
- Authorization submission working
- Status polling working
- Error handling for relayer failures

**Implementation Steps**:
1. Create `services/relayer-client.service.ts`
2. Implement relayer API client
3. Implement authorization submission
4. Implement status polling
5. Implement retry logic
6. Add error handling
7. Test relayer integration

**Estimated Effort**: 3 hours

---

## Phase 2: Nonce Management

### Task 2.1: Implement Nonce Generation & Tracking
**Requirement Reference**: Requirement 2 (Nonce Management)
**Description**: Create service to manage nonces and prevent replay attacks.
**Acceptance Criteria**:
- Nonce counter maintained per user+token+chain
- Nonce incremented for each authorization
- Used nonces tracked
- Nonce queries working

**Implementation Steps**:
1. Create `services/nonce-manager.service.ts`
2. Implement nonce initialization
3. Implement nonce increment
4. Implement used nonce tracking
5. Implement nonce queries
6. Handle nonce overflow
7. Test nonce management

**Estimated Effort**: 3 hours

---

### Task 2.2: Implement Nonce Validation
**Requirement Reference**: Requirement 2 (Nonce Management)
**Description**: Create validation to prevent nonce reuse.
**Acceptance Criteria**:
- Nonce validation working
- Replay attacks prevented
- Clear error messages for nonce errors

**Implementation Steps**:
1. Create `services/nonce-validator.service.ts`
2. Implement nonce existence check
3. Implement nonce usage check
4. Implement error reporting
5. Test nonce validation

**Estimated Effort**: 2 hours

---

## Phase 3: Signature Generation & Verification

### Task 3.1: Implement Authorization Generation
**Requirement Reference**: Requirement 1 (EIP-712 Signing)
**Description**: Create service to generate authorization structures for signing.
**Acceptance Criteria**:
- Domain separator generated
- Message structure created
- Validity window set
- Nonce assigned

**Implementation Steps**:
1. Create `services/authorization-generator.service.ts`
2. Implement domain separator generation
3. Implement message structure creation
4. Implement validity window calculation
5. Implement nonce assignment
6. Store authorization in database
7. Test authorization generation

**Estimated Effort**: 3 hours

---

### Task 3.2: Implement Signature Verification
**Requirement Reference**: Requirement 1 (EIP-712 Signing)
**Description**: Create service to verify signatures and recover signer.
**Acceptance Criteria**:
- Signature format validated
- Signer recovered correctly
- Signature matches authorizer
- Error handling for invalid signatures

**Implementation Steps**:
1. Create `services/signature-verifier.service.ts`
2. Implement signature format validation
3. Implement signer recovery
4. Implement authorizer matching
5. Implement error handling
6. Test signature verification

**Estimated Effort**: 2 hours

---

## Phase 4: Validity Window Management

### Task 4.1: Implement Validity Window Enforcement
**Requirement Reference**: Requirement 3 (Validity Window)
**Description**: Create service to enforce validity windows for authorizations.
**Acceptance Criteria**:
- validAfter checked
- validBefore checked
- Expired authorizations rejected
- Clear error messages

**Implementation Steps**:
1. Create `services/validity-window.service.ts`
2. Implement validAfter check
3. Implement validBefore check
4. Implement expiration detection
5. Implement error reporting
6. Test validity window enforcement

**Estimated Effort**: 2 hours

---

### Task 4.2: Implement Expiration Notifications
**Requirement Reference**: Requirement 3 (Validity Window)
**Description**: Create service to notify users of expiring authorizations.
**Acceptance Criteria**:
- Expiration time shown to user
- Notifications sent before expiration
- Expired authorizations logged

**Implementation Steps**:
1. Create `services/expiration-notifier.service.ts`
2. Implement expiration time calculation
3. Implement notification logic
4. Implement expiration logging
5. Test expiration notifications

**Estimated Effort**: 2 hours

---

## Phase 5: API Endpoints

### Task 5.1: Implement Authorization Generation Endpoint
**Requirement Reference**: Requirement 1 (EIP-712 Signing)
**Description**: Create API endpoint to generate authorizations for signing.
**Acceptance Criteria**:
- POST /api/x402/generate-authorization endpoint
- Returns domain, types, and message
- Returns validity window

**Implementation Steps**:
1. Create `app/api/x402/generate-authorization/route.ts`
2. Validate request parameters
3. Call authorization generator
4. Return domain, types, message
5. Add error handling
6. Test endpoint

**Estimated Effort**: 2 hours

---

### Task 5.2: Implement Signature Submission Endpoint
**Requirement Reference**: Requirement 1 (EIP-712 Signing)
**Description**: Create API endpoint to submit signatures.
**Acceptance Criteria**:
- POST /api/x402/submit-signature endpoint
- Verifies signature
- Stores authorization
- Returns status

**Implementation Steps**:
1. Create `app/api/x402/submit-signature/route.ts`
2. Validate signature format
3. Call signature verifier
4. Store authorization
5. Return status
6. Add error handling
7. Test endpoint

**Estimated Effort**: 2 hours

---

### Task 5.3: Implement Relayer Submission Endpoint
**Requirement Reference**: Requirement 4 (Relayer Architecture)
**Description**: Create API endpoint to submit to relayer.
**Acceptance Criteria**:
- POST /api/x402/submit-to-relayer endpoint
- Submits to relayer
- Returns relayer tx hash
- Tracks submission

**Implementation Steps**:
1. Create `app/api/x402/submit-to-relayer/route.ts`
2. Validate authorization
3. Call relayer client
4. Track submission
5. Return relayer tx hash
6. Add error handling
7. Test endpoint

**Estimated Effort**: 2 hours

---

### Task 5.4: Implement Status Endpoint
**Requirement Reference**: Requirement 8 (Monitoring & Audit)
**Description**: Create API endpoint to check authorization status.
**Acceptance Criteria**:
- GET /api/x402/:authorizationId/status endpoint
- Returns current status
- Returns transaction hash if executed
- Returns error if failed

**Implementation Steps**:
1. Create `app/api/x402/[authorizationId]/status/route.ts`
2. Query authorization
3. Return status
4. Return transaction details if executed
5. Add error handling
6. Test endpoint

**Estimated Effort**: 1 hour

---

### Task 5.5: Implement Cancellation Endpoint
**Requirement Reference**: Requirement 7 (Error Handling)
**Description**: Create API endpoint to cancel authorizations.
**Acceptance Criteria**:
- POST /api/x402/:authorizationId/cancel endpoint
- Marks nonce as used
- Prevents reuse
- Returns success

**Implementation Steps**:
1. Create `app/api/x402/[authorizationId]/cancel/route.ts`
2. Validate authorization
3. Mark nonce as used
4. Update status to cancelled
5. Return success
6. Add error handling
7. Test endpoint

**Estimated Effort**: 1 hour

---

## Phase 6: On-Chain Verification

### Task 6.1: Implement On-Chain Verification Service
**Requirement Reference**: Requirement 5 (On-Chain Verification)
**Description**: Create service to verify and monitor on-chain execution.
**Acceptance Criteria**:
- Transaction status checked on-chain
- Execution verified
- Nonce marked as used
- Audit logged

**Implementation Steps**:
1. Create `services/onchain-verifier.service.ts`
2. Implement transaction status checking
3. Implement execution verification
4. Implement nonce marking
5. Implement audit logging
6. Test on-chain verification

**Estimated Effort**: 3 hours

---

### Task 6.2: Implement Transaction Monitoring
**Requirement Reference**: Requirement 8 (Monitoring & Audit)
**Description**: Create service to monitor transaction status.
**Acceptance Criteria**:
- Transaction status polled
- Status updates tracked
- Failures detected
- Retry logic implemented

**Implementation Steps**:
1. Create `services/transaction-monitor.service.ts`
2. Implement polling logic
3. Implement status tracking
4. Implement failure detection
5. Implement retry logic
6. Test transaction monitoring

**Estimated Effort**: 3 hours

---

## Phase 7: Fee Management

### Task 7.1: Implement Fee Calculation
**Requirement Reference**: Requirement 6 (Fee Distribution)
**Description**: Create service to calculate relayer fees.
**Acceptance Criteria**:
- Gas cost calculated
- Relayer margin added
- Fee limits enforced
- Fee deducted from transfer

**Implementation Steps**:
1. Create `services/x402-fee-calculator.service.ts`
2. Implement gas cost calculation
3. Implement margin calculation
4. Implement fee limits
5. Implement fee deduction
6. Test fee calculation

**Estimated Effort**: 2 hours

---

### Task 7.2: Implement Fee Distribution
**Requirement Reference**: Requirement 6 (Fee Distribution)
**Description**: Create service to distribute fees to relayer.
**Acceptance Criteria**:
- Fees transferred to relayer
- Fee distribution logged
- Audit trail maintained

**Implementation Steps**:
1. Create `services/fee-distributor.service.ts`
2. Implement fee transfer logic
3. Implement distribution logging
4. Implement audit trail
5. Test fee distribution

**Estimated Effort**: 2 hours

---

## Phase 8: Error Handling & Recovery

### Task 8.1: Implement Error Handling
**Requirement Reference**: Requirement 7 (Error Handling)
**Description**: Create comprehensive error handling for x402 operations.
**Acceptance Criteria**:
- Specific error messages for each failure
- Error codes defined
- Recovery options provided
- Clear user guidance

**Implementation Steps**:
1. Create `services/x402-error-handler.service.ts`
2. Define error codes and messages
3. Implement error mapping
4. Implement recovery options
5. Test error handling

**Estimated Effort**: 2 hours

---

### Task 8.2: Implement Recovery Flows
**Requirement Reference**: Requirement 7 (Error Handling)
**Description**: Create recovery flows for failed authorizations.
**Acceptance Criteria**:
- Failed authorizations can be retried
- Nonce conflicts handled
- Clear recovery instructions

**Implementation Steps**:
1. Create `services/x402-recovery.service.ts`
2. Implement retry logic
3. Implement nonce conflict handling
4. Implement recovery instructions
5. Test recovery flows

**Estimated Effort**: 2 hours

---

## Phase 9: Monitoring & Audit

### Task 9.1: Implement Audit Logging
**Requirement Reference**: Requirement 8 (Monitoring & Audit)
**Description**: Create comprehensive audit logging for x402 operations.
**Acceptance Criteria**:
- All authorizations logged
- All submissions logged
- All executions logged
- All failures logged
- Audit trail queryable

**Implementation Steps**:
1. Create `services/x402-audit-logger.service.ts`
2. Log authorization creation
3. Log signature submission
4. Log relayer submission
5. Log on-chain execution
6. Log failures
7. Test audit logging

**Estimated Effort**: 2 hours

---

### Task 9.2: Implement Anomaly Detection
**Requirement Reference**: Requirement 8 (Monitoring & Audit)
**Description**: Create service to detect suspicious patterns.
**Acceptance Criteria**:
- Rapid authorization creation detected
- Unusual amounts detected
- Unusual recipients detected
- Alerts generated

**Implementation Steps**:
1. Create `services/anomaly-detector.service.ts`
2. Implement rapid creation detection
3. Implement unusual amount detection
4. Implement unusual recipient detection
5. Implement alert generation
6. Test anomaly detection

**Estimated Effort**: 3 hours

---

## Phase 10: Multi-Chain Support

### Task 10.1: Implement Multi-Chain Domain Separator
**Requirement Reference**: Requirement 9 (Multi-Chain Support)
**Description**: Create support for multiple chains with correct domain separators.
**Acceptance Criteria**:
- Ethereum Mainnet supported
- Polygon supported
- Arbitrum supported
- Optimism supported
- Base supported
- Cross-chain reuse prevented

**Implementation Steps**:
1. Create `services/multichain-domain.service.ts`
2. Implement domain separator per chain
3. Implement chain ID validation
4. Implement cross-chain prevention
5. Test multi-chain support

**Estimated Effort**: 2 hours

---

### Task 10.2: Implement Chain-Specific Configuration
**Requirement Reference**: Requirement 9 (Multi-Chain Support)
**Description**: Create configuration for each supported chain.
**Acceptance Criteria**:
- RPC endpoints configured
- Token addresses configured
- Contract addresses configured
- Gas prices configured

**Implementation Steps**:
1. Create `config/chains.config.ts`
2. Configure Ethereum Mainnet
3. Configure Polygon
4. Configure Arbitrum
5. Configure Optimism
6. Configure Base
7. Test chain configuration

**Estimated Effort**: 2 hours

---

## Phase 11: Agent Link API Integration

### Task 11.1: Implement Agent Authorization Support
**Requirement Reference**: Requirement 10 (Agent Link API Integration)
**Description**: Create support for Agent-specific authorizations.
**Acceptance Criteria**:
- Agents can create authorizations
- Agent-specific fee structures supported
- Agent budget tracking
- Agent accounting

**Implementation Steps**:
1. Create `services/agent-x402.service.ts`
2. Implement agent authorization creation
3. Implement agent fee structures
4. Implement budget tracking
5. Implement agent accounting
6. Test agent integration

**Estimated Effort**: 3 hours

---

### Task 11.2: Implement Agent Payment Tracking
**Requirement Reference**: Requirement 10 (Agent Link API Integration)
**Description**: Create tracking for Agent payments.
**Acceptance Criteria**:
- Agent payments tracked separately
- Agent budget updated
- Agent accounting logged
- Agent reports generated

**Implementation Steps**:
1. Create `services/agent-payment-tracker.service.ts`
2. Implement payment tracking
3. Implement budget updates
4. Implement accounting logging
5. Implement report generation
6. Test agent tracking

**Estimated Effort**: 2 hours

---

## Phase 12: Testing & Deployment

### Task 12.1: Create Integration Tests
**Requirement Reference**: All requirements
**Description**: Create comprehensive integration tests for x402 protocol.
**Acceptance Criteria**:
- Happy path tested end-to-end
- Error scenarios tested
- Recovery flows tested
- All correctness properties verified

**Implementation Steps**:
1. Create test suite for authorization generation
2. Create test suite for signature verification
3. Create test suite for nonce management
4. Create test suite for relayer submission
5. Create test suite for on-chain verification
6. Create test suite for error handling
7. Run all tests and verify passing

**Estimated Effort**: 8 hours

---

### Task 12.2: Deploy to Staging
**Requirement Reference**: All requirements
**Description**: Deploy x402 protocol to staging environment.
**Acceptance Criteria**:
- All endpoints working in staging
- Database migrations applied
- Relayer configured
- Monitoring enabled

**Implementation Steps**:
1. Prepare staging environment
2. Run database migrations
3. Configure environment variables
4. Configure relayer
5. Deploy code to staging
6. Verify all endpoints
7. Test with sample authorizations
8. Enable monitoring

**Estimated Effort**: 3 hours

---

### Task 12.3: Create User Documentation
**Requirement Reference**: All requirements
**Description**: Create documentation for x402 protocol.
**Acceptance Criteria**:
- User guide created
- API documentation created
- Error codes documented
- Integration guide created

**Implementation Steps**:
1. Create user guide for x402
2. Create API documentation
3. Document error codes
4. Create integration guide
5. Create troubleshooting guide
6. Add to project README

**Estimated Effort**: 2 hours

---

## Summary

**Total Estimated Effort**: 75 hours

**Phase Breakdown**:
- Phase 1 (Infrastructure): 8 hours
- Phase 2 (Nonce Management): 5 hours
- Phase 3 (Signature): 5 hours
- Phase 4 (Validity Window): 4 hours
- Phase 5 (API Endpoints): 10 hours
- Phase 6 (On-Chain Verification): 6 hours
- Phase 7 (Fee Management): 4 hours
- Phase 8 (Error Handling): 4 hours
- Phase 9 (Monitoring & Audit): 5 hours
- Phase 10 (Multi-Chain): 4 hours
- Phase 11 (Agent Integration): 5 hours
- Phase 12 (Testing & Deployment): 13 hours

**Recommended Timeline**: 3-4 weeks with 1 developer working full-time
