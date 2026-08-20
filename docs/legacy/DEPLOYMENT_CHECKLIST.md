# Protocol Banks — Deployment Checklist

**Version:** v1.0.0-rc
**Date:** 2026-02-08

---

## Pre-Deployment

### 1. Code Quality
- [ ] All 801 tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] Linter passes (`pnpm lint`)
- [ ] No TODO/FIXME left in critical paths
- [ ] Security audit findings (H-1 ~ H-3, M-1 ~ M-6) resolved

### 2. Environment Variables
- [ ] `DATABASE_URL` — PostgreSQL connection string (production)
- [ ] `NEXT_PUBLIC_REOWN_PROJECT_ID` — Reown AppKit project ID
- [ ] `RESEND_API_KEY` — Email notification service
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Push notifications
- [ ] `RANGO_API_KEY` — Cross-chain swap integration
- [ ] `ENABLE_GO_SERVICES` — Set `true` if Go microservices deployed
- [ ] Verify no `.env` file is committed to git

### 3. Database
- [ ] PostgreSQL instance running (production)
- [ ] Run `pnpm prisma db push` to sync schema
- [ ] Run SQL migration scripts (`scripts/*.sql`) for views, functions, triggers
- [ ] Verify with `pnpm prisma studio`
- [ ] Row-Level Security (RLS) policies active
- [ ] Database backups configured

### 4. Infrastructure
- [ ] Vercel project configured (Next.js)
- [ ] DNS records pointed to Vercel
- [ ] SSL/TLS certificates active
- [ ] CDN caching configured
- [ ] Rate limiting enabled at edge (Vercel WAF or Cloudflare)

---

## Go Services (Optional)

### If `ENABLE_GO_SERVICES=true`:
- [ ] Docker images built (`make docker-build`)
- [ ] Kubernetes manifests applied (`kubectl apply -f k8s/`)
- [ ] Redis instance running for queue management
- [ ] gRPC ports open (internal only)
- [ ] Health checks verified (`/api/health`)
- [ ] Prometheus metrics endpoint exposed
- [ ] Grafana dashboards loaded (`k8s/monitoring/grafana-dashboard.json`)

---

## Deployment Steps

### Step 1: Deploy Database Changes
```bash
# Sync Prisma schema
pnpm prisma db push

# Run migration scripts
psql $DATABASE_URL < scripts/009_multi_network_support.sql
```

### Step 2: Deploy Next.js Application
```bash
# Build
pnpm build

# Deploy to Vercel (auto-deploy on main push)
git push origin main
```

### Step 3: Deploy Go Services (if enabled)
```bash
cd services
make docker-build
kubectl apply -f ../k8s/
```

### Step 4: Verify Deployment
```bash
# Health check
curl https://your-domain.com/api/health

# Verify API
curl -H "x-wallet-address: 0x..." https://your-domain.com/api/payments?limit=1
```

---

## Post-Deployment

### Immediate (within 1 hour)
- [ ] Health check endpoint returns 200
- [ ] Landing page loads correctly
- [ ] Dashboard loads for authenticated users
- [ ] Payment flow works end-to-end (testnet)
- [ ] Reconciliation page accessible

### Short-term (within 24 hours)
- [ ] Monitor error rates in logs
- [ ] Run reconciliation against mainnet data
- [ ] Verify Prometheus metrics collection
- [ ] Check Grafana dashboards for anomalies
- [ ] Test email notifications (Resend)
- [ ] Test push notifications (PWA)

### Medium-term (within 1 week)
- [ ] Review analytics data accuracy
- [ ] Check CSV/Excel export formatting
- [ ] Validate multi-network vendor management
- [ ] Test batch payment processing
- [ ] Review rate limiting effectiveness
- [ ] Security scan with OWASP ZAP

---

## Rollback Plan

### If critical issues found:
1. **Revert Vercel deployment** — Use Vercel dashboard to rollback to previous deployment
2. **Revert database** — Restore from backup (schema changes are additive, no data loss)
3. **Revert Go services** — `kubectl rollout undo deployment/payout-engine`

### Rollback triggers:
- Payment processing failures > 5%
- API error rate > 1%
- Database connection failures
- Authentication bypass detected

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps | — |
| Backend Lead | — |
| Frontend Lead | — |
| Security | — |
| Database Admin | — |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Security Lead | | | |
| Product Owner | | | |
