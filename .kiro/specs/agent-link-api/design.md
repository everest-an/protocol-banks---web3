# Design Document: Agent Link API

## Overview

The Agent Link API enables AI agents to interact with Protocol Banks programmatically, requesting budgets, proposing payments, and executing transactions with human oversight. This feature positions Protocol Banks as the premier "Decentralized Treasury Management for the AI Era" platform.

The implementation follows a layered architecture:
- **API Layer**: Next.js API routes with agent-specific authentication middleware
- **Service Layer**: TypeScript services for agent management, budget tracking, and proposal handling
- **Integration Layer**: x402 protocol for gasless payments, webhook delivery for agent notifications
- **Data Layer**: Supabase PostgreSQL with RLS policies for agent data isolation

## Architecture

\`\`\`mermaid
graph TB
    subgraph "AI Agents"
        AGENT1[Trading Agent]
        AGENT2[Payroll Agent]
        AGENT3[Expense Agent]
    end
    
    subgraph "API Gateway"
        AUTH[Agent Auth Middleware]
        RATE[Rate Limiter]
        API[Agent API Routes]
    end
    
    subgraph "Service Layer"
        AGS[Agent Service]
        BDS[Budget Service]
        PRS[Proposal Service]
        AES[Auto-Execute Service]
        AWS[Agent Webhook Service]
    end
    
    subgraph "Integration Layer"
        X402[x402 Protocol]
        NOTIFY[Notification Service]
        WH[Webhook Delivery]
    end
    
    subgraph "Data Layer"
        DB[(Supabase PostgreSQL)]
    end
    
    subgraph "Human Interface"
        DASH[Agent Dashboard]
        MOBILE[Mobile Approval]
    end
    
    AGENT1 --> AUTH
    AGENT2 --> AUTH
    AGENT3 --> AUTH
    AUTH --> RATE
    RATE --> API
    API --> AGS
    API --> BDS
    API --> PRS
    AGS --> DB
    BDS --> DB
    PRS --> AES
    AES --> X402
    PRS --> NOTIFY
    PRS --> WH
    WH --> AGENT1
    WH --> AGENT2
    WH --> AGENT3
    NOTIFY --> DASH
    NOTIFY --> MOBILE
    DASH --> PRS
    MOBILE --> PRS
\`\`\`

## Components and Interfaces

### 1. Agent Service

Manages agent registration, authentication, and lifecycle.

\`\`\`typescript
interface Agent {
  id: string;
  owner_address: string;
  name: string;
  description?: string;
  type: AgentType;
  avatar_url?: string;
  api_key_hash: string;
  api_key_prefix: string;  // agent_xxxxxxxx
  webhook_url?: string;
  webhook_secret_hash?: string;
  status: 'active' | 'paused' | 'deactivated';
  auto_execute_enabled: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute: number;
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date;
}

type AgentType = 'trading' | 'payroll' | 'expense' | 'subscription' | 'custom';

interface AutoExecuteRules {
  max_single_amount: string;
  max_daily_amount: string;
  allowed_tokens: string[];
  allowed_recipients: string[];  // whitelist
  allowed_chains: number[];
}

interface AgentService {
  create(input: CreateAgentInput): Promise<{ agent: Agent; apiKey: string; webhookSecret?: string }>;
  list(ownerAddress: string): Promise<Agent[]>;
  get(id: string, ownerAddress: string): Promise<Agent | null>;
  update(id: string, input: UpdateAgentInput): Promise<Agent>;
  deactivate(id: string, ownerAddress: string): Promise<void>;
  validate(apiKey: string): Promise<{ valid: boolean; agent?: Agent }>;
  pauseAll(ownerAddress: string): Promise<void>;
  resumeAll(ownerAddress: string): Promise<void>;
}
\`\`\`

### 2. Budget Service

Manages budget allocation and tracking for agents.

\`\`\`typescript
interface AgentBudget {
  id: string;
  agent_id: string;
  owner_address: string;
  amount: string;
  token: string;
  chain_id?: number;
  period: 'daily' | 'weekly' | 'monthly' | 'total';
  used_amount: string;
  remaining_amount: string;
  period_start: Date;
  period_end?: Date;
  created_at: Date;
  updated_at: Date;
}

interface BudgetService {
  create(agentId: string, input: CreateBudgetInput): Promise<AgentBudget>;
  list(agentId: string): Promise<AgentBudget[]>;
  get(budgetId: string): Promise<AgentBudget | null>;
  update(budgetId: string, input: UpdateBudgetInput): Promise<AgentBudget>;
  delete(budgetId: string): Promise<void>;
  checkAvailability(agentId: string, amount: string, token: string, chainId?: number): Promise<{ available: boolean; budget?: AgentBudget }>;
  deductBudget(budgetId: string, amount: string): Promise<AgentBudget>;
  resetPeriodBudgets(): Promise<number>;  // Returns count of reset budgets
  getUtilization(agentId: string): Promise<BudgetUtilization>;
}

interface BudgetUtilization {
  total_allocated: string;
  total_used: string;
  utilization_percent: number;
  budgets: AgentBudget[];
}
\`\`\`

### 3. Proposal Service

Handles payment proposals from agents.

\`\`\`typescript
interface PaymentProposal {
  id: string;
  agent_id: string;
  owner_address: string;
  recipient_address: string;
  amount: string;
  token: string;
  chain_id: number;
  reason: string;
  metadata?: Record<string, any>;
  status: ProposalStatus;
  rejection_reason?: string;
  budget_id?: string;
  x402_authorization_id?: string;
  tx_hash?: string;
  created_at: Date;
  updated_at: Date;
  approved_at?: Date;
  executed_at?: Date;
}

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed';

interface ProposalService {
  create(agentId: string, input: CreateProposalInput): Promise<PaymentProposal>;
  createBatch(agentId: string, inputs: CreateProposalInput[]): Promise<PaymentProposal[]>;
  list(ownerAddress: string, filters?: ProposalFilters): Promise<PaymentProposal[]>;
  listByAgent(agentId: string, filters?: ProposalFilters): Promise<PaymentProposal[]>;
  get(proposalId: string): Promise<PaymentProposal | null>;
  approve(proposalId: string, ownerAddress: string): Promise<PaymentProposal>;
  reject(proposalId: string, ownerAddress: string, reason?: string): Promise<PaymentProposal>;
  execute(proposalId: string): Promise<PaymentProposal>;
  getPendingCount(ownerAddress: string): Promise<number>;
}

interface ProposalFilters {
  status?: ProposalStatus;
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
\`\`\`

### 4. Auto-Execute Service

Handles automatic approval and execution of proposals within budget.

\`\`\`typescript
interface AutoExecuteService {
  processProposal(proposal: PaymentProposal): Promise<AutoExecuteResult>;
  checkRules(agent: Agent, proposal: PaymentProposal): Promise<RuleCheckResult>;
  isWithinBudget(agentId: string, amount: string, token: string): Promise<boolean>;
}

interface AutoExecuteResult {
  auto_executed: boolean;
  reason?: string;
  proposal: PaymentProposal;
}

interface RuleCheckResult {
  passed: boolean;
  violations: string[];
}
\`\`\`

### 5. Agent Webhook Service

Delivers webhook events to agents.

\`\`\`typescript
type AgentWebhookEvent = 
  | 'proposal.created'
  | 'proposal.approved'
  | 'proposal.rejected'
  | 'payment.executing'
  | 'payment.executed'
  | 'payment.failed'
  | 'budget.depleted'
  | 'budget.reset'
  | 'agent.paused'
  | 'agent.resumed';

interface AgentWebhookDelivery {
  id: string;
  agent_id: string;
  event_type: AgentWebhookEvent;
  payload: object;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  last_attempt_at?: Date;
  next_retry_at?: Date;
  response_status?: number;
  error_message?: string;
  created_at: Date;
  delivered_at?: Date;
}

interface AgentWebhookService {
  trigger(agentId: string, event: AgentWebhookEvent, payload: object): Promise<void>;
  processDelivery(deliveryId: string): Promise<void>;
  getDeliveries(agentId: string, limit?: number): Promise<AgentWebhookDelivery[]>;
}
\`\`\`

### 6. Agent Activity Service

Tracks and reports agent activities.

\`\`\`typescript
interface AgentActivity {
  id: string;
  agent_id: string;
  owner_address: string;
  action: AgentAction;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

type AgentAction = 
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'payment_executed'
  | 'payment_failed'
  | 'budget_checked'
  | 'webhook_received'
  | 'api_error';

interface AgentActivityService {
  log(agentId: string, action: AgentAction, details: Record<string, any>): Promise<void>;
  getActivities(agentId: string, limit?: number): Promise<AgentActivity[]>;
  getOwnerActivities(ownerAddress: string, limit?: number): Promise<AgentActivity[]>;
  getAnalytics(ownerAddress: string): Promise<AgentAnalytics>;
}

interface AgentAnalytics {
  total_agents: number;
  active_agents: number;
  total_spent_today: string;
  total_spent_this_month: string;
  pending_proposals: number;
  spending_by_agent: { agent_id: string; agent_name: string; amount: string }[];
  top_recipients: { address: string; amount: string; count: number }[];
}
\`\`\`

## Data Models

### Database Schema

\`\`\`sql
-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  avatar_url TEXT,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  auto_execute_enabled BOOLEAN DEFAULT false,
  auto_execute_rules JSONB,
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(api_key_prefix)
);

-- Agent budgets table
CREATE TABLE IF NOT EXISTS agent_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER,
  period TEXT NOT NULL,
  used_amount TEXT NOT NULL DEFAULT '0',
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment proposals table
CREATE TABLE IF NOT EXISTS payment_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  budget_id UUID REFERENCES agent_budgets(id),
  x402_authorization_id TEXT,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Agent webhook deliveries table
CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  response_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Agent activities table
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_owner ON agents(owner_address);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agent_budgets_agent ON agent_budgets(agent_id);
CREATE INDEX idx_payment_proposals_agent ON payment_proposals(agent_id);
CREATE INDEX idx_payment_proposals_owner ON payment_proposals(owner_address);
CREATE INDEX idx_payment_proposals_status ON payment_proposals(status);
CREATE INDEX idx_agent_activities_agent ON agent_activities(agent_id);
CREATE INDEX idx_agent_activities_owner ON agent_activities(owner_address);

-- RLS Policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;

-- Agents: Owner can manage their agents
CREATE POLICY agents_owner_policy ON agents
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Budgets: Owner can manage budgets for their agents
CREATE POLICY budgets_owner_policy ON agent_budgets
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Proposals: Owner can view/manage proposals for their agents
CREATE POLICY proposals_owner_policy ON payment_proposals
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Webhook deliveries: Owner can view deliveries for their agents
CREATE POLICY webhook_deliveries_owner_policy ON agent_webhook_deliveries
  FOR ALL USING (agent_id IN (SELECT id FROM agents WHERE owner_address = current_setting('app.current_user_address', true)));

-- Activities: Owner can view activities for their agents
CREATE POLICY activities_owner_policy ON agent_activities
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));
\`\`\`

## API Endpoints

### Agent Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/[id]` | Get agent details |
| PUT | `/api/agents/[id]` | Update agent |
| DELETE | `/api/agents/[id]` | Deactivate agent |
| POST | `/api/agents/pause-all` | Pause all agents |
| POST | `/api/agents/resume-all` | Resume all agents |

### Budget Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/[id]/budgets` | Create budget |
| GET | `/api/agents/[id]/budgets` | List budgets |
| PUT | `/api/agents/[id]/budgets/[budgetId]` | Update budget |
| DELETE | `/api/agents/[id]/budgets/[budgetId]` | Delete budget |
| GET | `/api/agents/[id]/utilization` | Get budget utilization |

### Proposals (Agent API)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/proposals` | Create proposal (agent auth) |
| POST | `/api/agents/proposals/batch` | Create batch proposals |
| GET | `/api/agents/proposals` | List proposals (owner auth) |
| GET | `/api/agents/proposals/[id]` | Get proposal details |
| PUT | `/api/agents/proposals/[id]/approve` | Approve proposal |
| PUT | `/api/agents/proposals/[id]/reject` | Reject proposal |

### Activity & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/activities` | Get all agent activities |
| GET | `/api/agents/[id]/activities` | Get agent activities |
| GET | `/api/agents/analytics` | Get agent analytics |

### Agent Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/[id]/webhooks` | Get webhook deliveries |
| POST | `/api/agents/[id]/webhooks/test` | Send test webhook |

## Agent Authentication Middleware

\`\`\`typescript
// lib/middleware/agent-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/services/agent-service';

export async function agentAuthMiddleware(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer agent_')) {
    return NextResponse.json({ error: 'Invalid agent API key format' }, { status: 401 });
  }
  
  const apiKey = authHeader.slice(7);
  const validation = await agentService.validate(apiKey);
  
  if (!validation.valid || !validation.agent) {
    return NextResponse.json({ error: 'Invalid or inactive agent API key' }, { status: 401 });
  }
  
  if (validation.agent.status !== 'active') {
    return NextResponse.json({ error: 'Agent is paused or deactivated' }, { status: 403 });
  }
  
  // Attach agent context to request
  const headers = new Headers(req.headers);
  headers.set('x-agent-id', validation.agent.id);
  headers.set('x-owner-address', validation.agent.owner_address);
  headers.set('x-auth-type', 'agent');
  
  // Update last active timestamp
  await agentService.updateLastActive(validation.agent.id);
  
  return null; // Continue to handler
}
\`\`\`

## Auto-Execute Flow

\`\`\`mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant API as Agent API
    participant AES as Auto-Execute Service
    participant BS as Budget Service
    participant X402 as x402 Protocol
    participant Owner as Human Owner
    
    Agent->>API: POST /proposals
    API->>AES: processProposal()
    
    alt Auto-Execute Enabled
        AES->>AES: checkRules()
        
        alt Rules Passed
            AES->>BS: checkAvailability()
            
            alt Within Budget
                AES->>BS: deductBudget()
                AES->>X402: executePayment()
                X402-->>AES: txHash
                AES->>Agent: Webhook: payment.executed
                AES->>Owner: Notification: Auto-executed
            else Over Budget
                AES->>Owner: Notification: Approval needed
                AES-->>API: status: pending
            end
        else Rules Violated
            AES->>Owner: Notification: Approval needed
            AES-->>API: status: pending
        end
    else Auto-Execute Disabled
        AES->>Owner: Notification: New proposal
        AES-->>API: status: pending
    end
    
    API-->>Agent: ProposalResponse
\`\`\`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Agent CRUD Round-Trip

*For any* valid agent input, creating an agent, listing agents, updating it, and then deactivating it SHALL result in the agent having status "deactivated" and its API key failing validation.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Agent API Key Format

*For any* agent created, the generated API key SHALL have the prefix `agent_` and the stored `api_key_hash` SHALL be a valid SHA-256 hash that validates against the original key.

**Validates: Requirements 1.5**

### Property 3: Budget CRUD Round-Trip

*For any* valid budget input, creating a budget, listing budgets, updating it, and then deleting it SHALL result in the budget no longer appearing in the list.

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

### Property 4: Budget Validation

*For any* budget creation request missing required fields (amount, token, period), the service SHALL reject the request with a validation error.

**Validates: Requirements 2.2**

### Property 5: Budget Tracking Accuracy

*For any* payment executed against a budget, the budget's `used_amount` SHALL increase by exactly the payment amount, and `remaining_amount` SHALL decrease by the same amount.

**Validates: Requirements 2.6**

### Property 6: Budget Period Reset

*For any* budget with a periodic reset (daily/weekly/monthly), when the period ends, the `used_amount` SHALL be reset to zero and `period_start` SHALL be updated to the new period.

**Validates: Requirements 2.7**

### Property 7: Agent Authentication Validation

*For any* request with a valid agent API key where the agent is active, authentication SHALL succeed and attach the agent context. For invalid, expired, or deactivated agents, authentication SHALL return HTTP 401.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 8: Agent Permission Enforcement

*For any* agent attempting an operation outside its configured permissions or rate limits, the service SHALL return HTTP 403 or HTTP 429 respectively.

**Validates: Requirements 3.4, 3.6**

### Property 9: Proposal Lifecycle

*For any* proposal created by an agent, the proposal SHALL transition through valid states: pending → (approved | rejected) → (executing → executed | failed). Invalid state transitions SHALL be rejected.

**Validates: Requirements 4.1, 4.5, 4.6, 4.7**

### Property 10: Proposal Validation

*For any* proposal creation request missing required fields (recipient, amount, token, chain, reason), the service SHALL reject the request with a validation error.

**Validates: Requirements 4.2**

### Property 11: Proposal Notification

*For any* proposal created, the owner SHALL receive a notification (push and/or email) within 30 seconds.

**Validates: Requirements 4.3**

### Property 12: Auto-Execute Budget Enforcement

*For any* agent with auto-execute enabled, proposals within budget limits and passing all rules SHALL be automatically approved and executed. Proposals exceeding budget or violating rules SHALL be queued for manual approval.

**Validates: Requirements 5.1, 5.2, 5.4, 5.5**

### Property 13: Auto-Execute Notification

*For any* payment auto-executed by an agent, the owner SHALL receive a notification confirming the execution.

**Validates: Requirements 5.3**

### Property 14: Emergency Pause

*For any* owner invoking "pause all agents", all agents owned by that address SHALL immediately have auto-execute disabled and status set to "paused".

**Validates: Requirements 5.6**

### Property 15: Agent Webhook Delivery

*For any* agent with a registered webhook URL, events (proposal.approved, payment.executed, etc.) SHALL be delivered to that URL with valid signature headers within 30 seconds.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 16: Agent Webhook Retry

*For any* webhook delivery that fails, the service SHALL retry up to 3 times with exponential backoff, and the `attempts` count SHALL increment with each retry.

**Validates: Requirements 7.4**

### Property 17: x402 Authorization Generation

*For any* approved proposal, the service SHALL generate a valid x402 authorization signed by the owner's wallet, and the authorization SHALL be executable by the x402 relayer.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 18: Activity Logging

*For any* agent operation (proposal created, payment executed, error occurred), an activity log entry SHALL be created with the correct action type and details.

**Validates: Requirements 1.7, 3.5, 6.4, 6.5**

### Property 19: Analytics Accuracy

*For any* analytics query, the returned aggregations (total_spent_today, spending_by_agent, etc.) SHALL be mathematically correct based on the underlying proposal and payment data.

**Validates: Requirements 6.2, 6.6**

## Error Handling

### API Error Responses

\`\`\`typescript
interface AgentAPIError {
  error: string;
  code: AgentErrorCode;
  details?: object;
}

type AgentErrorCode = 
  | 'INVALID_API_KEY'
  | 'AGENT_INACTIVE'
  | 'AGENT_PAUSED'
  | 'INSUFFICIENT_BUDGET'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_PROPOSAL'
  | 'PROPOSAL_NOT_FOUND'
  | 'UNAUTHORIZED_ACTION'
  | 'X402_EXECUTION_FAILED';

// HTTP Status Codes
// 400 - Bad Request (invalid input)
// 401 - Unauthorized (invalid API key)
// 403 - Forbidden (agent paused, insufficient permissions)
// 404 - Not Found (proposal/budget not found)
// 429 - Too Many Requests (rate limited)
// 500 - Internal Server Error
// 503 - Service Unavailable (x402 relayer down)
\`\`\`

### Webhook Delivery Errors

\`\`\`typescript
// Retry schedule (exponential backoff)
// Attempt 1: Immediate
// Attempt 2: 1 minute delay
// Attempt 3: 5 minutes delay
// After 3 failures: Mark as failed, notify owner
\`\`\`

## Testing Strategy

### Unit Tests

- Agent API key generation and validation
- Budget calculation and period reset logic
- Proposal state machine transitions
- Auto-execute rule checking
- Webhook signature generation

### Property-Based Tests

Property-based tests verify universal properties using **fast-check** library:

\`\`\`typescript
import fc from 'fast-check';

// Example: Budget Tracking Accuracy
describe('Budget Service', () => {
  it('Property 5: Budget Tracking Accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialAmount: fc.integer({ min: 100, max: 10000 }).map(n => n.toString()),
          paymentAmount: fc.integer({ min: 1, max: 100 }).map(n => n.toString()),
        }),
        async ({ initialAmount, paymentAmount }) => {
          // Create budget
          const budget = await budgetService.create(agentId, {
            amount: initialAmount,
            token: 'USDC',
            period: 'monthly',
          });
          
          const initialRemaining = BigInt(budget.remaining_amount);
          
          // Deduct payment
          const updated = await budgetService.deductBudget(budget.id, paymentAmount);
          
          // Verify accuracy
          const expectedRemaining = initialRemaining - BigInt(paymentAmount);
          expect(BigInt(updated.remaining_amount)).toBe(expectedRemaining);
          expect(BigInt(updated.used_amount)).toBe(BigInt(paymentAmount));
        }
      ),
      { numRuns: 100 }
    );
  });
});
\`\`\`

### Integration Tests

- Full proposal lifecycle (create → approve → execute)
- Auto-execute flow with budget deduction
- Webhook delivery with retry
- x402 authorization and execution

### Test Configuration

- Property tests: Minimum 100 iterations per property
- Each property test references its design document property number
- Tag format: `Feature: agent-link-api, Property N: [property_text]`
- Testing framework: Jest with fast-check for property-based testing
