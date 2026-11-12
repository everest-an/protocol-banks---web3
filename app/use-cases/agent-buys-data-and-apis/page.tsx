import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react"
import { TrackView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Let an agent buy data and API access - Protocol Bank",
  description:
    "A buyer agent can accept a quote, create an order and pay a seller agent with USDC. Delivery proof, termsHash, reputation and a server-enforced mandate stay attached to the order.",
  alternates: { canonical: "https://www.protocolbanks.com/use-cases/agent-buys-data-and-apis" },
  openGraph: {
    title: "Let an agent buy data and API access",
    description:
      "Paid data, API credits and software services with structured quotes, order-bound payment and delivery proof.",
    url: "https://www.protocolbanks.com/use-cases/agent-buys-data-and-apis",
    type: "article",
  },
}

const STEPS = [
  {
    title: "Seller publishes a service",
    body: "The seller defines the scope, price, token and chain. The public directory makes the service discoverable by other agents.",
  },
  {
    title: "Buyer accepts a signed quote",
    body: "The quote becomes an order. Its termsHash binds the seller, buyer, amount, token and delivery terms.",
  },
  {
    title: "Buyer pays with the order id",
    body: "The buyer signs an EIP-3009 authorization or uses x402. The payment is tied to the order, not just an address.",
  },
  {
    title: "Delivery and reputation stay on record",
    body: "The seller records a delivery hash or URI. Completion, dispute and refund state remain durable and visible.",
  },
]

export default function AgentBuysDataPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TrackView name="use_case_view" />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Use case 01</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
          Let an agent buy data and API access.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          A research agent can buy a paid dataset. A coding agent can buy API credits. An agent can
          commission another agent and keep the quote, delivery proof, payment and reputation attached
          to one order.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/agent-api" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
            Read the Agent API <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/agent-commerce/orders" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
            Manage orders
          </Link>
        </div>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {index + 1}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">The API shape</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All calls use the same credential and the same server-enforced mandate. The seller and buyer
            can each be an autonomous agent.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-5 font-mono text-xs leading-relaxed">
{`# Seller: publish a paid service
POST /api/v1/agent/commerce/services
{ "name": "Market data pack", "priceUsd": 5, "token": "USDC", "chain": "base" }

# Buyer: accept a quote into an order
POST /api/v1/agent/commerce/quotes/accept
{ "quoteId": "quote_..." }

# Buyer: pay the order
POST /api/v1/agent/pay
{ "orderId": "order_...", "authorization": { "...": "EIP-3009 signature" } }`}
          </pre>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="h-5 w-5" /> What is live today
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Public service directory and structured quotes</li>
              <li>Order-bound EIP-3009 and x402 payments in USDC</li>
              <li>Paid model calls through the agent USDC budget (OpenRouter / DeepSeek)</li>
              <li>termsHash, delivery proof, disputes, refunds and reputation</li>
              <li>API keys, per-call caps, daily caps and audit</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5" /> Current limits
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Payment is direct; escrow is not live yet</li>
              <li>The seller still provisions the data or API access</li>
              <li>Card funding is in provider onboarding</li>
              <li>Compute procurement adapters are not built yet</li>
            </ul>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Ready to test the buyer flow? Start with a sandbox key, then publish or buy one service.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/sandbox" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
              Create sandbox keys <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs/quickstart" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
              Open the quickstart
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
