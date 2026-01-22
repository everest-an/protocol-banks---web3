# Requirements Document

## Introduction

This document defines the requirements for bringing Protocol Banks to production-ready status. Based on the architecture analysis, the platform is approximately 70% complete. This specification covers the missing API routes, service integrations, and security enhancements needed for production deployment.

## Glossary

- **Protocol_Banks**: The enterprise-grade crypto payment infrastructure platform
- **API_Gateway**: The Next.js API routes layer handling HTTP requests
- **Webhook_Service**: The service responsible for delivering event notifications to external endpoints
- **API_Key_Service**: The service managing programmatic access credentials
- **Subscription_Service**: The service handling recurring payment schedules
- **Multisig_Service**: The service managing multi-signature wallet operations
- **Rate_Limiter**: The component enforcing request rate limits per user and globally
- **Health_Monitor**: The component providing system health status
- **Go_Services**: The high-performance Go microservices (payout-engine, event-indexer, webhook-handler)
- **Dashboard**: The main user interface showing balance, vendors, and payment activity
- **Payment_Service**: The service handling payment creation, execution, and tracking
- **Vendor_Service**: The service managing vendor/contact entities and their relationships
- **Analytics_Service**: The service providing aggregated payment data and metrics
- **Notification_Service**: The service handling push notifications and user alerts

## Requirements

### Requirement 1: API Key Management Endpoints

**User Story:** As a developer, I want to manage API keys programmatically, so that I can integrate Protocol Banks into my applications securely.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/api/settings/api-keys` with valid authentication, THE API_Gateway SHALL create a new API key and return the secret key (shown only once)
2. WHEN a user sends a GET request to `/api/settings/api-keys` with valid authentication, THE API_Gateway SHALL return all API keys owned by the authenticated user (without secret keys)
3. WHEN a user sends a DELETE request to `/api/settings/api-keys/[id]` with valid authentication, THE API_Gateway SHALL revoke the specified API key
4. WHEN a user attempts to access API key endpoints without authentication, THE API_Gateway SHALL return a 401 Unauthorized response
5. WHEN an API key is created, THE API_Key_Service SHALL hash the secret key using SHA-256 before storage
6. WHEN validating an API key, THE API_Key_Service SHALL check expiration date and active status
7. FOR ALL API key operations, THE API_Gateway SHALL log the action to the audit log

### Requirement 2: Webhook Management Endpoints

**User Story:** As a developer, I want to configure webhooks to receive real-time notifications, so that I can react to payment events in my systems.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/api/webhooks` with valid authentication, THE API_Gateway SHALL create a new webhook and return the signing secret (shown only once)
2. WHEN a user sends a GET request to `/api/webhooks` with valid authentication, THE API_Gateway SHALL return all webhooks owned by the authenticated user
3. WHEN a user sends a PUT request to `/api/webhooks/[id]` with valid authentication, THE API_Gateway SHALL update the webhook configuration
4. WHEN a user sends a DELETE request to `/api/webhooks/[id]` with valid authentication, THE API_Gateway SHALL delete the webhook and all associated delivery records
5. WHEN a user sends a GET request to `/api/webhooks/[id]/deliveries`, THE API_Gateway SHALL return recent delivery attempts for that webhook
6. WHEN a webhook event is triggered, THE Webhook_Service SHALL sign the payload using HMAC-SHA256 with the webhook secret
7. IF a webhook delivery fails, THEN THE Webhook_Service SHALL retry up to 3 times with exponential backoff
8. FOR ALL webhook deliveries, THE Webhook_Service SHALL include `X-Webhook-Signature`, `X-Webhook-Event`, and `X-Webhook-Timestamp` headers

### Requirement 3: Subscription Management Endpoints

**User Story:** As a user, I want to manage recurring payments, so that I can automate regular payments to vendors and services.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/api/subscriptions` with valid authentication, THE API_Gateway SHALL create a new subscription with the specified frequency and amount
2. WHEN a user sends a GET request to `/api/subscriptions` with valid authentication, THE API_Gateway SHALL return all subscriptions owned by the authenticated user
3. WHEN a user sends a PUT request to `/api/subscriptions/[id]` with valid authentication, THE API_Gateway SHALL update the subscription (amount, frequency, status)
4. WHEN a user sends a DELETE request to `/api/subscriptions/[id]` with valid authentication, THE API_Gateway SHALL cancel the subscription
5. WHEN a subscription is created, THE Subscription_Service SHALL calculate and store the next payment date
6. WHEN a subscription status is changed to "paused", THE Subscription_Service SHALL skip scheduled payments until resumed
7. WHEN a subscription payment is due, THE Subscription_Service SHALL validate sufficient balance before execution
8. IF a subscription payment fails due to insufficient balance, THEN THE Subscription_Service SHALL notify the user and retry after 24 hours

### Requirement 4: Health Check and Status Endpoints

**User Story:** As a system administrator, I want to monitor system health, so that I can ensure the platform is operating correctly.

#### Acceptance Criteria

1. WHEN a request is sent to `/api/health`, THE Health_Monitor SHALL return the overall system health status
2. WHEN the system is healthy, THE Health_Monitor SHALL return status "ok" with HTTP 200
3. WHEN any critical component is unhealthy, THE Health_Monitor SHALL return status "degraded" or "unhealthy" with appropriate HTTP status
4. THE Health_Monitor SHALL check database connectivity, Redis connectivity, and Go service availability
5. WHEN a request is sent to `/api/status`, THE Health_Monitor SHALL return detailed component status including version information
6. THE Health_Monitor SHALL respond within 5 seconds or return a timeout error

### Requirement 5: Per-User Rate Limiting [DEFERRED]

**Status:** Deferred - Not included in current implementation plan

**User Story:** As a platform operator, I want to enforce per-user rate limits, so that no single user can exhaust system resources.

#### Acceptance Criteria

1. WHEN a user exceeds their per-minute rate limit, THE Rate_Limiter SHALL return HTTP 429 with a `Retry-After` header
2. WHEN a user exceeds their per-day rate limit, THE Rate_Limiter SHALL return HTTP 429 with remaining time until reset
3. THE Rate_Limiter SHALL track request counts per user using Redis with atomic operations
4. WHEN an API key is used, THE Rate_Limiter SHALL apply the rate limits configured for that specific key
5. THE Rate_Limiter SHALL include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers in all responses
6. IF Redis is unavailable, THEN THE Rate_Limiter SHALL fall back to in-memory rate limiting with degraded accuracy

### Requirement 6: API Key Authentication Middleware

**User Story:** As a developer, I want to authenticate API requests using API keys, so that I can access Protocol Banks programmatically.

#### Acceptance Criteria

1. WHEN a request includes an `Authorization: Bearer pb_xxx` header, THE API_Gateway SHALL validate the API key
2. WHEN an API key is valid and active, THE API_Gateway SHALL attach the owner's address to the request context
3. WHEN an API key is invalid, expired, or revoked, THE API_Gateway SHALL return HTTP 401
4. WHEN an API key lacks required permissions for an endpoint, THE API_Gateway SHALL return HTTP 403
5. FOR ALL API key authenticated requests, THE API_Key_Service SHALL log the usage with endpoint, method, and response time
6. THE API_Gateway SHALL support both API key authentication and session-based authentication

### Requirement 7: Webhook Event Triggering

**User Story:** As a developer, I want to receive webhook notifications for payment events, so that I can update my systems in real-time.

#### Acceptance Criteria

1. WHEN a payment is created, THE Webhook_Service SHALL trigger `payment.created` event to all subscribed webhooks
2. WHEN a payment is completed, THE Webhook_Service SHALL trigger `payment.completed` event with transaction hash
3. WHEN a payment fails, THE Webhook_Service SHALL trigger `payment.failed` event with error details
4. WHEN a batch payment is created, THE Webhook_Service SHALL trigger `batch_payment.created` event
5. WHEN a batch payment completes, THE Webhook_Service SHALL trigger `batch_payment.completed` event with summary
6. WHEN a multisig proposal is created, THE Webhook_Service SHALL trigger `multisig.proposal_created` event
7. WHEN a multisig transaction is executed, THE Webhook_Service SHALL trigger `multisig.executed` event
8. FOR ALL webhook events, THE Webhook_Service SHALL include event type, timestamp, and relevant data in the payload

### Requirement 8: Go Services Integration Bridge

**User Story:** As a platform operator, I want the system to use Go services for high-performance operations with TypeScript fallback, so that the platform remains available even if Go services are down.

#### Acceptance Criteria

1. WHEN Go services are enabled and available, THE API_Gateway SHALL route payout requests to the Go payout-engine via gRPC
2. WHEN Go services are unavailable, THE API_Gateway SHALL fall back to TypeScript implementation
3. THE API_Gateway SHALL implement circuit breaker pattern with 5-second timeout and 3 failure threshold
4. WHEN a fallback occurs, THE API_Gateway SHALL log the event with reason and duration
5. THE API_Gateway SHALL expose Go service health status via the `/api/health` endpoint
6. WHEN Go services recover, THE API_Gateway SHALL automatically resume using them within 30 seconds

### Requirement 9: Subscription Execution Engine

**User Story:** As a user, I want my subscriptions to execute automatically on schedule, so that I don't have to manually process recurring payments.

#### Acceptance Criteria

1. THE Subscription_Service SHALL check for due subscriptions every hour
2. WHEN a subscription payment is due, THE Subscription_Service SHALL create a payment transaction
3. WHEN a subscription payment succeeds, THE Subscription_Service SHALL update `last_payment_date` and calculate `next_payment_date`
4. WHEN a subscription payment fails, THE Subscription_Service SHALL update status to "payment_failed" and notify the user
5. THE Subscription_Service SHALL support daily, weekly, monthly, and yearly frequencies
6. WHEN calculating next payment date for monthly subscriptions, THE Subscription_Service SHALL handle month-end edge cases (e.g., Jan 31 → Feb 28)
7. THE Subscription_Service SHALL not execute payments for paused or cancelled subscriptions

### Requirement 10: Multisig Transaction Execution

**User Story:** As a business user, I want confirmed multisig transactions to execute automatically, so that approved payments are processed without manual intervention.

#### Acceptance Criteria

1. WHEN a multisig transaction reaches the required threshold of confirmations, THE Multisig_Service SHALL mark it as "confirmed"
2. WHEN a transaction is confirmed, THE Multisig_Service SHALL attempt to execute it on-chain
3. WHEN execution succeeds, THE Multisig_Service SHALL update status to "executed" and store the transaction hash
4. WHEN execution fails, THE Multisig_Service SHALL update status to "failed" and store the error message
5. THE Multisig_Service SHALL verify all signatures before execution
6. FOR ALL multisig executions, THE Multisig_Service SHALL trigger appropriate webhook events

### Requirement 11: Dashboard Payment Activity Integration

**User Story:** As a user, I want to see recent payment activity on my dashboard, so that I can quickly understand my payment flow without navigating to the history page.

#### Acceptance Criteria

1. WHEN a user views the dashboard, THE Dashboard SHALL display the 5 most recent payments
2. WHEN a payment is associated with a known vendor, THE Dashboard SHALL display the vendor name instead of raw address
3. WHEN a new payment is completed, THE Dashboard SHALL update the activity feed within 30 seconds
4. THE Dashboard SHALL show payment direction (sent/received), amount, token, and timestamp for each activity item
5. WHEN a user clicks on an activity item, THE Dashboard SHALL navigate to the detailed transaction view
6. IF no payments exist, THEN THE Dashboard SHALL display an empty state with a call-to-action

### Requirement 12: Payment-to-Vendor Relationship Mapping

**User Story:** As a user, I want my payments to be automatically linked to my saved vendors, so that I can see payment history per vendor and generate reports.

#### Acceptance Criteria

1. WHEN a payment is created with a `to_address` matching a vendor's `wallet_address`, THE Payment_Service SHALL automatically link the payment to that vendor
2. WHEN viewing a vendor's details, THE Vendor_Service SHALL return the total payment volume and transaction count for that vendor
3. WHEN a user sends a GET request to `/api/vendors/[id]/payments`, THE API_Gateway SHALL return all payments associated with that vendor
4. THE Payment_Service SHALL update vendor statistics (monthly_volume, transaction_count) after each completed payment
5. WHEN a vendor is deleted, THE Payment_Service SHALL preserve payment records but remove the vendor association
6. FOR ALL payment-vendor mappings, THE Payment_Service SHALL match addresses case-insensitively

### Requirement 13: Analytics Data Aggregation Endpoints

**User Story:** As a user, I want to access aggregated analytics data via API, so that I can build custom reports and dashboards.

#### Acceptance Criteria

1. WHEN a user sends a GET request to `/api/analytics/summary`, THE API_Gateway SHALL return total volume, transaction count, and growth metrics
2. WHEN a user sends a GET request to `/api/analytics/monthly`, THE API_Gateway SHALL return monthly aggregated data for the past 12 months
3. WHEN a user sends a GET request to `/api/analytics/by-vendor`, THE API_Gateway SHALL return payment volume grouped by vendor
4. WHEN a user sends a GET request to `/api/analytics/by-chain`, THE API_Gateway SHALL return payment volume grouped by blockchain
5. THE Analytics_Service SHALL cache aggregated data with a 5-minute TTL to improve performance
6. WHEN query parameters `start_date` and `end_date` are provided, THE Analytics_Service SHALL filter data within that date range

### Requirement 14: Real-time Payment Notifications

**User Story:** As a user, I want to receive real-time notifications when payments are sent or received, so that I can stay informed without constantly checking the app.

#### Acceptance Criteria

1. WHEN a payment is completed, THE Notification_Service SHALL send a push notification to the recipient (if subscribed)
2. WHEN a payment is completed, THE Notification_Service SHALL send a push notification to the sender confirming the transaction
3. WHEN a subscription payment is executed, THE Notification_Service SHALL notify the user 24 hours before and after execution
4. THE Notification_Service SHALL respect user notification preferences stored in the database
5. WHEN a user sends a POST request to `/api/notifications/subscribe`, THE API_Gateway SHALL register the user's push subscription
6. WHEN a user sends a DELETE request to `/api/notifications/unsubscribe`, THE API_Gateway SHALL remove the user's push subscription
