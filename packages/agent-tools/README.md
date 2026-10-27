# @protocolbanks/agent-tools

Tool definitions for the Protocol Banks Agent API — adapt once to the Vercel AI
SDK, LangChain, OpenAI or Anthropic.

```bash
npm install @protocolbanks/sdk @protocolbanks/agent-tools
```

```ts
import { ProtocolBanks } from "@protocolbanks/sdk"
import { agentTools, toAnthropicTools, toOpenAIFunctions } from "@protocolbanks/agent-tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })
const tools = agentTools(pb)
// agent_state · place_order · prepare_payment · prepare_swap · create_invoice
```

- Parameters are plain **JSON Schema** (OpenAI and Anthropic accept them
  directly via `toOpenAIFunctions()` / `toAnthropicTools()`; the Vercel AI SDK
  accepts them through `jsonSchema()`; LangChain wraps them in Zod).
- Only `place_order` executes. The other four return something the agent signs
  itself.
- Every tool returns the API envelope **and the HTTP status**. A `403` (key
  policy) or `409` (guard) is returned, not thrown, and the descriptions tell
  the model not to retry.

Full adapters (AI SDK, LangChain, OpenAI, Anthropic):
https://github.com/everest-an/protocol-banks---web3/blob/main/docs/AGENT_TOOLS.md

## License

GPL-3.0-only.
