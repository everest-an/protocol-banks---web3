# Upstream integration PRs

The code is ready in [`integrations/`](../../integrations). This file is the
per-repo plan: what to send, where, and the exact commands. Two of the three
need a maintainer's yes before a PR is worth opening; the third is a publish,
not a code PR.

Already live (no PR needed): the official MCP Registry entry
`io.github.everest-an/protocol-banks` — published by
`.github/workflows/publish-mcp.yml` with OIDC.

---

## 1. Mastra (`mastra-ai/mastra`)

**Issue opened:** https://github.com/mastra-ai/mastra/issues/28679 (Integration
Request, 2026-10-28). Wait for a maintainer's answer before porting.

**Reality check:** their `examples/` are curated full Mastra projects
(`src/mastra/index.ts`, agent + tools in their layout), not standalone scripts.
A drive-by PR will be asked to restructure.

1. Open an issue first (title below) linking our runnable starter.
2. If accepted, port `integrations/mastra/src/tools.ts` into
   `examples/protocol-banks/src/mastra/tools/protocol-banks.ts` and register a
   `Mastra` instance in `src/mastra/index.ts`, matching a neighbouring example.
3. Run their checks (`pnpm install && pnpm build` at the example, or the repo's
   example lint) before pushing — their CI will.

PR title: `docs: add a Protocol Banks agent example`

PR body:

> Adds a runnable example showing the Protocol Banks Agent API as Mastra tools
> (state, order, prepare payment/swap, invoice). The server enforces the key's
> policy (per-call cap, daily cap, allowlist), so a runaway agent cannot exceed
> it; `place_order` is the only tool that executes, and refusals come back as
> data (`403`/`409`).
>
> Standalone starter (type-checked against Mastra 1.79):
> https://github.com/everest-an/protocol-banks---web3/tree/main/integrations/mastra

---

## 2. Vercel AI SDK (`vercel/ai`)

**Issue opened:** https://github.com/vercel/ai/issues/24146 (2026-10-28).
Discussions are disabled in that repo; the support-request template is the
channel, and their CONTRIBUTING explicitly welcomes community examples.

**Reality check:** `examples/` is first-party. A third-party service example is
usually declined unless a maintainer asks for it. Ask before opening:
a discussion/issue with the starter link, or a docs entry in their community
resources.

If they say yes, the port is small: copy `integrations/vercel-ai/index.ts` into
`examples/next-protocol-banks/` with a route handler and a page, using their
`next-openai` example as the skeleton.

PR title: `examples: add Protocol Banks agent tools`

PR body:

> Adds an example that wires the Protocol Banks Agent API into `generateText`
> via `jsonSchema()`. The five tools come from a JSON-Schema manifest; the
> server enforces the key's spend cap, so the model can ask for anything and a
> runaway loop gets a `403` it cannot override. Only `place_order` executes;
> pay/swap/invoice return something the agent signs itself.
>
> Standalone starter (type-checked against AI SDK 7):
> https://github.com/everest-an/protocol-banks---web3/tree/main/integrations/vercel-ai

---

## 3. elizaOS (registry, not a PR to `elizaOS/eliza`)

**Status (2026-10-28):** published to npm as
`@everestan/plugin-protocol-banks@0.1.0`. **Registry PR is blocked:**
`github.com/elizaos-plugins/registry` returns 404 and the `elizaos-plugins` org
has zero public repos, so `elizaos publish` has nowhere to open its PR. Their
docs are stale on this point. Re-check weekly; once the repo is back, run
`npx elizaos publish` from `integrations/eliza` (assets and build are ready).

Plugins live in their own repos and the registry accepts published packages.
Path:

1. Make `integrations/eliza` a real package: add a Vitest test for the action
   validation and a `README` section on `PB_KEY`, then `npm publish --access public`
   as `@everestan/plugin-protocol-banks` (or under the eventual org).
2. `npx elizaos publish` → it publishes to npm, creates the plugin repo, and
   submits to the elizaOS registry.
3. Point tool-style hosts at the hosted MCP server instead — the plugin's
   structured-args rule is intentional (never guess a notional from prose).

No PR needed for this one; the registry submission is the distribution.

---

## Directory follow-ups (after the official registry)

- **awesome-remote-mcp-servers** (`punkpeye/awesome-remote-mcp-servers`) is the
  right list for a hosted server (the non-remote list explicitly rejects
  remote-only servers). Its entries carry a Glama connector badge/ID, so wait
  until Glama indexes the registry entry, then PR one line in the Finance
  section. The repo fast-tracks agent PRs if the title ends with `🤖🤖🤖`.
- **Glama / PulseMCP** ingest the official registry; no form should be needed.
  Recheck in 24–48h before submitting manually.
- **Smithery / mcp.so** have dashboards that need a logged-in account — those
  are the only two that require a human session.
