import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "What is Hyperliquid? The Perp DEX Behind AI Trading Bots",
  description:
    "Hyperliquid explained: a performant Layer 1 for perpetual futures with deep liquidity, agent wallets with trading-only permissions, and why it's the natural venue for AI trading.",
  openGraph: {
    title: "What is Hyperliquid? Perp DEX and Agent Wallets Explained",
    description:
      "How Hyperliquid's agent wallet system enables non-custodial AI trading with trading-only permissions.",
  },
}

const FAQ = [
  {
    q: "What is Hyperliquid used for?",
    a: "Hyperliquid is a Layer 1 blockchain purpose-built for perpetual futures trading with deep liquidity and low latency. It also hosts spot markets and a general-purpose EVM (HyperEVM) for DeFi applications.",
  },
  {
    q: "What are Hyperliquid agent wallets?",
    a: "Agent wallets (API wallets) are addresses you approve to act on your account. They can trade but, by default, cannot withdraw — which makes them the foundation for non-custodial trading bots.",
  },
  {
    q: "How do I deposit into Hyperliquid?",
    a: "Deposit USDC from Arbitrum via the bridge (MetaMask). Your Hyperliquid address matches your EVM wallet address.",
  },
]

export default function HyperliquidGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            dateModified: "2026-08-25",
            inLanguage: "en",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Protocol Bank
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-4 tracking-tight">
          What is Hyperliquid? The Perp DEX Behind AI Trading Bots
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: August 2026 · 5 min read</p>

        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-5 mb-8">
          <p className="text-sm font-semibold text-primary mb-1">TL;DR</p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Hyperliquid is a decentralized perpetual futures exchange (perp DEX) — a high-performance order book for
            perps with sub-millisecond matching and its own L1. Its most interesting feature for builders is{" "}
            <strong>agent wallets</strong>: you can grant an automated agent <strong>trading-only permissions</strong>,
            so a bot can trade on your behalf without ever being able to withdraw. That's what makes non-custodial AI
            trading on Hyperliquid possible.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">Hyperliquid in one paragraph</h2>
            <p>
              Hyperliquid is a Layer 1 blockchain designed for <strong>perpetual futures trading</strong>: deep
              liquidity, sub-second settlement, and a full on-chain order book. It&apos;s become the venue of choice for
              serious perp traders — and, thanks to its account model, for non-custodial automation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">The account model that enables safe automation</h2>
            <p>Three primitives matter for AI trading:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Main account</strong> — your deposits and withdrawals. Only you can sign withdrawals.
              </li>
              <li>
                <strong>Agent wallets</strong> — addresses you approve (one signed message) that can trade on your
                behalf but cannot withdraw.
              </li>
              <li>
                <strong>Sub-accounts</strong> — for larger traders, hard-separated budgets that can be pulled back to
                the main account anytime.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Why this matters for AI trading</h2>
            <p>
              Because agent wallets are trading-only by design, an AI can manage your positions around the clock
              without ever being able to move funds off the exchange. Combined with explicit risk controls, the worst
              case is the budget you allocated — not your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Try it without risk</h2>
            <p>
              Protocol Bank&apos;s agent runs on Hyperliquid&apos;s most liquid markets. Paper trading uses real market
              data with simulated money:
            </p>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Start paper trading →
              </Link>{" "}
              ·{" "}
              <Link href="/guides/hyperliquid-trading-bot" className="text-primary underline">
                Hyperliquid bot guide
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">FAQ</h2>
            <div className="space-y-4">
              {FAQ.map((f) => (
                <div key={f.q} className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                  <h3 className="font-semibold mb-1.5">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            Educational content, not financial advice.{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
