# @protocolbanks/mcp-server

MCP (Model Context Protocol) Server for AI Agent subscription payments via x402 protocol.

## Features

- 🤖 **AI Agent Integration** - Works with Claude Desktop, ChatGPT, and other MCP-compatible clients
- 💳 **Subscription Management** - List, subscribe, check, and cancel subscriptions
- 💰 **Pay-per-call Micropayments** - Define paid tools with automatic 402 payment flow
- 🔗 **x402 Protocol** - Standard HTTP 402 Payment Required responses
- ⚡ **CDP Facilitator** - Zero-fee USDC settlements on Base chain
- 🔄 **Automatic Fallback** - Falls back to self-built relayer for non-Base chains

## Installation

```bash
npm install @protocolbanks/mcp-server
# or
pnpm add @protocolbanks/mcp-server
# or
yarn add @protocolbanks/mcp-server
```

## Quick Start

### 1. Create a Simple MCP Server

```typescript
import { createPaidHandler, createPaidServer } from '@protocolbanks/mcp-server';

const server = createPaidServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  recipient: {
    evm: {
      address: '0xYourMerchantAddress',
      isTestnet: false,
    },
  },
});

// Register a free tool
server.tool(
  'get_info',
  'Get information (free)',
  { type: 'object', properties: {} },
  async () => ({ info: 'Hello from MCP!' })
);

// Register a paid tool
server.paidTool(
  'premium_feature',
  'Access premium feature',
  '$0.01', // Price in USDC
  { type: 'object', properties: { query: { type: 'string' } } },
  async ({ query }) => ({ result: `Premium result for: ${query}` })
);
```

### 2. Configure Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "protocolbanks": {
      "command": "npx",
      "args": ["@protocolbanks/mcp-server"],
      "env": {
        "MERCHANT_ADDRESS": "0xYourMerchantAddress",
        "NETWORK": "base",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MERCHANT_ADDRESS` | Yes | Your EVM wallet address for receiving payments |
| `NETWORK` | No | Network to use: `base` (default) or `base-sepolia` |
| `SUPABASE_URL` | No | Supabase project URL for subscription storage |
| `SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `CDP_FACILITATOR_URL` | No | CDP Facilitator URL (defaults to Coinbase CDP) |
| `MCP_SERVER_NAME` | No | Custom server name |
| `MCP_SERVER_VERSION` | No | Custom server version |

## API Reference

### PaidServer

```typescript
import { createPaidServer, PaidServer } from '@protocolbanks/mcp-server';

const server = createPaidServer(config);
```

#### Methods

##### `tool(name, description, inputSchema, handler)`

Register a free tool.

```typescript
server.tool(
  'list_items',
  'List all items',
  { type: 'object', properties: {} },
  async () => ({ items: [] })
);
```

##### `paidTool(name, description, price, inputSchema, handler)`

Register a paid tool that requires payment.

```typescript
server.paidTool(
  'premium_search',
  'Premium search feature',
  '$0.001', // Supports "$0.001", "0.001 USDC", "0.001"
  {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  },
  async ({ query }) => {
    // Tool logic here
    return { results: [] };
  }
);
```

### Subscription Tools

The built-in subscription tools are automatically registered:

| Tool | Type | Description |
|------|------|-------------|
| `list_subscriptions` | Free | List all available subscription plans |
| `get_subscription_info` | Free | Get details about a specific plan |
| `subscribe` | Paid | Subscribe to a plan (triggers 402) |
| `check_subscription` | Free | Check subscription status |
| `get_my_subscriptions` | Free | Get user's subscriptions |
| `cancel_subscription` | Free | Cancel a subscription |

### Payment Flow

When a paid tool is called without payment:

1. Server returns HTTP 402 with `X-Payment-Request` header
2. AI Agent signs and submits payment
3. Payment is verified via CDP Facilitator
4. Tool executes and returns result

```typescript
// 402 Response structure
{
  "status": 402,
  "error": "Payment Required",
  "paymentRequired": {
    "version": "1.0",
    "network": "base",
    "paymentAddress": "0x...",
    "amount": "0.001",
    "token": "USDC",
    "memo": "Payment for premium_search",
    "validUntil": 1234567890
  }
}
```

## Database Schema

If using Supabase for subscription storage, create these tables:

```sql
-- Subscription plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  interval VARCHAR(20) NOT NULL,
  features JSONB DEFAULT '[]',
  max_api_calls INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment records
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id),
  amount DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  tx_hash VARCHAR(66),
  network VARCHAR(20) DEFAULT 'base',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Examples

### Custom MCP Server with Subscription Tools

```typescript
import {
  createPaidServer,
  createSubscriptionService,
  registerSubscriptionTools,
} from '@protocolbanks/mcp-server';

async function main() {
  const server = createPaidServer({
    name: 'my-subscription-server',
    version: '1.0.0',
    recipient: {
      evm: { address: process.env.MERCHANT_ADDRESS! },
    },
  });

  // Initialize subscription service
  const subscriptionService = createSubscriptionService({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_ANON_KEY!,
  });
  await subscriptionService.initialize();

  // Register subscription tools
  registerSubscriptionTools(server, subscriptionService);

  // Add custom tools
  server.paidTool(
    'generate_report',
    'Generate a detailed report',
    '$1.00',
    { type: 'object', properties: { type: { type: 'string' } } },
    async ({ type }) => {
      // Generate report logic
      return { report: `Report of type: ${type}` };
    }
  );

  // Connect to stdio transport
  const { StdioServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/stdio.js'
  );
  const transport = new StdioServerTransport();
  await server.getServer().connect(transport);
}

main();
```

## License

MIT
