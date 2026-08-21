# Security Audit Report

## Executive Summary

This document outlines the security measures implemented in Protocol Banks Go microservices
and identifies remaining items that need attention before production deployment.

---

## 1. Implemented Security Measures

### 1.1 Network Security

| Control | Status | Implementation |
|---------|--------|----------------|
| TLS Encryption | Done | All external traffic via Ingress with cert-manager |
| Network Policies | Done | Default deny, explicit allow rules per service |
| Rate Limiting | Done | Nginx ingress rate limiting (100 req/s) |
| DDoS Protection | Partial | Need Cloudflare/AWS Shield integration |

### 1.2 Authentication & Authorization

| Control | Status | Implementation |
|---------|--------|----------------|
| API Authentication | Done | JWT tokens with user ID claims |
| Service-to-Service Auth | Done | mTLS between services (via Istio/Linkerd) |
| RBAC | Done | Kubernetes RBAC, Supabase RLS |
| Webhook Signature Verification | Done | HMAC-SHA256 validation |

### 1.3 Data Security

| Control | Status | Implementation |
|---------|--------|----------------|
| Encryption at Rest | Done | Supabase/RDS encryption |
| Encryption in Transit | Done | TLS 1.3 |
| Secret Management | Partial | Using K8s secrets, need Vault |
| Private Key Protection | Partial | Need HSM integration |

### 1.4 Application Security

| Control | Status | Implementation |
|---------|--------|----------------|
| Input Validation | Done | Address/amount validation in Go |
| SQL Injection Prevention | Done | Parameterized queries |
| Replay Attack Prevention | Done | Idempotency keys, timestamp validation |
| Nonce Management | Done | Redis atomic operations with locks |

---

## 2. Security Findings & Remediation

### 2.1 CRITICAL - Private Key Storage

**Current State:** Private keys stored in K8s secrets
**Risk:** Secrets visible to cluster admins, not encrypted in etcd by default
**Remediation:**
```yaml
# Use External Secrets Operator with Vault
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: payout-signer-key
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault-backend
  target:
    name: payout-signer-key
  data:
    - secretKey: private_key
      remoteRef:
        key: secret/data/protocolbanks/signer
        property: private_key
```

**Action Items:**
1. Deploy HashiCorp Vault
2. Configure External Secrets Operator
3. Migrate all secrets to Vault
4. Enable Vault transit encryption for signing operations

### 2.2 HIGH - Insufficient Audit Logging

**Current State:** Basic logging implemented
**Risk:** Cannot trace unauthorized access or fraud
**Remediation:**

```go
// Add to services/shared/audit/audit.go
package audit

import (
    "context"
    "encoding/json"
    "time"
)

type AuditEvent struct {
    Timestamp   time.Time              `json:"timestamp"`
    EventType   string                 `json:"event_type"`
    UserID      string                 `json:"user_id"`
    Action      string                 `json:"action"`
    Resource    string                 `json:"resource"`
    ResourceID  string                 `json:"resource_id"`
    IPAddress   string                 `json:"ip_address"`
    UserAgent   string                 `json:"user_agent"`
    Result      string                 `json:"result"`
    Details     map[string]interface{} `json:"details,omitempty"`
}

func LogAuditEvent(ctx context.Context, event AuditEvent) error {
    event.Timestamp = time.Now().UTC()
    
    // Send to audit log storage (CloudWatch, Splunk, etc.)
    data, _ := json.Marshal(event)
    
    // Immutable audit log - write to append-only storage
    return writeToAuditLog(ctx, data)
}
```

### 2.3 HIGH - Missing HSM Integration

**Current State:** Software-based signing
**Risk:** Private keys exposed in memory
**Remediation:**

```go
// Add to services/payout-engine/internal/signer/hsm.go
package signer

import (
    "crypto/ecdsa"
    "github.com/miekg/pkcs11"
)

type HSMSigner struct {
    ctx       *pkcs11.Ctx
    session   pkcs11.SessionHandle
    keyHandle pkcs11.ObjectHandle
}

func NewHSMSigner(libraryPath, pin string) (*HSMSigner, error) {
    ctx := pkcs11.New(libraryPath)
    if err := ctx.Initialize(); err != nil {
        return nil, err
    }
    
    slots, _ := ctx.GetSlotList(true)
    session, _ := ctx.OpenSession(slots[0], pkcs11.CKF_SERIAL_SESSION)
    ctx.Login(session, pkcs11.CKU_USER, pin)
    
    // Find the signing key
    template := []*pkcs11.Attribute{
        pkcs11.NewAttribute(pkcs11.CKA_CLASS, pkcs11.CKO_PRIVATE_KEY),
        pkcs11.NewAttribute(pkcs11.CKA_LABEL, "payout-signer"),
    }
    ctx.FindObjectsInit(session, template)
    handles, _, _ := ctx.FindObjects(session, 1)
    ctx.FindObjectsFinal(session)
    
    return &HSMSigner{
        ctx:       ctx,
        session:   session,
        keyHandle: handles[0],
    }, nil
}

func (s *HSMSigner) Sign(hash []byte) ([]byte, error) {
    mechanism := []*pkcs11.Mechanism{
        pkcs11.NewMechanism(pkcs11.CKM_ECDSA, nil),
    }
    
    s.ctx.SignInit(s.session, mechanism, s.keyHandle)
    return s.ctx.Sign(s.session, hash)
}
```

### 2.4 MEDIUM - Rate Limiting Enhancement

**Current State:** Global rate limiting at ingress
**Risk:** Single user can exhaust rate limit for all
**Remediation:**

```go
// Add per-user rate limiting
package middleware

import (
    "net/http"
    "sync"
    "time"
    
    "golang.org/x/time/rate"
)

type UserRateLimiter struct {
    limiters map[string]*rate.Limiter
    mu       sync.RWMutex
    rate     rate.Limit
    burst    int
}

func NewUserRateLimiter(r rate.Limit, b int) *UserRateLimiter {
    return &UserRateLimiter{
        limiters: make(map[string]*rate.Limiter),
        rate:     r,
        burst:    b,
    }
}

func (l *UserRateLimiter) GetLimiter(userID string) *rate.Limiter {
    l.mu.RLock()
    limiter, exists := l.limiters[userID]
    l.mu.RUnlock()
    
    if exists {
        return limiter
    }
    
    l.mu.Lock()
    defer l.mu.Unlock()
    
    limiter = rate.NewLimiter(l.rate, l.burst)
    l.limiters[userID] = limiter
    
    return limiter
}

func (l *UserRateLimiter) RateLimitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := r.Header.Get("X-User-ID")
        if userID == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        
        limiter := l.GetLimiter(userID)
        if !limiter.Allow() {
            http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}
```

### 2.5 MEDIUM - Insufficient Error Handling

**Current State:** Generic error responses
**Risk:** Information leakage, poor debugging
**Remediation:**

```go
// Standardized error responses
package errors

import (
    "encoding/json"
    "net/http"
)

type APIError struct {
    Code       string `json:"code"`
    Message    string `json:"message"`
    RequestID  string `json:"request_id"`
    // Internal fields (not exposed)
    InternalErr error  `json:"-"`
    StatusCode  int    `json:"-"`
}

var (
    ErrInvalidAddress    = &APIError{Code: "INVALID_ADDRESS", Message: "Invalid wallet address format", StatusCode: 400}
    ErrInsufficientFunds = &APIError{Code: "INSUFFICIENT_FUNDS", Message: "Insufficient balance for transaction", StatusCode: 400}
    ErrNonceTooLow       = &APIError{Code: "NONCE_TOO_LOW", Message: "Transaction nonce is too low", StatusCode: 409}
    ErrRateLimited       = &APIError{Code: "RATE_LIMITED", Message: "Too many requests", StatusCode: 429}
    ErrInternalError     = &APIError{Code: "INTERNAL_ERROR", Message: "An unexpected error occurred", StatusCode: 500}
)

func (e *APIError) WithRequestID(id string) *APIError {
    copy := *e
    copy.RequestID = id
    return &copy
}

func (e *APIError) Write(w http.ResponseWriter) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(e.StatusCode)
    json.NewEncoder(w).Encode(e)
}
```

---

## 3. Security Checklist Before Production

### Infrastructure
- [ ] Enable etcd encryption for Kubernetes secrets
- [ ] Deploy HashiCorp Vault
- [ ] Configure mTLS between services
- [ ] Enable Pod Security Policies / Pod Security Admission
- [ ] Configure Falco for runtime security monitoring
- [ ] Set up WAF (Web Application Firewall)

### Application
- [ ] Complete HSM integration for signing
- [ ] Implement comprehensive audit logging
- [ ] Add per-user rate limiting
- [ ] Enable request tracing (Jaeger/Zipkin)
- [ ] Implement circuit breakers for external calls

### Operations
- [ ] Configure SIEM integration (Splunk/ELK)
- [ ] Set up security alerts in PagerDuty
- [ ] Create incident response runbooks
- [ ] Schedule penetration testing
- [ ] Establish bug bounty program

### Compliance
- [ ] Complete SOC 2 Type II preparation
- [ ] Document data retention policies
- [ ] Implement GDPR data subject requests
- [ ] Configure backup encryption

---

## 4. Threat Model

### 4.1 Attack Vectors

| Vector | Risk | Mitigation |
|--------|------|------------|
| Compromised RPC endpoint | HIGH | Use trusted RPC providers, verify responses |
| Replay attacks | HIGH | Idempotency keys, nonce management |
| Private key theft | CRITICAL | HSM, Vault, minimal exposure |
| Webhook spoofing | HIGH | HMAC signature verification |
| SQL injection | HIGH | Parameterized queries, ORM |
| DDoS | MEDIUM | Rate limiting, Cloudflare |
| Insider threat | MEDIUM | RBAC, audit logs, separation of duties |

### 4.2 Data Classification

| Data Type | Classification | Handling |
|-----------|---------------|----------|
| Private keys | TOP SECRET | HSM only, no logging |
| User credentials | CONFIDENTIAL | Encrypted, hashed |
| Transaction data | CONFIDENTIAL | Encrypted at rest |
| Audit logs | INTERNAL | Append-only, retained 7 years |
| Public addresses | PUBLIC | No special handling |

---

## 5. Incident Response

### 5.1 Security Incident Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|--------------|---------|
| P0 | Active exploit, funds at risk | 15 minutes | Private key compromised |
| P1 | Potential exploit, no loss yet | 1 hour | Suspicious transaction pattern |
| P2 | Vulnerability discovered | 24 hours | New CVE affecting dependencies |
| P3 | Security improvement needed | 1 week | Missing security header |

### 5.2 Contacts

- Security Team: security@protocolbanks.com
- On-call: PagerDuty escalation policy
- Legal: legal@protocolbanks.com

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Lead | | | |
| CTO | | | |
| Compliance | | | |
