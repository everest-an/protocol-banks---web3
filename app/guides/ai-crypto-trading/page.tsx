import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AI Crypto Trading: The Beginner's Guide (2026)",
  description:
    "What is AI crypto trading, how do non-custodial AI trading bots work, and how to start with paper trading on real market data — without giving up control of your funds.",
  openGraph: {
    title: "AI Crypto Trading: The Beginner's Guide (2026)",
    description:
      "How non-custodial AI trading works: trading-only agent wallets, risk guardrails, and how to start paper trading on real market data.",
  },
}

const FAQ = [
  {
    q: "What is AI crypto trading?",
    a: "AI crypto trading uses automated algorithms to scan markets, generate trading signals, and execute trades. A non-custodial AI trading agent holds trading-only permissions — it can open and close positions but can never withdraw funds from your account.",
  },
  {
    q: "Can an AI trading bot withdraw my crypto?",
    a: "Not with the right architecture. On Hyperliquid, agent wallets are approved with trading-only permissions (approveAgent). The AI can trade within your budget but has no withdrawal rights — you can also revoke its access at any time.",
  },
  {
    q: "How much money do I need to start AI trading?",
    a: "Nothing, if you start with paper trading — simulated money on real market data. For live mode you fund a trading budget you are comfortable risking; the budget is also your maximum possible loss.",
  },
  {
    q: "Is AI crypto trading profitable?",
    a: "No strategy guarantees profit. AI trading executes a strategy (momentum and funding-carry signals, for example) with stop-losses and circuit breakers — but crypto markets are volatile and losses are possible. Past performance never guarantees future results.",
  },
  {
    q: "What are the risks of AI crypto trading?",
    a: "The main risks are market volatility, liquidation, exchange outages, and software bugs. A responsible setup enforces per-trade stop-losses, position caps, and daily loss circuit breakers — and limits the AI to a trading budget that you choose.",
  },
]

export default function AiCryptoTradingGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
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
          AI Crypto Trading: The Beginner&apos;s Guide
        </h1>
        <p className="text-muted-foreground mb-8">Updated August 2026 · 6 min read</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">What is AI crypto trading?</h2>
            <p>
              AI crypto trading means letting software analyze markets and execute trades automatically. Instead of
              watching charts all day, you define a budget and rules — the AI handles scanning, signals, and execution.
            </p>
            <p className="mt-3">
              Most people hear &quot;trading bot&quot; and picture a black box that takes your money. The better design is
              the opposite: a <strong>non-custodial agent</strong> that can trade within a budget you choose, but can
              never withdraw your funds, and can be stopped or revoked at any moment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How non-custodial AI trading works</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Connect your wallet</strong> — sign in with MetaMask (SIWE, no password, keys never leave your
                device).
              </li>
              <li>
                <strong>Fund a trading budget</strong> — deposit USDC to Hyperliquid. This budget is the maximum the AI
                can trade — and your maximum possible loss.
              </li>
              <li>
                <strong>Approve a trading-only agent wallet</strong> — one EIP-712 signature in MetaMask grants the AI
                permission to trade, not withdraw.
              </li>
              <li>
                <strong>The AI trades, you watch</strong> — every trade appears in a plain-language feed with the reason
                behind it.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">What strategy does the AI use?</h2>
            <p>
              Protocol Bank&apos;s robust leg uses two signals over Hyperliquid&apos;s most liquid perpetual markets:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Momentum</strong> — a 24-hour risk-adjusted trend score (mean return divided by volatility).
              </li>
              <li>
                <strong>Funding carry</strong> — the direction and size of Hyperliquid&apos;s hourly funding rate.
              </li>
            </ul>
            <p className="mt-3">
              Every position carries a ±2.5% stop-loss/take-profit, position sizes are capped, and daily loss circuit
              breakers pause or close trading automatically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How to start (risk-free)</h2>
            <p>
              Start with <strong>paper trading</strong>: the agent runs on real market data with simulated money. Watch
              it scan, trade, and explain itself for a week. If you like what you see, go live with a small budget.
            </p>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Open the AI trading cockpit →
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
            Read the full{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>{" "}
            before trading with real funds.
          </p>
        </div>
      </div>
    </div>
  )
}
