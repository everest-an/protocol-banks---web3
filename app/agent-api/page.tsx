import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { TrackView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Agent API — an execution layer your agent cannot drain",
  description:
    "One credential, one policy the server enforces — operations, per-call cap, daily cap, coin allowlist — across five endpoints. Trading executes through a trading-only agent wallet; pay, swap and invoice return what the agent signs itself. Sandbox in paper mode.",
  alternates: { canonical: "https://protocolbanks.com/agent-api" },
  openGraph: {
    title: "Agent API — an execution layer your agent cannot drain",
    description:
      "One credential, one server-enforced policy. Give an AI agent a trading budget it cannot exceed and a key it cannot widen.",
    url: "https://protocolbanks.com/agent-api",
    type: "article",
  },
}

const DOCS = "https://github.com/everest-an/protocol-banks---web3/blob/main/docs"

const POLICY = [
  { field: "allowedOps", meaning: "read | trade | pay | swap — which calls the key may make", born: '["read"]' },
  { field: "maxNotionalUsd", meaning: "per-call cap; a larger order is refused before execution", born: "$50" },
  { field: "dailyCapUsd", meaning: "per UTC day, summed from metered calls", born: "$200" },
  { field: "allowedCoins", meaning: "allowlist; empty means every supported market", born: "[]" },
]

const ENDPOINTS = [
  { method: "GET", path: "/state", op: "read", executes: false, note: "mode, equity, positions, activity, policy with spentTodayUsd" },
  { method: "POST", path: "/orders", op: "trade", executes: true, note: "fill + fee + remainingTodayUsd" },
  { method: "POST", path: "/pay", op: "pay", executes: false, note: "validated transfer intent to sign" },
  { method: "POST", path: "/swap", op: "swap", executes: false, note: "quote + transaction to sign" },
  { method: "POST", path: "/invoice", op: "pay", executes: false, note: "pending invoice + paymentLink" },
]

const ERRORS = [
  { status: "400", meaning: "malformed body, bad address, non-positive amount" },
  { status: "401", meaning: "missing or invalid key" },
  { status: "403", meaning: "policy refusal — op, per-call cap, daily cap, allowlist" },
  { status: "409", meaning: "platform guard — positions, breakers, funds, unknown market, no route" },
  { status: "429", meaning: "rate limit (100 requests/minute per IP)" },
]

export default function AgentsPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <TrackView name="agents_view" />
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-16 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ agent api ]</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] uppercase max-w-3xl">
          Your agent can trade. It can never drain the account.
        </h1>
        <p className="mt-6 text-lg text-[#6F6B64] leading-relaxed max-w-[62ch]">
          One credential, one <span className="text-[#111111] font-medium">policy the server enforces</span> —
          operations, per-call cap, daily cap, coin allowlist. Five endpoints. Trading executes through a
          Hyperliquid agent wallet with <span className="text-[#111111] font-medium">trading-only rights</span>; pay,
          swap and invoice return something the agent signs itself, because the platform holds no keys.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
          >
            Create an API key <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="/api/agent.openapi.json"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            OpenAPI 3.1 contract
          </a>
        </div>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ 60-second start ]</p>
          <ol className="space-y-4 text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            <li>
              <span className="font-mono text-xs text-[#111111]">1.</span> Create a key in{" "}
              <Link href="/settings/api-keys" className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]">
                Settings → API Keys
              </Link>{" "}
              and set the policy: grant <span className="font-mono text-xs">read</span> and{" "}
              <span className="font-mono text-xs">trade</span>, cap the call at $50.
            </li>
            <li>
              <span className="font-mono text-xs text-[#111111]">2.</span> Export the key and read the account. A new
              wallet gets a paper account with real market data and simulated fills.
            </li>
          </ol>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-5 font-mono text-xs leading-relaxed text-[#111111]">
{`export PB_KEY=pb_…
curl -s https://protocolbanks.com/api/v1/agent/state \\
  -H "Authorization: Bearer $PB_KEY"`}
          </pre>

          <p className="mt-6 text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            <span className="font-mono text-xs text-[#111111]">3.</span> Place an order. The response tells you the
            fill, the fee and what the daily cap still allows.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-5 font-mono text-xs leading-relaxed text-[#111111]">
{`curl -s https://protocolbanks.com/api/v1/agent/orders \\
  -H "Authorization: Bearer $PB_KEY" -H "Content-Type: application/json" \\
  -d '{"coin":"BTC","side":"long","sizeUsd":20}'

# run the whole walk in one command
PB_KEY=pb_… pnpm example:agent        # state → order
PB_KEY=pb_… pnpm example:agent --invoice`}
          </pre>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ what the server enforces ]</p>
          <p className="text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            The policy lives on the key, is edited at{" "}
            <Link href="/settings/api-keys" className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]">
              /settings/api-keys
            </Link>{" "}
            and cannot be widened by the caller. Values are clamped to the platform ranges.
          </p>
          <div className="mt-5 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                <tr>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Meaning</th>
                  <th className="px-4 py-3">New key</th>
                </tr>
              </thead>
              <tbody>
                {POLICY.map((row) => (
                  <tr key={row.field} className="border-b border-[#F0EEE9] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{row.field}</td>
                    <td className="px-4 py-3 text-[#6F6B64]">{row.meaning}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.born}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[#6F6B64]">
            Trading also passes the platform risk envelope: position cap, leverage, stop-loss/take-profit, daily 5%/8%
            breakers. A size above the platform cap is clamped; a size above the key&apos;s cap is refused with 403.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ endpoints ]</p>
          <div className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                <tr>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Policy op</th>
                  <th className="px-4 py-3">Executes?</th>
                  <th className="px-4 py-3">Returns</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((row) => (
                  <tr key={row.path + row.method} className="border-b border-[#F0EEE9] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.method} {row.path}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.op}</td>
                    <td className="px-4 py-3">{row.executes ? "yes (agent wallet)" : "no"}</td>
                    <td className="px-4 py-3 text-[#6F6B64]">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[#6F6B64]">
            Base URL <span className="font-mono">https://protocolbanks.com/api/v1/agent</span>. Every call is logged;
            orders are metered at 8 bps of notional.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ sandbox → live ]</p>
          <p className="text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            A key that belongs to a paper account trades at mark ± slippage with simulated money — same endpoints,
            same guards, <span className="font-mono text-xs text-[#111111]">mode: &quot;paper&quot;</span> in the
            response, and the ledger survives a cold start. Approve the agent wallet on Hyperliquid and the same code
            goes live without a change. The agent wallet has trading-only rights: it can place and cancel orders, never
            withdraw.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ errors ]</p>
          <div className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ERRORS.map((row) => (
                  <tr key={row.status} className="border-b border-[#F0EEE9] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{row.status}</td>
                    <td className="px-4 py-3 text-[#6F6B64]">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[#6F6B64]">
            A 403 is the key policy refusing; a 409 is the platform guard refusing. Do not retry either unchanged. An
            order that reaches the venue without a confirmed response is reported as 409, recorded, and reconciled by
            client-order-id — it is never retried automatically.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ frameworks ]</p>
          <p className="text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            The API is a tool call. Wrap it in whatever your agent already uses — LangChain, the Vercel AI SDK, CrewAI,
            Mastra, or a raw function. <span className="text-[#111111] font-medium">@everestan/protocolbanks-agent-tools</span>{" "}
            ships the five operations as JSON-Schema tool definitions with OpenAI and Anthropic converters, so one
            manifest covers every framework. The server enforces the cap, so the model can ask for anything:
          </p>
          <pre className="mt-5 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-5 font-mono text-xs leading-relaxed text-[#111111]">
{`const call = (path, body) =>
  fetch(\`https://protocolbanks.com/api/v1/agent\${path}\`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: \`Bearer \${process.env.PB_KEY}\`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json())

// a runaway loop asking for $5,000 gets {"ok":false,"error":"… exceeds … cap"} with 403
const order = await call("/orders", { coin: "BTC", side: "long", sizeUsd: 20 })`}
          </pre>
          <p className="mt-4 text-xs text-[#6F6B64]">
            Prefer a protocol? The same surface is reachable from the{" "}
            <Link href="/mcp" className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]">
              MCP server
            </Link>{" "}
            for hosts that speak it.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ references ]</p>
          <ul className="space-y-2 font-mono text-sm">
            <li>
              <a href="/api/agent.openapi.json" className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]">
                /api/agent.openapi.json
              </a>{" "}
              <span className="text-[#6F6B64]">— the machine-readable contract (OpenAPI 3.1)</span>
            </li>
            <li>
              <a
                href={`${DOCS}/AGENT_API.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]"
              >
                AGENT_API.md
              </a>{" "}
              <span className="text-[#6F6B64]">— auth, policy, every endpoint, errors, billing</span>
            </li>
            <li>
              <a
                href={`${DOCS}/AGENT_CASES.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]"
              >
                AGENT_CASES.md
              </a>{" "}
              <span className="text-[#6F6B64]">— four worked integrations, including a runaway model loop</span>
            </li>
            <li>
              <a
                href={`${DOCS}/AGENT_TOOLS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]"
              >
                AGENT_TOOLS.md
              </a>{" "}
              <span className="text-[#6F6B64]">— the tool manifest and framework adapters</span>
            </li>
            <li>
              <a
                href={`${DOCS}/PARTNERS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111]"
              >
                PARTNERS.md
              </a>{" "}
              <span className="text-[#6F6B64]">— partner integration, sandbox, per-order billing</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
