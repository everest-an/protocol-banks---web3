import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Best AI Trading Bots 2026: Non-Custodial vs Custodial Compared",
  description:
    "How to evaluate AI trading bots in 2026: custody model, withdrawal rights, strategy transparency, and risk controls. Non-custodial agents vs custodial funds compared.",
  openGraph: {
    title: "Best AI Trading Bots 2026: What Actually Matters",
    description:
      "The evaluation framework for AI trading bots: who holds your funds, can the bot withdraw, is the strategy transparent, and what risk controls exist.",
  },
}

const COMPARISON = [
  {
    dimension: "Who holds your funds?",
    custodial: "The platform holds deposits in its own wallets",
    nonCustodial: "Funds stay in your own account structure",
  },
  {
    dimension: "Can the bot withdraw?",
    custodial: "Yes — you trust the operator completely",
    nonCustodial: "No — trading-only permissions, withdrawals require your signature",
  },
  {
    dimension: "Strategy transparency",
    custodial: "Often a black box",
    nonCustodial: "Every trade explained in plain language",
  },
  {
    dimension: "Maximum loss",
    custodial: "Can exceed your deposit (leverage, liquidation rules)",
    nonCustodial: "Your trading budget — visible on screen",
  },
  {
    dimension: "Stopping it",
    custodial: "Request withdrawal and wait",
    nonCustodial: "One-click pause, emergency stop, on-chain revocation",
  },
]

const FAQ = [
  {
    q: "What should I look for in an AI trading bot?",
    a: "Four things: custody (do you keep control of your funds?), withdrawal rights (can the bot move money out?), strategy transparency (do you know why it trades?), and risk controls (stop-losses, position caps, circuit breakers).",
  },
  {
    q: "Are non-custodial trading bots safer?",
    a: "Structurally yes: the bot can never withdraw your funds and you can revoke it anytime. Trading losses are still possible, so budget them explicitly.",
  },
  {
    q: "Do AI trading bots actually make money?",
    a: "Some do, most don't, and past performance never guarantees future returns. Treat any bot as an automation tool with hard risk limits — never as a guaranteed income source.",
  },
]

export default function BestBotsGuide() {
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
          Best AI Trading Bots 2026: What Actually Matters
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: August 2026 · 6 min read</p>

        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-5 mb-8">
          <p className="text-sm font-semibold text-primary mb-1">TL;DR</p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            When comparing AI trading bots, the single most important question is <strong>who holds the funds</strong>.
            A non-custodial bot trades through a <strong>trading-only agent wallet</strong> — it can enter and exit
            positions but has no withdrawal rights. That's more important than claimed win rates. Look for transparent
            trade explanations, enforced stop-losses, and free paper trading you can verify before committing money.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">Forget "best" — start with the custody question</h2>
            <p>
              &quot;Best AI trading bot&quot; lists usually rank marketing, not architecture. The single most important
              question is: <strong>who holds your funds, and what can the bot do with them?</strong> Everything else —
              returns, features, fees — comes second.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Custodial vs non-custodial bots</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 font-semibold">Dimension</th>
                    <th className="text-left py-2 pr-4 font-semibold">Custodial</th>
                    <th className="text-left py-2 font-semibold">Non-custodial</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.dimension} className="border-b border-white/5 align-top">
                      <td className="py-2.5 pr-4 font-medium">{row.dimension}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.custodial}</td>
                      <td className="py-2.5">{row.nonCustodial}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">The four-question checklist</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Custody:</strong> do your funds stay in your own account, or are you depositing into the
                platform&apos;s wallets?
              </li>
              <li>
                <strong>Withdrawal rights:</strong> can the bot move money off the platform, or is it trading-only?
              </li>
              <li>
                <strong>Transparency:</strong> do you see why each trade happened, or is it a black box?
              </li>
              <li>
                <strong>Risk controls:</strong> are stop-losses, position caps, and circuit breakers enforced before
                orders — or are they suggestions?
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How Protocol Bank answers those questions</h2>
            <p>
              Non-custodial (funds stay in your Hyperliquid account). Trading-only agent wallet (no withdrawals, ever).
              Fully transparent (every trade logged in plain language). Hard risk controls (±2.5% stop-losses, position
              caps, daily circuit breakers).
            </p>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Judge it yourself — paper trading is free →
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
