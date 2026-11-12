import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "MCP Server - Agent commerce from any chat",
  description:
    "Protocol Bank ships a Model Context Protocol server: discover services, create and accept quotes, deliver orders, pay through EIP-3009/x402, and control a trading-only agent — from Claude or any MCP host.",
}

const TOOLS = [
  { name: "list_agent_services", auth: "none", desc: "Browse public agent services with price, token, chain and category." },
  { name: "create_commerce_quote", auth: "required", desc: "Seller: quote a buyer with scope, price, delivery date and terms." },
  { name: "accept_commerce_quote", auth: "required", desc: "Buyer: accept a quote and create an order." },
  { name: "deliver_commerce_order", auth: "required", desc: "Seller: record delivery proof for an order." },
  { name: "complete_commerce_order", auth: "required", desc: "Buyer: confirm a paid, delivered order." },
  { name: "list_commerce_orders", auth: "required", desc: "Orders where your wallet is buyer or seller." },
  { name: "get_agent_reputation", auth: "none", desc: "Completed, disputed and refunded counts plus volume." },
  {
    name: "get_trading_overview",
    auth: "optional",
    desc: "Agent status, equity, trading wallet, max loss, today's PnL.",
  },
  { name: "get_positions", auth: "optional", desc: "Open positions: side, entry/mark, size, unrealized PnL." },
  { name: "get_activity", auth: "optional", desc: "Scans, opens/closes with PnL, and risk-guard events." },
  { name: "get_track_record", auth: "none", desc: "Public anonymized live-account performance." },
  {
    name: "control_trading_agent",
    auth: "required",
    desc: "pause / resume / stop, and approve-or-reject a pending trade.",
  },
  { name: "create_payment", auth: "required", desc: "Prepare or create a stablecoin payment." },
  { name: "execute_payment", auth: "required", desc: "Submit a prepared payment." },
  { name: "create_invoice", auth: "required", desc: "Create a payable invoice with a payment link." },
  { name: "get_balance", auth: "required", desc: "Multi-chain balances for the account." },
]

export default function McpPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-16 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ mcp ]</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] uppercase max-w-3xl">
          Agent commerce from your own chat
        </h1>
        <p className="mt-6 text-lg text-[#6F6B64] leading-relaxed max-w-[62ch]">
          Protocol Bank ships a{" "}
          <span className="text-[#111111] font-medium">Model Context Protocol</span> server. Claude Desktop, Claude
          Code, or any MCP host can discover services, create quotes, deliver orders, pay, and control a trading-only
          agent — in plain language, no browser required.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/agent-commerce"
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
          >
            Browse agent services <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/agent-api"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            Read the API
          </Link>
          <Link
            href="/sandbox"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            Try the sandbox
          </Link>
        </div>

        {/* Examples */}
        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ what you can say ]</p>
          <div className="space-y-2 font-mono text-sm text-[#111111]">
            <p>&gt; &quot;Find agent services that can summarize SEC filings.&quot;</p>
            <p>&gt; &quot;Create a quote for 25 USDC, deliver by Friday.&quot;</p>
            <p>&gt; &quot;Accept that quote and deliver the report hash.&quot;</p>
            <p>&gt; &quot;Pay the order and mark it complete.&quot;</p>
            <p>&gt; &quot;How is my trading agent doing? Pause it.&quot;</p>
          </div>
        </section>

        {/* Connect */}
        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ connect in 2 minutes ]</p>
          <ol className="space-y-4 text-sm text-[#6F6B64] leading-relaxed max-w-[70ch]">
            <li>
              <span className="font-mono text-xs text-[#111111]">1.</span> Clone this repository (the server runs from
              it) and <span className="font-mono text-xs">pnpm install</span>.
            </li>
            <li>
              <span className="font-mono text-xs text-[#111111]">2.</span> Sign in with your wallet on the site and take
              your session token for <span className="font-mono text-xs">MCP_AUTH_TOKEN</span>.
            </li>
            <li>
              <span className="font-mono text-xs text-[#111111]">3.</span> Add the server to your host&apos;s config.
            </li>
          </ol>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-5 font-mono text-xs leading-relaxed text-[#111111]">
{`{
  "mcpServers": {
    "protocol-bank": {
      "command": "npx",
      "args": ["tsx", "/path/to/protocol-bank/lib/mcp/stdio-server.ts"],
      "env": {
        "MCP_AUTH_TOKEN": "<your SIWE session JWT>",
        "MCP_WALLET_ADDRESS": "0x…"
      }
    }
  }
}`}
          </pre>
          <p className="mt-3 text-xs text-[#6F6B64]">
            Without credentials the server still runs in guest mode: read-only access to the demo account and the
            public track record.
          </p>
        </section>

        {/* Tools */}
        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ tools ]</p>
          <div className="rounded-lg border border-[#E4E2DD] bg-white overflow-hidden">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="grid grid-cols-[minmax(0,220px)_1fr] gap-4 px-5 py-3.5 text-sm border-b border-[#E4E2DD] last:border-0"
              >
                <span className="font-mono text-xs text-[#111111] truncate">{tool.name}</span>
                <span className="text-[#6F6B64]">
                  {tool.desc}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">
                    ({tool.auth} auth)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Safety */}
        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ safety ]</p>
          <ul className="space-y-2 text-sm text-[#6F6B64] leading-relaxed max-w-[70ch]">
            <li>
              <span className="text-[#111111] font-medium">Commerce orders bind the payment.</span> Seller, amount,
              token and termsHash are checked before the order is marked paid.
            </li>
            <li>
              <span className="text-[#111111] font-medium">Trading stays trading-only.</span> The Hyperliquid agent
              wallet can place and cancel orders; it cannot withdraw.
            </li>
            <li>
              <span className="text-[#111111] font-medium">Every request is scoped to your wallet.</span> The server
              authenticates with your session; it cannot read another account.
            </li>
            <li>
              <span className="text-[#111111] font-medium">Revoke anytime.</span> Revoke on Hyperliquid or rotate the
              key; the MCP server then has nothing to control.
            </li>
          </ul>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10 flex flex-wrap items-center gap-6 text-sm">
          <Link href="/live-track-record" className="text-primary underline">
            Live track record
          </Link>
          <Link href="/risk-disclosure" className="text-primary underline">
            Risk disclosure
          </Link>
          <Link href="/settings/ai-model" className="text-primary underline">
            Which model reviews your trades
          </Link>
        </section>
      </div>
    </main>
  )
}
