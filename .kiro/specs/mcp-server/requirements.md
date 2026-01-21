# Requirements Document

## Introduction

This document defines the requirements for the MCP (Model Context Protocol) Server Support feature, which enables AI Agents (Claude, ChatGPT, Cursor) to automatically trigger and process subscription payments through the x402 protocol. This is Phase 2 of the ProtocolBanks integration architecture plan.

The MCP Server will provide tools that allow AI agents to:
- List available subscription plans
- Initiate subscription payments (triggering HTTP 402 Payment Required)
- Check subscription status
- Cancel subscriptions
- Process pay-per-call micropayments

## Glossary

- **MCP_Server**: The Model Context Protocol server that exposes payment tools to AI agents
- **AI_Agent**: An AI assistant (Claude, ChatGPT, Cursor) that can call MCP tools
- **Subscription_Plan**: A predefined payment plan with pricing, frequency, and features
- **User_Subscription**: An active subscription record linking a user to a plan
- **x402_Payment**: A gasless payment using the HTTP 402 Payment Required protocol
- **CDP_Facilitator**: Coinbase Developer Platform service for free USDC settlement on Base chain
- **Payment_Handler**: The middleware that wraps MCP tools with payment requirements
- **Tool**: An MCP function that can be called by AI agents

## Requirements

### Requirement 1: MCP Server Package Structure

**User Story:** As a developer, I want a well-organized MCP server package, so that I can easily integrate payment capabilities into AI agent workflows.

#### Acceptance Criteria

1. THE MCP_Server SHALL be located at `packages/mcp-server/` with proper TypeScript configuration
2. THE MCP_Server SHALL export a `createPaidHandler` function for wrapping tools with payment requirements
3. THE MCP_Server SHALL depend on `@modelcontextprotocol/sdk` for MCP protocol compliance
4. THE MCP_Server SHALL depend on `@protocolbanks/sdk` for x402 payment processing
5. WHEN the package is built, THE MCP_Server SHALL produce both CommonJS and ESM outputs

### Requirement 2: Subscription Tools

**User Story:** As an AI agent user, I want to manage subscriptions through natural language, so that I can subscribe to services without leaving my AI assistant.

#### Acceptance Criteria

1. WHEN an AI_Agent calls `list_subscriptions`, THE MCP_Server SHALL return all available Subscription_Plans with pricing information
2. WHEN an AI_Agent calls `get_subscription_info` with a plan ID, THE MCP_Server SHALL return detailed plan information including features and pricing
3. WHEN an AI_Agent calls `subscribe` with a plan ID and wallet address, THE MCP_Server SHALL return an HTTP 402 response with payment requirements
4. WHEN an AI_Agent calls `check_subscription` with a subscription ID, THE MCP_Server SHALL return the current User_Subscription status
5. WHEN an AI_Agent calls `cancel_subscription` with a subscription ID, THE MCP_Server SHALL mark the subscription as cancelled and prevent future charges
6. IF an AI_Agent calls `subscribe` without a valid wallet address, THEN THE MCP_Server SHALL return an error with clear instructions

### Requirement 3: Payment Handler (402 Response)

**User Story:** As a developer, I want a payment handler that generates proper 402 responses, so that AI agents can process payments automatically.

#### Acceptance Criteria

1. WHEN a paid tool is called without payment, THE Payment_Handler SHALL return HTTP 402 with X-Payment-Request header
2. THE X-Payment-Request header SHALL contain version, network, paymentAddress, amount, token, and memo fields
3. WHEN a paid tool is called with valid X-Payment header, THE Payment_Handler SHALL verify the payment before executing the tool
4. THE Payment_Handler SHALL support both one-time payments and recurring subscription payments
5. WHEN payment verification fails, THE Payment_Handler SHALL return HTTP 402 with updated payment requirements
6. THE Payment_Handler SHALL use CDP_Facilitator for Base chain USDC payments (0 fees)
7. IF CDP_Facilitator is unavailable, THEN THE Payment_Handler SHALL fall back to the self-built relayer

### Requirement 4: Subscription Data Model

**User Story:** As a system administrator, I want a robust subscription data model, so that I can track and manage all subscription states reliably.

#### Acceptance Criteria

1. THE Subscription_Plan SHALL include id, name, description, price, interval, features, and maxApiCalls fields
2. THE User_Subscription SHALL include id, userId, planId, status, startDate, endDate, paymentHistory, and autoRenew fields
3. WHEN a subscription is created, THE MCP_Server SHALL persist it to the database with status "pending"
4. WHEN payment is confirmed, THE MCP_Server SHALL update the subscription status to "active"
5. WHEN a subscription expires, THE MCP_Server SHALL update the status to "expired"
6. THE MCP_Server SHALL store subscription data in Supabase with proper RLS policies

### Requirement 5: Pay-Per-Call Micropayments

**User Story:** As a service provider, I want to charge per API call, so that I can monetize my services without requiring subscriptions.

#### Acceptance Criteria

1. THE MCP_Server SHALL support `paidTool()` method for defining tools with per-call pricing
2. WHEN defining a paid tool, THE developer SHALL specify price in human-readable format (e.g., "$0.001")
3. THE MCP_Server SHALL convert human-readable prices to token amounts based on current rates
4. WHEN a paid tool is called, THE MCP_Server SHALL verify payment matches the required amount
5. THE MCP_Server SHALL support dynamic pricing based on request parameters (e.g., token count for AI APIs)

### Requirement 6: Claude Desktop Integration

**User Story:** As a Claude Desktop user, I want to configure the MCP server easily, so that I can use payment features in my AI assistant.

#### Acceptance Criteria

1. THE MCP_Server SHALL provide a configuration file template for Claude Desktop (`claude_desktop_config.json`)
2. THE MCP_Server SHALL support stdio transport for Claude Desktop integration
3. WHEN configured in Claude Desktop, THE MCP_Server SHALL expose all subscription tools to the AI agent
4. THE MCP_Server SHALL provide clear documentation for Claude Desktop setup
5. THE MCP_Server SHALL handle wallet connection through environment variables or configuration

### Requirement 7: Subscription Page Integration

**User Story:** As a web user, I want to see my real subscriptions on the website, so that I can manage them alongside AI-initiated subscriptions.

#### Acceptance Criteria

1. THE `/subscriptions` page SHALL display real subscription data from the database instead of demo data
2. WHEN a subscription is created via MCP, THE `/subscriptions` page SHALL show it in the list
3. THE `/subscriptions` page SHALL allow users to pause, resume, and cancel subscriptions
4. THE `/subscriptions` page SHALL show subscription payment history
5. WHEN in demo mode, THE `/subscriptions` page SHALL continue to show demo data for testing

### Requirement 8: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. WHEN an error occurs, THE MCP_Server SHALL return structured error responses with error codes
2. THE MCP_Server SHALL log all tool calls with timestamps, parameters, and results
3. THE MCP_Server SHALL log all payment attempts with success/failure status
4. IF a payment fails, THEN THE MCP_Server SHALL include the failure reason in the error response
5. THE MCP_Server SHALL support configurable log levels (debug, info, warn, error)

### Requirement 9: Security

**User Story:** As a security-conscious user, I want the MCP server to be secure, so that my payments and data are protected.

#### Acceptance Criteria

1. THE MCP_Server SHALL validate all input parameters before processing
2. THE MCP_Server SHALL verify wallet addresses are valid Ethereum addresses
3. THE MCP_Server SHALL use secure random nonces for payment authorizations
4. THE MCP_Server SHALL implement rate limiting to prevent abuse
5. WHEN handling sensitive data, THE MCP_Server SHALL not log payment signatures or private keys
6. THE MCP_Server SHALL validate payment amounts against configured limits
