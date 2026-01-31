# Protocol Banks - Product Specification

**Version:** 1.2.0  
**Last Updated:** 2025-01-20  
**Status:** Production Ready

---

## Executive Summary

Protocol Banks is an enterprise-grade crypto payment infrastructure providing non-custodial, multi-chain payment solutions with advanced security features including Shamir Secret Sharing, hardware wallet support, and multi-signature approval workflows.

---

## Core Features

### 1. Authentication System

**Dual Authentication Options:**

**A. Reown AppKit (Email/Social Login & Fiat On-Ramp)**
- Email login (passwordless, no browser extension needed)
- Social logins (Google, Twitter, GitHub, Discord, Apple, Facebook)
- Multi-wallet support (MetaMask, Rainbow, Coinbase Wallet, 300+)
- Built-in fiat on-ramp (credit card/bank purchase)
- Mobile-first (iOS/Android)
- Non-custodial embedded wallets

**B. Custom Non-Custodial Auth (Enterprise)**
- Email Magic Link authentication
- Google OAuth integration
- Shamir Secret Sharing (2-of-3 threshold)
  - Share A: Device (IndexedDB, encrypted)
  - Share B: Server (Supabase, PIN-encrypted)
  - Share C: User recovery code
- Embedded HD wallet creation
- Biometric verification (Face ID/Touch ID)
- Session management with HTTP-only cookies

**Security Architecture:**
- Private keys never leave client in plain text
- PIN-derived encryption (PBKDF2, 100k iterations)
- AES-256-GCM encryption
- Zero-knowledge architecture (server cannot reconstruct keys)

### 2. Payment Engine

**Single Payments**
- Multi-chain support (Ethereum, Polygon, Arbitrum, Base, Optimism, BSC)
- ERC20 token support (USDC, USDT, DAI, WETH)
- Real-time gas estimation
- Transaction simulation
- Nonce management

**Batch Payments**
- Excel/CSV import (.xlsx, .xls, .csv)
- Automatic field detection
- Address validation (ENS, checksum)
- Concurrent processing (Go service: 500+ TPS)
- Progress tracking
- Retry mechanism
- Multi-signature approval optional

**Go Microservices (High-Performance)**
- Payout Engine: Concurrent transaction processing
- Event Indexer: Multi-chain event monitoring
- Webhook Handler: Rain Card / Transak integration
- gRPC communication with Next.js
- Redis-based queue management
- Distributed Nonce locking

### 3. Multi-Signature Wallets

**Features:**
- Safe (Gnosis Safe) protocol integration
- Configurable threshold (2-of-3, 3-of-5, etc.)
- Role-based signing (Finance, CEO, CFO)
- Transaction proposals
- Mobile approval (PWA + push notifications)
- Audit trail

**Workflow:**
\`\`\`
Finance creates payment → CEO approves on mobile → Threshold reached → Execute
\`\`\`

### 4. Cross-Chain Operations

**Swap (Rango Exchange Integration)**
- 50+ blockchain support
- 100+ DEX aggregation
- Best price routing
- Slippage protection
- MEV protection

**Bridge**
- ZetaChain omnichain messaging
- Bitcoin ↔ EVM bridges
- Cross-chain asset transfers

### 5. Subscription Management

- Recurring payments (daily/weekly/monthly)
- Auto-pay from designated wallets
- Pause/resume controls
- Balance monitoring
- Email notifications

### 6. Security & Compliance

**Attack Protection**
- Rate limiting (per-user and global)
- CSRF tokens
- SQL injection prevention
- XSS protection
- Replay attack prevention
- Signature verification (HMAC-SHA256)

**Audit & Monitoring**
- Complete audit logs (Supabase RLS)
- Real-time anomaly detection
- Transaction monitoring
- Failed attempt tracking
- Prometheus metrics
- Grafana dashboards

**Row-Level Security (RLS)**
- User-isolated data access
- Role-based permissions
- Encrypted sensitive data at rest

### 7. Mobile & PWA

**Progressive Web App Features**
- Add to Home Screen prompts (iOS/Android)
- Offline support
- Push notifications
- Service Worker caching
- Mobile-optimized UI

**Mobile-First Design**
- Bottom navigation
- Drawer panels (no overlapping)
- Safe area padding
- Touch-optimized controls
- Responsive typography

**Biometric Authentication**
- WebAuthn integration
- Face ID / Touch ID support
- Platform authenticator API

### 8. Sonic Branding

**Audio Feedback System**
- Personal Mode: Swoosh, Shimmer, Ping
- Business Mode: Thrummm, Mechanical Purr, Heavy Switch
- Volume controls
- User preferences saved

---

## Technical Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.3
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui
- **State Management:** React Context, SWR
- **Web3:** viem, ethers.js, Reown AppKit

### Backend (Next.js API Routes)
- **Auth:** Custom (Shamir Secret Sharing)
- **Sessions:** HTTP-only cookies
- **Email:** Resend
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage

### Go Microservices
- **Language:** Go 1.21
- **RPC:** gRPC
- **Queue:** Redis
- **Crypto:** go-ethereum, ecdsa

### Infrastructure
- **Hosting:** Vercel (Next.js)
- **Database:** Supabase
- **Queue:** Redis (Upstash)
- **Container:** Docker
- **Orchestration:** Kubernetes
- **Monitoring:** Prometheus + Grafana
- **Logging:** Structured logs (JSON)

### Security
- **Secrets Management:** HashiCorp Vault (production)
- **Encryption:** AES-256-GCM, PBKDF2
- **Signatures:** ECDSA, HMAC-SHA256
- **RLS:** Supabase Row-Level Security

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Payment Processing | <3s | 2.1s avg |
| Batch Payment (100 tx) | <60s | 45s |
| API Response Time (p95) | <200ms | 180ms |
| Go Service Throughput | 500+ TPS | 650 TPS |
| Uptime | 99.9% | 99.95% |

---

## Deployment

### Next.js (Vercel)
- Automatic deployment from `main` branch
- Preview deployments for PRs
- Environment variables via Vercel dashboard

### Go Services (Kubernetes)
\`\`\`bash
# Deploy to production
kubectl apply -f k8s/
helm upgrade --install protocol-banks ./helm-chart
\`\`\`

### Database Migrations
\`\`\`bash
# Run migrations
psql $DATABASE_URL -f scripts/001-*.sql
\`\`\`

---

## Roadmap

### Q1 2025
- ✅ Custom authentication system
- ✅ Go microservices
- ✅ Mobile PWA optimization
- ⏳ HSM integration
- ⏳ SOC 2 compliance audit

### Q2 2025
- Rain Card full integration
- Fiat on/off ramp (Transak)
- Advanced analytics dashboard
- Multi-language support

---

## Support

**Documentation:** https://github.com/YOUR_ORG/protocol-banks/wiki  
**Issues:** https://github.com/YOUR_ORG/protocol-banks/issues  
**Email:** support@protocolbanks.com

---

**Copyright © 2025 Protocol Banks. All rights reserved.**
