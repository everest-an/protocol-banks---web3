# Agent tools — one manifest, any framework

`@protocolbanks/agent-tools` turns the Agent API into tool definitions you can
hand to a model. The definitions are plain JSON Schema, so they work with the
Vercel AI SDK, LangChain, OpenAI function calling, Anthropic tools, or a small
loop of your own.

There are no runtime dependencies: the only import is the `ProtocolBanks` type.

```ts
import { ProtocolBanks } from "@protocolbanks/sdk"
import { agentTools } from "@protocolbanks/agent-tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })
const tools = agentTools(pb)
// agent_state · place_order · prepare_payment · prepare_swap · create_invoice
```

Every tool returns the API envelope **plus the HTTP status**. A `403` (key
policy) or `409` (platform guard) is returned, never thrown, and the
descriptions tell the model to stop instead of retrying: the server will not
change its mind without a different request. Only `place_order` executes; the
other four prepare something the agent signs itself.

## Vercel AI SDK

```bash
pnpm add ai @ai-sdk/openai @protocolbanks/sdk @protocolbanks/agent-tools
```

```ts
import { generateText, jsonSchema, stepCountIs, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { ProtocolBanks } from "@protocolbanks/sdk"
import { agentTools } from "@protocolbanks/agent-tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })

const tools = Object.fromEntries(
  agentTools(pb).map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.parameters as never),
      execute: definition.execute,
    }),
  ]),
)

const { text } = await generateText({
  model: openai("gpt-4.1"),
  tools,
  stopWhen: stepCountIs(6),
  prompt: "Read my policy, then place a $20 BTC long. Stop if it is refused.",
})
```

> AI SDK v5 uses `inputSchema` and `stopWhen`. On v4 the same loop uses
> `parameters` and `maxSteps`; the manifest is identical.

## LangChain

LangChain tools take a Zod schema, so each definition is a one-field wrapper
(the description is reused verbatim, so the model sees the same rules):

```bash
pnpm add @langchain/core zod @protocolbanks/sdk @protocolbanks/agent-tools
```

```ts
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { ProtocolBanks } from "@protocolbanks/sdk"
import { agentTools } from "@protocolbanks/agent-tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })
const manifest = agentTools(pb)
const describe = (name: string) => manifest.find((tool) => tool.name === name)!.description

const placeOrder = tool(
  async ({ coin, side, sizeUsd }) => pb.agent.order({ coin, side, sizeUsd }),
  {
    name: "place_order",
    description: describe("place_order"),
    schema: z.object({
      coin: z.string(),
      side: z.enum(["long", "short"]),
      sizeUsd: z.number().positive(),
    }),
  },
)

const createInvoice = tool(
  async ({ to, amount, description }) => pb.agent.invoice({ to, amount, description }),
  {
    name: "create_invoice",
    description: describe("create_invoice"),
    schema: z.object({ to: z.string(), amount: z.number().positive(), description: z.string().optional() }),
  },
)
```

## OpenAI / Anthropic

Both APIs accept JSON Schema directly:

```ts
import { toAnthropicTools, toOpenAIFunctions, agentTools } from "@protocolbanks/agent-tools"

const definitions = agentTools(pb)
const openaiTools = toOpenAIFunctions(definitions) // [{ type: "function", function: { name, description, parameters } }]
const anthropicTools = toAnthropicTools(definitions) // [{ name, description, input_schema }]

// dispatch a model tool call back to the manifest
async function runTool(name: string, args: Record<string, unknown>) {
  const definition = definitions.find((tool) => tool.name === name)
  if (!definition) throw new Error(`unknown tool ${name}`)
  return definition.execute(args)
}
```

## Your own loop

If your runtime has no tool abstraction, the manifest is still the contract:
name, description, JSON Schema, execute. A dispatcher is ten lines and the
server enforces the cap regardless of what the model asks for.

## Why this shape

- **Only `place_order` moves money.** It executes through the account's
  Hyperliquid agent wallet, which has trading-only rights and can never
  withdraw. `prepare_payment`, `prepare_swap` and `create_invoice` return
  something the agent signs itself — the platform holds no keys.
- **Refusals are data, not exceptions.** `403` means the key's policy said no;
  `409` means the platform guard did. Both are final for that request.
- **The cap is server-side.** A tool schema cannot widen it; the policy lives
  on the key and is edited at `/settings/api-keys`.

## MCP instead?

If your host speaks the Model Context Protocol, use the hosted server at
[`/mcp`](https://protocolbanks.com/mcp) — same account, different transport.
