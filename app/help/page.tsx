import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Check, Code2, KeyRound, Shield, Terminal } from "lucide-react"

export const metadata: Metadata = {
  title: "Help — build on the Protocol Banks Agent API",
  description:
    "Create a key, set a policy the server enforces, call the sandbox, then go live. Endpoints, limits, billing and the security model in one page.",
  alternates: { canonical: "https://protocolbanks.com/help" },
}

const STEPS = [
  {
    icon: KeyRound,
    title: "Create a key, set the policy",
    text: "Settings → API Keys. Grant read and trade, set a per-call cap and a daily cap. New keys start read-only at $50 per call and $200 per day.",
  },
  {
    icon: Terminal,
    title: "Call the sandbox",
    text: "The same five endpoints against a paper account with real market data. Place an order, read the fill, watch a $5,000 request get a 403.",
  },
  {
    icon: Shield,
    title: "Approve the wallet, go live",
    text: "Approve a Hyperliquid agent wallet with trading-only rights. The same code goes live; the wallet can trade, never withdraw.",
  },
]

const ENDPOINTS = [
  ["GET /v1/agent/state", "account, positions, activity, policy with spentTodayUsd"],
  ["POST /v1/agent/orders", "place one order (executes through the agent wallet)"],
  ["POST /v1/agent/pay", "validate and prepare a transfer the agent signs"],
  ["POST /v1/agent/swap", "quote and prepare a swap the agent signs"],
  ["POST /v1/agent/invoice", "create a pending invoice with a payment link"],
]

const SAFETY = [
  { title: "A cap the model cannot raise", text: "The policy lives on the key and is checked before an order reaches the venue. Prompt injection, bugs and loops cannot raise it." },
  { title: "Trading-only rights", text: "The agent wallet can place and cancel orders; it cannot withdraw. The funded budget is the maximum loss." },
  { title: "No keys, no funds held", text: "The platform holds neither. pay and swap return something the agent signs from its own wallet." },
  { title: "Receipts per call", text: "Every call is logged; every fill is recorded; state carries the policy and spentTodayUsd." },
]

const FAQ = [
  {
    q: "What is the Protocol Banks Agent API?",
    a: "One API key gives an AI agent a trading and payments account under a policy the server enforces: which operations (read, trade, pay, swap), a per-call cap, a daily cap and a coin allowlist. Five endpoints cover state, orders, pay, swap and invoice.",
  },
  {
    q: "Is it safe?",
    a: "The agent trades through a Hyperliquid wallet approved with trading-only rights. It can place and cancel orders and can never withdraw. The platform holds no keys and no funds; the worst case is the trading budget, shown on screen.",
  },
  {
    q: "Paper mode or live mode?",
    a: "Paper mode uses real market data and simulated fills, and the account persists across cold starts. Approve the agent wallet on Hyperliquid and the same endpoints switch to live mode without a code change.",
  },
  {
    q: "How are the limits enforced?",
    a: "On the server, per key. The key's policy is the first gate (403 on a violation) and the platform risk envelope is the second (positions, leverage, stop-loss, daily breakers; 409 on a refusal). A refusal is final for the request.",
  },
  {
    q: "What happens when an order is refused?",
    a: "A 403 means the key's policy said no; a 409 means the platform guard did. The response carries the reason and the agent is never touched. Do not retry it unchanged.",
  },
  {
    q: "What does it cost?",
    a: "The sandbox is free. Live plans start at $199/mo (Builder) and $999/mo (Growth); without a plan, executed orders are billed at 8 bps of notional, invoiced monthly. Paid plans replace the per-order fee.",
  },
  {
    q: "Can I self-host the whole thing?",
    a: "The client surface is open source under MIT: SDK, tool manifest, MCP proxy and framework examples. The policy and risk engine are hosted; you integrate with them rather than forking them.",
  },
  {
    q: "Where do I integrate from?",
    a: "Any language over HTTP, the TypeScript SDK, a framework tool manifest (Vercel AI SDK, LangChain, Mastra, elizaOS), the MCP server, or the hosted MCP endpoint for MCP hosts.",
  },
]

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: "en",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />

      <div className="mx-auto w-full max-w-5xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-16 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ help ]</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] max-w-3xl">
          Build on the execution layer for AI agents
        </h1>
        <p className="mt-6 text-lg text-[#6F6B64] leading-relaxed max-w-[62ch]">
          One key, one server-enforced policy, five endpoints. This page is the short version: how to start, what the
          server enforces, what it costs, and where the deeper docs are.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
          >
            Create an API key <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] px-5 py-3 text-sm hover:bg-white transition"
          >
            Quickstart
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] px-5 py-3 text-sm hover:bg-white transition"
          >
            Docs (中文 / English)
          </Link>
        </div>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ start in five minutes ]</p>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="rounded-lg border border-[#E4E2DD] bg-white p-5">
                <step.icon className="h-4 w-4 text-[#6F6B64]" />
                <h2 className="mt-3 text-sm font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6F6B64]">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ the five endpoints ]</p>
          <div className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                <tr>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">What it does</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([endpoint, meaning]) => (
                  <tr key={endpoint} className="border-b border-[#F0EEE9] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{endpoint}</td>
                    <td className="px-4 py-3 text-[#6F6B64]">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[#6F6B64]">
            Base URL <span className="font-mono">https://protocolbanks.com/api/v1/agent</span> · auth{" "}
            <span className="font-mono">Authorization: Bearer pb_…</span> · full reference at{" "}
            <Link href="/docs/api" className="underline underline-offset-2 hover:text-[#111111]">
              /docs/api
            </Link>
            .
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ why it is safe ]</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {SAFETY.map((item) => (
              <div key={item.title} className="flex gap-3 border-b border-[#E4E2DD] pb-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1F7A4D]" />
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#6F6B64]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ the demo ]</p>
          <p className="max-w-[72ch] text-sm leading-relaxed text-[#6F6B64]">
            The cockpit at{" "}
            <Link href="/trading" className="underline underline-offset-2 hover:text-[#111111]">
              /trading
            </Link>{" "}
            is a paper agent your key can drive: balance, equity curve, positions, and a plain-language feed. It is the
            demo, not the pitch — production integrations call the API. The public{" "}
            <Link href="/live-track-record" className="underline underline-offset-2 hover:text-[#111111]">
              track record
            </Link>{" "}
            shows every live account, wins and losses.
          </p>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ tools and plans ]</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#E4E2DD] bg-white p-5">
              <Code2 className="h-4 w-4 text-[#6F6B64]" />
              <h3 className="mt-3 text-sm font-semibold">Open client</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6F6B64]">
                The SDK, tool manifest and MCP proxy are MIT-licensed.{" "}
                <a
                  href="https://github.com/everest-an/protocolbanks-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#111111]"
                >
                  github.com/everest-an/protocolbanks-sdk
                </a>
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E2DD] bg-white p-5">
              <span className="font-mono text-[11px] text-[#6F6B64]">$0 → $999/mo</span>
              <h3 className="mt-3 text-sm font-semibold">Plans</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6F6B64]">
                Sandbox is free. Live plans start at $199/mo, or pay 8 bps per executed order.{" "}
                <Link href="/pricing" className="underline underline-offset-2 hover:text-[#111111]">
                  See pricing
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ questions ]</p>
          <div className="space-y-6 max-w-[76ch]">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6F6B64]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold">Still deciding?</p>
              <p className="mt-1 text-sm text-[#6F6B64]">
                Tell us the agent, the venue and the worst case you can live with. We will size the policy.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
            >
              Talk to us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
