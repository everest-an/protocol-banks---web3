import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { SandboxKeys } from "@/components/sandbox-keys"
import { TrackView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Sandbox - try agent commerce without a wallet",
  description:
    "Create two disposable API keys and a live agent-commerce quote in seconds. Read, accept, deliver against the real Protocol Banks API. No wallet, no signup.",
  alternates: { canonical: "https://www.protocolbanks.com/sandbox" },
  openGraph: {
    title: "Sandbox - try agent commerce without a wallet",
    description:
      "Two disposable keys, one live quote, zero setup. Run the buyer and seller side of an agent-commerce order in under a minute.",
    url: "https://www.protocolbanks.com/sandbox",
    type: "article",
  },
}

const STEPS = [
  {
    title: "Create two keys",
    body: "One buyer, one seller. They are scoped to read and commerce writes, capped at $50 per call and per day, and expire in 24 hours.",
  },
  {
    title: "Accept the quote",
    body: "The sandbox pre-creates a $1 quote from the seller to the buyer. Accept it and the server creates an order with a termsHash.",
  },
  {
    title: "Deliver proof",
    body: "The seller records a sha256 delivery hash. The order moves to delivered. Payment and completion need a funded wallet, so they stay outside the sandbox.",
  },
]

export default function SandboxPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <TrackView name="sandbox_view" />
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-16 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ sandbox ]</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] uppercase max-w-3xl">
          Your first agent-commerce order in under a minute
        </h1>
        <p className="mt-6 text-lg text-[#6F6B64] leading-relaxed max-w-[62ch]">
          No wallet, no signup, no sales call. Get two disposable keys and a live quote, then run the buyer and seller
          side against the{" "}
          <span className="text-[#111111] font-medium">real API and the real database</span>.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/agent-api"
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
          >
            Read the API <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            Create a real key
          </Link>
          <a
            href="/api/agent.openapi.json"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            OpenAPI 3.1
          </a>
        </div>

        <section className="mt-12">
          <SandboxKeys />
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ how it works ]</p>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-[#E4E2DD] bg-white p-5">
                <p className="font-mono text-[11px] text-[#6F6B64]">0{index + 1}</p>
                <p className="mt-2 text-sm font-medium">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#6F6B64]">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ what is real ]</p>
          <ul className="space-y-2 text-sm text-[#6F6B64] leading-relaxed max-w-[72ch]">
            <li>
              <span className="text-[#111111] font-medium">The API is real.</span> Keys are validated by the same
              middleware as production; quotes and orders are written to PostgreSQL.
            </li>
            <li>
              <span className="text-[#111111] font-medium">The policy is real.</span> Sandbox keys can read and perform
              commerce writes, but cannot trade, swap or move funds.
            </li>
            <li>
              <span className="text-[#111111] font-medium">The wallets are not.</span> Buyer and seller addresses are
              disposable demo identities. Nobody holds their private keys; never send funds.
            </li>
            <li>
              <span className="text-[#111111] font-medium">Payment is not simulated.</span> Completion requires a
              confirmed payment, which requires a funded wallet and a signed authorization.
            </li>
          </ul>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10 flex flex-wrap items-center gap-6 text-sm">
          <Link href="/agent-commerce" className="text-primary underline">
            Browse agent services
          </Link>
          <Link href="/mcp" className="text-primary underline">
            Use it from Claude
          </Link>
          <a
            href="https://github.com/everest-an/protocol-banks---web3/tree/main/examples/agent-commerce"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Vercel AI SDK / LangChain template
          </a>
          <Link href="/docs/quickstart" className="text-primary underline">
            Quickstart
          </Link>
          <Link href="/risk-disclosure" className="text-primary underline">
            Risk disclosure
          </Link>
        </section>
      </div>
    </main>
  )
}
