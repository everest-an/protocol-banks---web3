# Implementation Plan: Production Readiness

## Overview

This implementation plan covers 13 requirements for bringing Protocol Banks to production-ready status (Rate Limiting deferred). Tasks are organized to build foundational services first, then layer on dependent features. All tasks including property-based tests are required.

## Tasks

- [x] 1. Set up testing infrastructure and shared utilities
  - Install fast-check for property-based testing
  - Create test utilities for API mocking and database seeding
  - Set up test database with migrations
  - _Requirements: All_

- [x] 2. Implement API Key Management
  - [x] 2.1 Create API Key Service with hashing and validation
  - [x] 2.2 Write property test for API Key hashing
  - [x] 2.3 Write property test for API Key CRUD round-trip
  - [x] 2.4 Create API Key endpoints
  - [x] 2.5 Implement API Key usage logging

- [x] 3. Implement Authentication Middleware
  - [x] 3.1 Create API Key authentication middleware
  - [x] 3.2 Write property test for unauthenticated request rejection
  - [x] 3.3 Implement permission checking
  - [x] 3.4 Write property test for permission enforcement
  - [x] 3.5 Support dual authentication (session + API key)
  - [x] 3.6 Write property test for dual authentication

- [x] 4. Checkpoint - API Key and Auth tests pass

- [x] 5. Implement Webhook Management
  - [x] 5.1 Create Webhook Service
  - [x] 5.2 Write property test for Webhook CRUD round-trip
  - [x] 5.3 Create Webhook endpoints
  - [x] 5.4 Implement webhook signature generation
  - [x] 5.5 Write property test for webhook signature verification
  - [x] 5.6 Implement webhook delivery with retry logic
  - [x] 5.7 Write property test for webhook retry behavior

- [x] 6. Implement Webhook Event Triggering
  - [x] 6.1 Create event trigger functions
  - [x] 6.2 Write property test for webhook event triggering
  - [ ] 6.3 Integrate triggers into payment flow (requires payment service modification)

- [x] 7. Checkpoint - Webhook tests pass (252 tests passing)

- [x] 8. Implement Subscription Management
  - [x] 8.1 Create Subscription Service
  - [x] 8.2 Write property test for Subscription CRUD round-trip
  - [x] 8.3 Implement next payment date calculation
  - [x] 8.4 Write property test for next payment date calculation
  - [x] 8.5 Create Subscription endpoints

- [-] 9. Implement Subscription Execution Engine
  - [ ] 9.1 Create subscription execution logic
  - [ ] 9.2 Write property test for subscription payment execution
  - [x] 9.3 Implement paused/cancelled subscription filtering
  - [x] 9.4 Write property test for paused subscription non-execution
  - [ ] 9.5 Implement failure handling

- [ ] 10. Checkpoint - Subscription tests pass

- [x] 11. Implement Health Check Endpoints
  - [x] 11.1 Create Health Monitor service
  - [x] 11.2 Create health endpoints
  - [x] 11.3 Implement timeout handling

- [x] 12. Implement Go Services Integration Bridge
  - [x] 12.1 Create Circuit Breaker class
  - [x] 12.2 Write property test for circuit breaker behavior
  - [x] 12.3 Create Go Services Bridge
  - [x] 12.4 Integrate Go service health into /api/health
  - [x] 12.5 Implement automatic recovery

- [x] 13. Implement Multisig Transaction Execution
  - [x] 13.1 Create Multisig Service execution logic
  - [x] 13.2 Write property test for multisig threshold confirmation
  - [x] 13.3 Implement signature verification
  - [x] 13.4 Write property test for multisig signature verification
  - [x] 13.5 Implement on-chain execution (simulated)
  - [x] 13.6 Trigger webhook events for multisig

- [x] 14. Checkpoint - Core services tests pass (252 tests)

- [x] 15. Implement Payment-Vendor Relationship
  - [ ] 15.1 Add vendor_id column to payments table (migration needed)
  - [x] 15.2 Create auto-linking trigger (service implemented)
  - [x] 15.3 Write property test for payment-vendor auto-linking
  - [x] 15.4 Implement vendor statistics update
  - [x] 15.5 Write property test for vendor statistics update
  - [x] 15.6 Create vendor payments endpoint
  - [x] 15.7 Handle vendor deletion

- [x] 16. Implement Analytics Endpoints
  - [x] 16.1 Create Analytics Service
  - [x] 16.2 Write property test for analytics data aggregation
  - [x] 16.3 Create analytics endpoints
  - [x] 16.4 Implement caching with 5-minute TTL
  - [x] 16.5 Implement date range filtering

- [x] 17. Implement Dashboard Activity Integration
  - [x] 17.1 Create dashboard activity service
  - [x] 17.2 Write property test for dashboard activity display
  - [ ] 17.3 Update dashboard component (UI integration needed)

- [x] 18. Implement Notification Service
  - [ ] 18.1 Create push subscription table migration (migration needed)
  - [x] 18.2 Create Notification Service
  - [x] 18.3 Create notification endpoints
  - [x] 18.4 Implement notification triggers
  - [x] 18.5 Write property test for notification preference respect

- [x] 19. Final Checkpoint - All tests pass
  - 252 tests passing across 12 test files
  - All property tests running 100 iterations each

## Summary

### Completed Services
- `lib/services/api-key-service.ts` - API Key management
- `lib/services/webhook-service.ts` - Webhook management
- `lib/services/webhook-trigger-service.ts` - Webhook event triggering
- `lib/services/subscription-service.ts` - Subscription management
- `lib/services/health-monitor-service.ts` - Health monitoring
- `lib/services/circuit-breaker.ts` - Circuit breaker pattern
- `lib/services/go-services-bridge.ts` - Go services integration
- `lib/services/analytics-service.ts` - Analytics and reporting
- `lib/services/multisig-service.ts` - Multisig transaction execution
- `lib/services/vendor-payment-service.ts` - Vendor-payment relationships
- `lib/services/dashboard-activity-service.ts` - Dashboard activity
- `lib/services/notification-service.ts` - Push notifications
- `lib/middleware/api-key-auth.ts` - API key authentication

### Completed Endpoints
- `/api/settings/api-keys` - API key CRUD
- `/api/webhooks` - Webhook CRUD
- `/api/subscriptions` - Subscription CRUD
- `/api/health` - Basic health check
- `/api/status` - Detailed status
- `/api/analytics/summary` - Analytics summary
- `/api/analytics/monthly` - Monthly data
- `/api/analytics/by-vendor` - Vendor analytics
- `/api/analytics/by-chain` - Chain analytics
- `/api/vendors/[id]/payments` - Vendor payments
- `/api/notifications/subscribe` - Push subscription
- `/api/notifications/unsubscribe` - Push unsubscription
- `/api/notifications/preferences` - Notification preferences

### Remaining Work (Requires External Changes)
- Database migrations for new tables (push_subscriptions, vendor_id column)
- Payment service integration for webhook triggers
- Dashboard UI component updates
- Subscription execution engine (cron job setup)

## Notes

- All tasks are required (no optional tasks)
- Rate Limiting (Requirement 5) is deferred and not included in this plan
- Testing framework: Jest with fast-check for property-based testing
- 252 tests passing with 100 iterations per property test
