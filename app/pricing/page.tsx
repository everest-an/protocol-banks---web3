import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Check } from "lucide-react"
import { PlanCheckoutButton } from "@/components/plan-checkout-button"

export const metadata: Metadata = {
  title: "Pricing — agent execution with a server-enforced cap",
  description:
    "Start free in paper mode. Plans for teams that trade live: per-call and daily caps, more keys, priority support. No plan? Pay 8 bps on executed notional.",
  alternates: { canonical: "https://protocolbanks.com/pricing" },
}

const PLANS = [
  {
    name: "Sandbox",
    price: "$0",
    period: "forever",
    blurb: "The full API against a paper account with real market data.",
    cta: { label: "Create a key", href: "/settings/api-keys" },
    checkout: null,
    featured: false,
    features: [
      "1 API key",
      "Paper account ($500 simulated)",
      "$50 per call · $200 per day",
      "state · orders · pay · swap · invoice",
      "Community support (GitHub issues)",
    ],
  },
  {
    name: "Builder",
    price: "$199",
    period: "per month",
    blurb: "One team, live trading, a real budget on the line.",
    cta: { label: "Subscribe", href: "/settings/api-keys" },
    checkout: "builder" as const,
    featured: false,
    features: [
      "3 API keys",
      "Live trading (approved agent wallet)",
      "$500 per call · $5,000 per day",
      "Usage + fee report per key",
      "Email support, 2 business days",
    ],
  },
  {
    name: "Growth",
    price: "$999",
    period: "per month",
    blurb: "A product with paying users of its own.",
    cta: { label: "Subscribe", href: "/settings/api-keys" },
    checkout: "growth" as const,
    featured: true,
    features: [
      "10 API keys",
      "$2,500 per call · $50,000 per day",
      "Coin allowlists per key",
      "Monthly invoice + usage export",
      "Priority support, 1 business day",
    ],
  },
  {
    name: "Scale",
    price: "from $4,999",
    period: "per month",
    blurb: "White-label execution, custom caps, an SLA.",
    cta: { label: "Talk to us", href: "/contact" },
    checkout: null,
    featured: false,
    features: [
      "Unlimited keys",
      "Custom caps and risk envelope",
      "Onboarding + runbook",
      "Named contact, SLA agreed in the order form",
      "Invoice or annual contract",
    ],
  },
]

const COMPARE = [
  { feature: "API keys", sandbox: "1", builder: "3", growth: "10", scale: "Unlimited" },
  { feature: "Mode", sandbox: "Paper", builder: "Paper + live", growth: "Paper + live", scale: "Paper + live" },
  { feature: "Per-call cap", sandbox: "$50", builder: "$500", growth: "$2,500", scale: "Custom" },
  { feature: "Daily cap", sandbox: "$200", builder: "$5,000", growth: "$50,000", scale: "Custom" },
  { feature: "Per-key coin allowlist", sandbox: "—", builder: "✓", growth: "✓", scale: "✓" },
  { feature: "Usage + fee report", sandbox: "—", builder: "✓", growth: "✓", scale: "✓" },
  { feature: "Support", sandbox: "Community", builder: "2 business days", growth: "1 business day", scale: "Named contact" },
]

const FAQ = [
  {
    q: "What is the 8 bps?",
    a: "Pay-as-you-go pricing: without a plan, executed orders are billed at 8 basis points of notional (0.08%), invoiced monthly. Plans replace the per-order fee and raise the caps.",
  },
  {
    q: "Does a plan let the agent withdraw funds?",
    a: "No. Trading executes through a Hyperliquid agent wallet with trading-only rights: it can place and cancel orders, never withdraw. The funded trading budget is the maximum loss.",
  },
  {
    q: "Can I start before going live?",
    a: "Yes. Sandbox runs the same endpoints against a paper account with real market data and simulated fills. The policy is enforced the same way, so the same code goes live unchanged once the agent wallet is approved.",
  },
  {
    q: "How are caps enforced?",
    a: "On the server, per key: operations, per-call cap, daily cap, coin allowlist. A call over the cap is refused with 403 and never reaches the venue. The plan sets the ceiling; you choose the numbers under it.",
  },
  {
    q: "Do you offer annual pricing?",
    a: "Yes — two months free on annual prepay. Ask on the contact form.",
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-16 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ pricing ]</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] uppercase max-w-3xl">
          Pay for execution. Not for hope.
        </h1>
        <p className="mt-6 text-lg text-[#6F6B64] leading-relaxed max-w-[62ch]">
          Sandbox is free and runs the real API against simulated money. When you are ready to trade a budget, a plan
          raises the caps and gives you a human to call. No plan? Pay 8 bps on what actually executes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
          >
            Start in sandbox <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/agent-api"
            className="inline-flex items-center gap-2 rounded-md border border-[#E4E2DD] bg-transparent px-5 py-3 text-sm hover:bg-white transition"
          >
            Read the API docs
          </Link>
        </div>

        <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-lg border bg-white p-6 ${
                plan.featured ? "border-[#111111] shadow-[0_1px_0_#111111]" : "border-[#E4E2DD]"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{plan.name}</h2>
                {plan.featured ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">popular</span>
                ) : null}
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                <span className="ml-2 text-xs text-[#6F6B64]">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-[#6F6B64] leading-relaxed min-h-[3rem]">{plan.blurb}</p>
              {plan.checkout ? (
                <PlanCheckoutButton plan={plan.checkout} label={plan.cta.label} featured={plan.featured} />
              ) : (
                <Link
                  href={plan.cta.href}
                  className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
                    plan.featured
                      ? "bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
                      : "border border-[#E4E2DD] hover:bg-[#F7F6F3]"
                  }`}
                >
                  {plan.cta.label}
                </Link>
              )}
              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111111]" />
                    <span className="text-[#6F6B64]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <p className="mt-5 text-xs text-[#6F6B64]">
          Pay-as-you-go: 8 bps of executed notional, invoiced monthly, no minimum. Plans replace the per-order fee.
          Launch pricing — annual prepay is two months free.
        </p>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ compare ]</p>
          <div className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                <tr>
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Sandbox</th>
                  <th className="px-4 py-3">Builder</th>
                  <th className="px-4 py-3">Growth</th>
                  <th className="px-4 py-3">Scale</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature} className="border-b border-[#F0EEE9] last:border-0">
                    <td className="px-4 py-3 text-[#6F6B64]">{row.feature}</td>
                    <td className="px-4 py-3">{row.sandbox}</td>
                    <td className="px-4 py-3">{row.builder}</td>
                    <td className="px-4 py-3">{row.growth}</td>
                    <td className="px-4 py-3">{row.scale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ questions ]</p>
          <div className="space-y-6 max-w-[76ch]">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-1.5 text-sm text-[#6F6B64] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[#E4E2DD] pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold">Not sure which cap is right?</p>
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
