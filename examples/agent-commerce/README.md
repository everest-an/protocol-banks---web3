# Agent commerce: Vercel AI SDK + LangChain

Runnable templates for an agent that buys or sells a service through the
Protocol Banks commerce API. Both examples create a disposable sandbox session,
accept a $1 quote as the buyer, deliver as the seller, then list the order.

No wallet is required. The sandbox keys are scoped to read plus
`accept quote` / `deliver order`, expire in 24 hours, and cannot publish
services, trade, pay or call a paid model.

## Run

```bash
cd examples/agent-commerce
npm install
export OPENAI_API_KEY=...
npm run vercel-ai-sdk
# or
npm run langchain
```

For a local server:

```bash
export PB_BASE_URL=http://localhost:3000
```

If `OPENAI_API_KEY` is not available, the same flow can be run with curl from
[/sandbox](https://www.protocolbanks.com/sandbox).

## Files

- `client.ts` — framework-neutral fetch client for sandbox keys, quotes and orders.
- `vercel-ai-sdk.ts` — `generateText` with three tools and a multi-step stop condition.
- `langchain.ts` — `createToolCallingAgent` + `AgentExecutor`.

## What the agent does

1. `POST /api/sandbox/keys` creates a buyer key, a seller key and a live quote.
2. `accept_quote` creates an order with a `termsHash`.
3. `deliver_order` records a sha256 delivery hash as the seller.
4. `list_orders` shows the final status.

Payment is not simulated. Completion requires a funded wallet and a signed
EIP-3009 authorization, so the sandbox stops at `delivered`.

The hosted API contract is at
[`/api/agent.openapi.json`](https://www.protocolbanks.com/api/agent.openapi.json);
the human walkthrough is at [`/agent-api`](https://www.protocolbanks.com/agent-api).
