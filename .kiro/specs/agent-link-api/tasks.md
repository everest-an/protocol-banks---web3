# Implementation Plan: Agent Link API

## Overview

This implementation plan covers the Agent Link API feature, enabling AI agents to interact with Protocol Banks. Tasks are organized to build foundational services first (Agent Service, Budget Service), then layer on dependent features (Proposals, Auto-Execute, Webhooks). All tasks including property-based tests are required.

## Tasks

- [x] 1. Set up database schema and migrations
  - Create agents table with RLS policies
  - Create agent_budgets table with RLS policies
  - Create payment_proposals table with RLS policies
  - Create agent_webhook_deliveries table with RLS policies
  - Create agent_activities table with RLS policies
  - Create indexes for performance
  - _Requirements: All_

- [x] 2. Implement Agent Service
  - [x] 2.1 Create Agent Service with CRUD operations
    - Implement create, list, get, update, deactivate methods
    - Generate agent API keys with `agent_` prefix
    - Hash API keys using SHA-256
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Write property test for Agent CRUD round-trip
    - **Property 1: Agent CRUD Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 2.3 Write property test for Agent API Key format
    - **Property 2: Agent API Key Format**
    - **Validates: Requirements 1.5**

  - [x] 2.4 Implement Agent validation method
    - Validate API key against hash
    - Check agent status (active/paused/deactivated)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.5 Implement pauseAll and resumeAll methods
    - Pause/resume all agents for an owner
    - _Requirements: 5.6_

- [x] 3. Implement Agent Authentication Middleware
  - [x] 3.1 Create agent-auth middleware
    - Parse `Authorization: Bearer agent_xxx` header
    - Validate agent API key
    - Attach agent context to request
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Write property test for Agent Authentication
    - **Property 7: Agent Authentication Validation**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 3.3 Implement rate limiting for agents
    - Per-agent rate limiting
    - _Requirements: 3.6_

  - [x] 3.4 Write property test for Agent Permission Enforcement
    - **Property 8: Agent Permission Enforcement**
    - **Validates: Requirements 3.4, 3.6**

- [x] 4. Create Agent API Endpoints
  - [x] 4.1 Create POST /api/agents endpoint
    - Create new agent with API key
    - _Requirements: 1.1_

  - [x] 4.2 Create GET /api/agents endpoint
    - List all agents for owner
    - _Requirements: 1.2_

  - [x] 4.3 Create GET /api/agents/[id] endpoint
    - Get agent details
    - _Requirements: 1.2_

  - [x] 4.4 Create PUT /api/agents/[id] endpoint
    - Update agent configuration
    - _Requirements: 1.3_

  - [x] 4.5 Create DELETE /api/agents/[id] endpoint
    - Deactivate agent
    - _Requirements: 1.4_

  - [x] 4.6 Create POST /api/agents/pause-all endpoint
    - Emergency pause all agents
    - _Requirements: 5.6_

  - [x] 4.7 Create POST /api/agents/resume-all endpoint
    - Resume all agents
    - _Requirements: 5.6_

- [x] 5. Checkpoint - Agent Service tests pass

- [x] 6. Implement Budget Service
  - [x] 6.1 Create Budget Service with CRUD operations
    - Implement create, list, get, update, delete methods
    - Track used_amount and remaining_amount
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 6.2 Write property test for Budget CRUD round-trip
    - **Property 3: Budget CRUD Round-Trip**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**

  - [x] 6.3 Write property test for Budget Validation
    - **Property 4: Budget Validation**
    - **Validates: Requirements 2.2**

  - [x] 6.4 Implement budget availability checking
    - Check if agent has sufficient budget
    - _Requirements: 2.6_

  - [x] 6.5 Implement budget deduction
    - Deduct amount from budget after payment
    - _Requirements: 2.6_

  - [x] 6.6 Write property test for Budget Tracking Accuracy
    - **Property 5: Budget Tracking Accuracy**
    - **Validates: Requirements 2.6**

  - [x] 6.7 Implement budget period reset
    - Reset daily/weekly/monthly budgets
    - _Requirements: 2.7_

  - [x] 6.8 Write property test for Budget Period Reset
    - **Property 6: Budget Period Reset**
    - **Validates: Requirements 2.7**

- [x] 7. Create Budget API Endpoints
  - [x] 7.1 Create POST /api/agents/[id]/budgets endpoint
    - Create budget for agent
    - _Requirements: 2.1_

  - [x] 7.2 Create GET /api/agents/[id]/budgets endpoint
    - List budgets for agent
    - _Requirements: 2.3_

  - [x] 7.3 Create PUT /api/agents/[id]/budgets/[budgetId] endpoint
    - Update budget
    - _Requirements: 2.4_

  - [x] 7.4 Create DELETE /api/agents/[id]/budgets/[budgetId] endpoint
    - Delete budget
    - _Requirements: 2.5_

  - [x] 7.5 Create GET /api/agents/[id]/utilization endpoint
    - Get budget utilization
    - _Requirements: 2.6_

- [x] 8. Checkpoint - Budget Service tests pass

- [x] 9. Implement Proposal Service
  - [x] 9.1 Create Proposal Service with CRUD operations
    - Implement create, createBatch, list, get methods
    - _Requirements: 4.1, 4.4, 4.8_

  - [x] 9.2 Implement proposal approval and rejection
    - Approve/reject proposals with state transitions
    - _Requirements: 4.5, 4.6_

  - [x] 9.3 Write property test for Proposal Lifecycle
    - **Property 9: Proposal Lifecycle**
    - **Validates: Requirements 4.1, 4.5, 4.6, 4.7**

  - [x] 9.4 Write property test for Proposal Validation
    - **Property 10: Proposal Validation**
    - **Validates: Requirements 4.2**

  - [ ] 9.5 Implement proposal notification
    - Send push/email notification on proposal creation
    - _Requirements: 4.3_

  - [ ] 9.6 Write property test for Proposal Notification
    - **Property 11: Proposal Notification**
    - **Validates: Requirements 4.3**

- [x] 10. Create Proposal API Endpoints
  - [x] 10.1 Create POST /api/agents/proposals endpoint (agent auth)
    - Create proposal from agent
    - _Requirements: 4.1_

  - [x] 10.2 Create POST /api/agents/proposals/batch endpoint
    - Create batch proposals
    - _Requirements: 4.8_

  - [x] 10.3 Create GET /api/agents/proposals endpoint (owner auth)
    - List proposals for owner
    - _Requirements: 4.4_

  - [x] 10.4 Create GET /api/agents/proposals/[id] endpoint
    - Get proposal details
    - _Requirements: 4.4_

  - [x] 10.5 Create PUT /api/agents/proposals/[id]/approve endpoint
    - Approve proposal
    - _Requirements: 4.5_

  - [x] 10.6 Create PUT /api/agents/proposals/[id]/reject endpoint
    - Reject proposal
    - _Requirements: 4.6_

- [x] 11. Checkpoint - Proposal Service tests pass

- [x] 12. Implement Auto-Execute Service
  - [x] 12.1 Create Auto-Execute Service
    - Process proposals for auto-execution
    - Check rules and budget
    - _Requirements: 5.1, 5.2_

  - [x] 12.2 Implement auto-execute rules checking
    - Check max amount, whitelist, allowed tokens
    - _Requirements: 5.4, 5.5_

  - [x] 12.3 Write property test for Auto-Execute Budget Enforcement
    - **Property 12: Auto-Execute Budget Enforcement**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

  - [ ] 12.4 Implement auto-execute notification
    - Notify owner on auto-executed payments
    - _Requirements: 5.3_

  - [ ] 12.5 Write property test for Auto-Execute Notification
    - **Property 13: Auto-Execute Notification**
    - **Validates: Requirements 5.3**

  - [x] 12.6 Write property test for Emergency Pause
    - **Property 14: Emergency Pause**
    - **Validates: Requirements 5.6**

- [ ] 13. Implement x402 Integration
  - [ ] 13.1 Integrate x402 authorization generation
    - Generate x402 authorization for approved proposals
    - _Requirements: 8.1, 8.2_

  - [ ] 13.2 Implement proposal execution via x402
    - Execute payment using x402 relayer
    - _Requirements: 8.3_

  - [ ] 13.3 Write property test for x402 Authorization
    - **Property 17: x402 Authorization Generation**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 14. Checkpoint - Auto-Execute and x402 tests pass

- [x] 15. Implement Agent Webhook Service
  - [x] 15.1 Create Agent Webhook Service
    - Trigger webhooks for agent events
    - Sign payloads with webhook secret
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 15.2 Implement webhook delivery with retry
    - Retry up to 3 times with exponential backoff
    - _Requirements: 7.4_

  - [ ] 15.3 Write property test for Agent Webhook Delivery
    - **Property 15: Agent Webhook Delivery**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

  - [ ] 15.4 Write property test for Agent Webhook Retry
    - **Property 16: Agent Webhook Retry**
    - **Validates: Requirements 7.4**

  - [x] 15.5 Create GET /api/agents/[id]/webhooks endpoint
    - Get webhook deliveries
    - _Requirements: 7.1_

  - [x] 15.6 Create POST /api/agents/[id]/webhooks/test endpoint
    - Send test webhook
    - _Requirements: 7.1_

- [x] 16. Implement Agent Activity Service
  - [x] 16.1 Create Agent Activity Service
    - Log agent activities
    - _Requirements: 1.7, 3.5, 6.4, 6.5_

  - [x] 16.2 Implement activity analytics
    - Calculate spending trends, top recipients
    - _Requirements: 6.6_

  - [ ] 16.3 Write property test for Activity Logging
    - **Property 18: Activity Logging**
    - **Validates: Requirements 1.7, 3.5, 6.4, 6.5**

  - [ ] 16.4 Write property test for Analytics Accuracy
    - **Property 19: Analytics Accuracy**
    - **Validates: Requirements 6.2, 6.6**

  - [x] 16.5 Create GET /api/agents/activities endpoint
    - Get all agent activities
    - _Requirements: 6.4_

  - [x] 16.6 Create GET /api/agents/[id]/activities endpoint
    - Get agent activities
    - _Requirements: 6.4_

  - [x] 16.7 Create GET /api/agents/analytics endpoint
    - Get agent analytics
    - _Requirements: 6.6_

- [x] 17. Checkpoint - All Agent Link API tests pass

- [ ] 18. Final Integration
  - [ ] 18.1 Wire all services together
    - Connect proposal → auto-execute → x402 → webhook flow
    - _Requirements: All_

  - [ ] 18.2 Add audit logging for all operations
    - Log to audit_logs table
    - _Requirements: 1.7_

  - [ ] 18.3 Write integration tests
    - Test full proposal lifecycle
    - Test auto-execute flow
    - _Requirements: All_

- [ ] 19. Final Checkpoint - All tests pass
  - Ensure all property tests run 100 iterations
  - Verify all API endpoints work correctly

## Notes

- All tasks are required (no optional tasks)
- Testing framework: Jest with fast-check for property-based testing
- Each property test should run 100 iterations
- Agent API keys use `agent_` prefix to distinguish from user API keys (`pb_`)
- x402 integration reuses existing x402 service from the codebase
