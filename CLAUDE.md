# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Protocol Banks is an enterprise-grade crypto payment infrastructure providing non-custodial, multi-chain payment solutions with advanced security features including Shamir Secret Sharing, hardware wallet support, and multi-signature workflows.

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), TypeScript 5, Tailwind CSS v4, shadcn/ui
- **Backend Services:** Next.js API routes, Go microservices (gRPC, optional)
- **Web3:** viem, ethers.js, Reown AppKit, Safe Protocol
- **Database:** Prisma 7 (Serverless, pg adapter) → PostgreSQL (Supabase with RLS)
- **Infrastructure:** Vercel, Docker, Kubernetes, Redis, Prometheus + Grafana

## Common Commands

### Next.js Development
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests in CI mode
pnpm test:ci

# Generate Prisma client
pnpm prisma generate

# Push schema changes to database
pnpm prisma db push
```

### Go Services Development
```bash
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
```

### Running a Single Test
```bash
# Next.js/TypeScript tests
npm test -- path/to/test-file.test.ts

# Go service tests
cd services/payout-engine && go test -v ./internal/processor
```

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

```bash
# Environment variable
ENABLE_GO_SERVICES=true   # Use Go services (high performance)
ENABLE_GO_SERVICES=false  # Fallback to TypeScript implementations
```

**Go Services (Production-Grade):**
- `payout-engine`: Concurrent transaction processing (500+ TPS)
- `event-indexer`: Multi-chain blockchain event monitoring
- `webhook-handler`: Rain Card / Transak integration
- Communication: gRPC (proto definitions in `services/proto/`)
- Queue management: Redis-based with distributed nonce locking
- Deployment: Kubernetes (`k8s/` directory)

**TypeScript Services (Fallback):**
- Located in `lib/services/*.service.ts`
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
- Files: `app/(products)/batch-payment/`, `services/payout-engine/`

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
- Vendor address change: wallet signature verification + 24h cooldown + email/push notification
- Vendor integrity hash: SHA-256 deterministic hash verified on every read

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

```
app/                              # Next.js App Router
├── page.tsx                      # Marketing landing page (always shown at /)
├── layout.tsx                    # Root layout
├── (products)/                   # Route group with sidebar layout
│   ├── layout.tsx                # Products layout (sidebar + content)
│   ├── dashboard/page.tsx        # User dashboard
│   ├── pay/page.tsx              # Send payment
│   ├── batch-payment/page.tsx    # Batch payments
│   ├── vendors/page.tsx          # Contacts / Wallet tags
│   ├── balances/page.tsx         # Multi-chain balances
│   ├── history/page.tsx          # Transaction history
│   ├── agents/page.tsx           # AI Agent dashboard
│   └── ...                       # Other product pages
├── api/                          # REST API endpoints
│   ├── agents/                   # AI Agent management
│   ├── payments/                 # Payment processing
│   ├── vendors/                  # Vendor CRUD + batch update
│   ├── subscriptions/            # Subscription management
│   ├── webhooks/                 # Webhook delivery
│   ├── invoice/                  # Invoice system
│   ├── x402/                     # x402 protocol
│   └── notifications/            # Email + push notifications
├── admin/                        # Admin panel
└── settings/                     # User settings

components/                       # React components
├── ui/                           # shadcn/ui components
└── auth/                         # Auth-specific components

lib/                              # Core business logic
├── auth/                         # Authentication (Shamir, crypto, sessions)
├── services/                     # TypeScript services (fallback for Go)
├── security/                     # Security middleware + utilities
├── grpc/                         # gRPC client bridges
├── prisma.ts                     # Prisma client (serverless)
└── supabase.ts                   # Supabase client (legacy)

prisma/                           # Prisma ORM
└── schema.prisma                 # Database schema

services/                         # Go microservices (optional)
├── proto/                        # gRPC proto definitions
├── payout-engine/                # Payment processing service
├── event-indexer/                # Blockchain indexer
├── webhook-handler/              # Webhook integration
└── shared/                       # Shared Go utilities

contexts/                         # React contexts
hooks/                            # Custom hooks
k8s/                              # Kubernetes manifests
scripts/                          # SQL migrations
docs/                             # Documentation
```

## Key Integration Points

**Reown Configuration:**
- Set `NEXT_PUBLIC_REOWN_PROJECT_ID` in environment variables
- Features controlled via Reown dashboard (not code)
- Console notice "local configuration was ignored" is expected behavior

**Database (Prisma + Supabase):**

- Primary ORM: Prisma 7 with `@prisma/adapter-pg` (serverless)
- Client: `lib/prisma.ts` (lazy initialization, server-only)
- Schema: `prisma/schema.prisma`
- Legacy Supabase client: `lib/supabase.ts` (still used for some features)
- All tables use Row-Level Security (RLS)
- Key tables: `Vendor`, `Transaction`, `AuditLog`, `PushSubscription`, `Invoice`

**Payment Flow:**
1. User initiates payment via UI
2. Transaction validated (address, amount, nonce)
3. Optional: Multi-sig approval workflow
4. Go payout-engine processes (or TS fallback)
5. Event-indexer monitors blockchain confirmation
6. Audit log created via Prisma
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
