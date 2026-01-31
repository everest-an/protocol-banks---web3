# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Protocol Banks is an enterprise-grade crypto payment infrastructure providing non-custodial, multi-chain payment solutions with advanced security features including Shamir Secret Sharing, hardware wallet support, and multi-signature workflows.

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), TypeScript 5, Tailwind CSS v4, shadcn/ui
- **Backend Services:** Go microservices (gRPC), Next.js API routes
- **Web3:** viem, ethers.js, Reown AppKit, Safe Protocol
- **Database:** Supabase (PostgreSQL with RLS)
- **Infrastructure:** Docker, Kubernetes, Redis, Prometheus + Grafana

## Common Commands

### Next.js Development
\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
\`\`\`

### Go Services Development
\`\`\`bash
# Navigate to services directory first
cd services

# Generate protobuf code (Go and TypeScript)
make proto

# Build all Go services (payout-engine, event-indexer, webhook-handler)
make build

# Run unit tests
make test-unit

# Run integration tests (requires Docker)
make test-integration

# Run all tests
make test

# Lint Go code
make lint

# Build Docker images
make docker-build

# Run services locally with docker-compose
make run

# Stop local services
make stop

# View logs
make logs

# Generate coverage report
make coverage

# Clean build artifacts
make clean

# Install dependencies
make deps

# Tidy dependencies
make tidy
\`\`\`

### Running a Single Test
\`\`\`bash
# Next.js/TypeScript tests
npm test -- path/to/test-file.test.ts

# Go service tests
cd services/payout-engine && go test -v ./internal/processor
\`\`\`

## Architecture

### Dual Authentication System

**1. Reown AppKit (Simple, Consumer-Focused)**
- Email/social login with embedded wallets
- Supports 300+ wallet connectors (MetaMask, Coinbase Wallet, etc.)
- Built-in fiat on-ramp (buy crypto with credit card)
- Configured in `lib/reown-config.ts`

**2. Custom Non-Custodial Auth (Enterprise, Advanced)**
- Shamir Secret Sharing (2-of-3 threshold) for private key management
  - Share A: Device (IndexedDB, encrypted)
  - Share B: Server (Supabase, PIN-encrypted)
  - Share C: User recovery code
- Magic link email authentication
- Google/Apple OAuth support
- PIN-derived encryption (PBKDF2, 100k iterations, AES-256-GCM)
- Zero-knowledge architecture (server cannot reconstruct keys alone)
- Files: `lib/auth/*`, `contexts/auth-provider.tsx`, `app/api/auth/*`

### Hybrid TypeScript + Go Architecture

The codebase uses **feature flags** to enable/disable Go microservices:

\`\`\`bash
# Environment variable
ENABLE_GO_SERVICES=true   # Use Go services (high performance)
ENABLE_GO_SERVICES=false  # Fallback to TypeScript implementations
\`\`\`

**Go Services (Production-Grade):**
- `payout-engine`: Concurrent transaction processing (500+ TPS)
- `event-indexer`: Multi-chain blockchain event monitoring
- `webhook-handler`: Rain Card / Transak integration
- Communication: gRPC (proto definitions in `services/proto/`)
- Queue management: Redis-based with distributed nonce locking
- Deployment: Kubernetes (`k8s/` directory)

**TypeScript Services (Fallback):**
- Located in `services/*.service.ts`
- Same functionality as Go services but lower throughput
- Automatically used when Go services fail or are disabled

**gRPC Bridge:**
- Next.js ↔ Go services communication via `lib/grpc/`
- Proto files: `services/proto/*.proto`
- TypeScript clients auto-generated from protos

### Core Payment Features

**Batch Payments:**
- Excel/CSV import with automatic field detection (`lib/excel-parser.ts`)
- Address validation (ENS, checksum)
- Concurrent processing via Go payout-engine
- Progress tracking, retry mechanism
- Optional multi-signature approval flow
- Files: `app/batch-payment/`, `services/payout-engine/`

**Multi-Signature Wallets:**
- Safe (Gnosis Safe) protocol integration (`lib/multisig.ts`)
- Configurable threshold (2-of-3, 3-of-5, etc.)
- Role-based signing workflows
- Transaction proposals with mobile approval
- Audit trail in Supabase

**Cross-Chain Operations:**
- Swap: Rango Exchange integration (`lib/rango.ts`) - 50+ chains, 100+ DEXs
- Bridge: ZetaChain omnichain messaging (`lib/zetachain.ts`)
- Multi-chain support: Ethereum, Polygon, Arbitrum, Base, Optimism, BSC

### Security Architecture

**Multi-Layer Protection:**
- Rate limiting (per-user and global) via `lib/security-middleware.ts`
- CSRF tokens, SQL injection prevention, XSS protection
- Replay attack prevention, signature verification (HMAC-SHA256)
- Row-Level Security (RLS) in Supabase for data isolation
- Attack monitoring: `lib/security-monitor.ts`, `lib/advanced-attack-protection.ts`

**Secrets Management:**
- Production: HashiCorp Vault integration
- Encrypted storage at rest (AES-256-GCM)
- API keys management: `lib/api-keys.ts`

**Monitoring:**
- Prometheus metrics (transaction counts, queue depth, error rates)
- Grafana dashboards (`k8s/monitoring/grafana-dashboard.json`)
- Critical alerts: PayoutHighErrorRate, IndexerBlockLag, ServiceDown
- Health checks: `/api/health`, `/api/status`

### File Structure Patterns

\`\`\`
app/                          # Next.js App Router pages
├── [feature]/page.tsx        # Feature pages
├── api/[feature]/route.ts    # API routes
└── layout.tsx                # Root layout

components/                   # React components
├── ui/                       # shadcn/ui components
└── auth/                     # Auth-specific components

lib/                          # Core business logic
├── auth/                     # Authentication (Shamir, crypto, sessions)
├── grpc/                     # gRPC client bridges
├── supabase/                 # Database clients
├── *.service.ts              # TypeScript services (fallback)
└── *-security.ts             # Security modules

services/                     # Go microservices
├── proto/                    # gRPC proto definitions
├── payout-engine/            # Payment processing service
├── event-indexer/            # Blockchain indexer
├── webhook-handler/          # Webhook integration
└── shared/                   # Shared Go utilities

contexts/                     # React contexts
k8s/                          # Kubernetes manifests
docs/                         # Documentation
\`\`\`

## Key Integration Points

**Reown Configuration:**
- Set `NEXT_PUBLIC_REOWN_PROJECT_ID` in environment variables
- Features controlled via Reown dashboard (not code)
- Console notice "local configuration was ignored" is expected behavior

**Supabase Setup:**
- All tables use Row-Level Security (RLS)
- Client initialization: `lib/supabase/` (client/server variants)
- Schema tables: `auth_users`, `embedded_wallets`, `magic_links`, `auth_sessions`, `transactions`, `audit_logs`

**Payment Flow:**
1. User initiates payment via UI
2. Transaction validated (address, amount, nonce)
3. Optional: Multi-sig approval workflow
4. Go payout-engine processes (or TS fallback)
5. Event-indexer monitors blockchain confirmation
6. Audit log created in Supabase
7. User notification (email via Resend, push via PWA)

## Testing Strategy

**Unit Tests:**
- Jest for TypeScript (`lib/__tests__/`)
- Go testing framework for services (`services/*/internal/*_test.go`)
- Run before commits

**Integration Tests:**
- Docker Compose test environment (`services/docker-compose.test.yml`)
- Tests in `services/*/tests/integration/`
- Tag: `-tags=integration`

**Security Tests:**
- Property-based testing with `fast-check`
- SQL injection, XSS, CSRF validation tests
- Rate limiting verification

## Important Notes

**TypeScript Paths:**
- Use `@/` alias for imports (e.g., `@/lib/auth/crypto`)
- Configured in `tsconfig.json`

**Environment Variables:**
- Next.js: Prefix public vars with `NEXT_PUBLIC_`
- Server-only vars (API keys, secrets) have no prefix
- Set in Vercel dashboard or `.env.local` (never commit `.env`)

**Proto Changes:**
- After editing `services/proto/*.proto`, run `make proto`
- Generates Go code in `services/*/proto/`
- Generates TypeScript code in `lib/proto/`

**Build Configuration:**
- `next.config.mjs`: ESLint/TypeScript errors ignored during build (fix separately)
- Images are unoptimized (set for flexibility)

**PWA Features:**
- Manifest: `public/manifest.json`
- Service worker: Auto-generated by Next.js
- Install prompts: `components/pwa-install-prompt.tsx`

**Deployment:**
- Next.js: Auto-deploy via Vercel on `main` branch push
- Go services: Deploy to Kubernetes via `kubectl apply -f k8s/`
- Database migrations: Manual via `scripts/*.sql`

## Documentation References

- Product Specification: `docs/PRODUCT_SPECIFICATION.md`
- Auth System Details: `docs/AUTH_SYSTEM.md`
- Go Services Architecture: `docs/GO_SERVICES_ARCHITECTURE.md`
- Security Audit: `docs/SECURITY_AUDIT.md`
- Batch Payment Guide: `docs/BATCH_PAYMENT.md`
- Environment Setup: `ENV_SETUP.md`
- Reown Setup: `REOWN_SETUP.md`
