import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Is AI Trading Safe? How Non-Custodial Bots Protect Your Crypto",
  description:
    "How a non-custodial AI trading agent protects your funds: trading-only permissions, stop-losses, circuit breakers, and why the AI can never withdraw your crypto.",
  openGraph: {
    title: "Is AI Trading Safe? Non-Custodial Trading Bots Explained",
    description:
      "The safety architecture of non-custodial AI trading: trading-only agent wallets, per-trade stop-losses, daily circuit breakers, and instant revocation.",
  },
}

const FAQ = [
  {
    q: "Is AI crypto trading safe?",
    a: "Safety depends on the architecture. A non-custodial setup keeps funds in your own account and grants the AI trading-only permissions — it can trade within a budget but can never withdraw. Combined with per-trade stop-losses and daily circuit breakers, the worst case is the budget you chose.",
  },
  {
    q: "Can the AI withdraw or steal my crypto?",
    a: "No. On Hyperliquid, the agent wallet is approved with trading-only permissions (approveAgent). Withdrawals require your own wallet signature. You can revoke the agent's permissions on-chain at any time.",
  },
  {
    q: "What happens if the AI loses money?",
    a: "Losses are capped: stop-losses close positions at -2.5%, daily circuit breakers pause new entries at -5% and close everything at -8%. The maximum loss is your trading budget — never your main wallet.",
  },
]

export default function AiTradingSafetyGuide() {
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
          Is AI Trading Safe? How Non-Custodial Bots Protect Your Crypto
        </h1>
        <p className="text-muted-foreground mb-8">Updated August 2026 · 5 min read</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">The question behind the question</h2>
            <p>
              &quot;Is AI trading safe?&quot; usually means two things: <em>can the AI steal my money?</em> and{" "}
              <em>can I lose money trading?</em> The answers are different — and a good design answers both before you
              deposit anything.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Can the AI steal your money? No — by construction</h2>
            <p>
              The strongest safety property is structural: the AI never holds your funds. It holds a{" "}
              <strong>trading-only agent wallet</strong> — an address you approve on Hyperliquid that can open and
              close positions but cannot withdraw. Withdrawals always require your own wallet signature.
            </p>
            <p className="mt-3">
              And it&apos;s revocable: remove the agent&apos;s permissions on-chain any time, and it stops being able to
              trade instantly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Can you lose money? Yes — so cap it</h2>
            <p>Trading always carries risk. The honest design caps it:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Trading budget = maximum loss.</strong> The AI only trades the amount you allocate. Your main
                wallet is never touched.
              </li>
              <li>
                <strong>Per-trade stop-loss ±2.5%.</strong> Every position has a hard exit enforced before orders go
                out.
              </li>
              <li>
                <strong>Daily circuit breakers.</strong> A 5% daily loss stops new entries; 8% closes everything.
              </li>
              <li>
                <strong>Position caps.</strong> At most 3 concurrent positions, each sized at ~15% of the budget.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How to verify it yourself — free</h2>
            <p>
              Paper trading runs the exact same agent on real market data with simulated money. Watch every trade,
              reason, and risk decision for a week before risking anything.
            </p>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Try paper trading →
              </Link>{" "}
              ·{" "}
              <Link href="/guides/ai-crypto-trading" className="text-primary underline">
                Beginner&apos;s guide
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
            This page is educational, not financial advice. Read the{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>{" "}
            before live trading.
          </p>
        </div>
      </div>
    </div>
  )
}
