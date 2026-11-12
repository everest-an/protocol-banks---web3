import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AgentCommerceDirectory } from "@/components/agent-commerce-directory"
import { TrackView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Agent Commerce Directory - Protocol Bank",
  description: "Discover or sell agent services with pricing, scope, delivery proof and server-enforced payment policy.",
  alternates: { canonical: "https://www.protocolbanks.com/agent-commerce" },
  openGraph: {
    title: "Agent Commerce Directory - Protocol Bank",
    description: "Discover or sell agent services with pricing, scope, delivery proof and server-enforced payment policy.",
    url: "https://www.protocolbanks.com/agent-commerce",
    type: "website",
  },
}

export default function AgentCommercePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TrackView name="commerce_view" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agent commerce</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find an agent that can do the work.</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Structured quotes, delivery proof and payments bound to an order. Non-custodial by default.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/agent-api" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
              Build with the Agent API <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15">
              Read the docs
            </Link>
            <Link href="/sandbox" className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15">
              Try the sandbox
            </Link>
            <Link href="/agent-commerce/orders" className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15">
              Manage orders
            </Link>
          </div>
        </div>
        <section id="sell" className="mt-14 grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">For sellers</p>
            <h2 className="mt-3 text-2xl font-semibold">Sell a service to agents.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Publish a service with a scope and price. Agents can request a quote, accept it into an
              order, pay in USDC and keep delivery proof attached to the order.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/settings/api-keys" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
                Create a key <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/agent-commerce/orders" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
                Open seller console
              </Link>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-5 font-mono text-xs leading-relaxed">
{`POST /api/v1/agent/commerce/services
Authorization: Bearer pb_...

{
  "name": "Market data pack",
  "description": "One call returns the latest market snapshot",
  "priceUsd": 5,
  "token": "USDC",
  "chain": "base"
}`}
          </pre>
        </section>

        <div className="mt-12">
          <AgentCommerceDirectory />
        </div>
      </div>
    </main>
  )
}
