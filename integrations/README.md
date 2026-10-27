# Framework integrations

Runnable starters that put the Protocol Banks [Agent API](../docs/AGENT_API.md)
inside an agent framework. All three call the published packages:

- `@everestan/protocolbanks-sdk` — the client (`state`, `order`, `pay`, `swap`, `invoice`, `invoiceStatus`)
- `@everestan/protocolbanks-agent-tools` — the JSON-Schema tool manifest

| Framework | Folder | What it gives you |
|---|---|---|
| Vercel AI SDK | [`vercel-ai/`](vercel-ai) | `generateText` with the five tools wired from the manifest |
| Mastra | [`mastra/`](mastra) | `createTool` definitions + a ready `Agent` |
| elizaOS | [`eliza/`](eliza) | a plugin with a state provider and trade/state actions |

Each folder is standalone: `npm install`, set `PB_KEY`, run it. They are not
part of the site build (excluded from `tsc`/ESLint), so their framework
dependencies never leak into the app. Each starter was type-checked against the
version it pins: AI SDK 7, Mastra 1.79, elizaOS 1.7.

**The one rule that matters:** the server enforces the key's policy. A `403`
(key policy) or `409` (platform guard) is returned, not thrown — and must not be
retried unchanged. The tool descriptions carry that instruction to the model.

For tool-style hosts that speak MCP, use the hosted server at
`https://protocolbanks.com/api/mcp` instead (see [docs/MCP.md](../docs/MCP.md)).
