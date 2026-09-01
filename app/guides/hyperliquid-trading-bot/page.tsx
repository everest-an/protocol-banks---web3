import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Hyperliquid Trading Bot: Non-Custodial AI Automation Explained",
  description:
    "How Hyperliquid agent wallets enable non-custodial trading bots: approveAgent permissions, momentum and funding-carry signals, and how to run an AI trading agent with paper trading first.",
  openGraph: {
    title: "Hyperliquid Trading Bot: Non-Custodial AI Automation",
    description:
      "How trading-only agent wallets on Hyperliquid let an AI trade your budget without ever being able to withdraw it.",
  },
}

const FAQ = [
  {
    q: "Can a Hyperliquid trading bot withdraw my funds?",
    a: "Not if it uses a trading-only agent wallet. approveAgent grants an agent permission to trade on your account, not to withdraw. Withdrawals require your own wallet signature, and you can revoke the agent at any time.",
  },
  {
    q: "How do I run a trading bot on Hyperliquid?",
    a: "Fund your Hyperliquid account with USDC, approve a trading-only agent wallet, and let the bot run a strategy (such as momentum plus funding carry). Start with paper trading to validate the strategy before risking real funds.",
  },
  {
    q: "What strategies work on Hyperliquid trading bots?",
    a: "Common approaches are momentum (risk-adjusted trend scores), funding-rate carry, and market-making. Simple, transparent strategies with hard stop-losses and daily circuit breakers are easier to trust than black-box models.",
  },
]

export default function HyperliquidBotGuide() {
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
          Hyperliquid Trading Bot: Non-Custodial AI Automation Explained
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: August 2026 · 6 min read</p>

        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-5 mb-8">
          <p className="text-sm font-semibold text-primary mb-1">TL;DR</p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            A Hyperliquid trading bot automates trading on Hyperliquid perpetual markets. The key architectural risk
            point is <strong>key custody</strong>: a non-custodial bot uses <strong>trading-only agent wallets</strong>
            approved via EIP-712 — it can open and close positions but has no withdrawal rights. Combined with
            stop-losses and circuit breakers, the bot's worst case is capped to the budget you allocate, and you can
            revoke it on-chain at any time.
          </p>
        </div>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">Why Hyperliquid is the natural home for AI trading</h2>
            <p>
              Hyperliquid is a performant Layer 1 built for perpetual futures with deep liquidity, low latency, and —
              critically — a native <strong>agent wallet</strong> system. That system is what makes non-custodial
              trading bots possible: you can delegate trading without ever delegating withdrawals.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">The key primitive: approveAgent</h2>
            <p>
              With one signed message (EIP-712, signed in MetaMask), you approve an <em>agent address</em> on your
              account. That agent can:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Place and cancel orders on your behalf</li>
              <li>Trade within the account&apos;s equity</li>
              <li className="font-medium">Never withdraw — withdrawal rights remain exclusively yours</li>
            </ul>
            <p className="mt-3">
              Revocation is equally simple: remove the agent, and it loses trading ability instantly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">What Protocol Bank&apos;s agent actually does</h2>
            <p>
              The agent runs two transparent signals over the top-12 Hyperliquid perpetuals by 24h volume:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Momentum</strong> — 24h risk-adjusted return z-score (trend strength divided by volatility)
              </li>
              <li>
                <strong>Funding carry</strong> — the size and direction of Hyperliquid&apos;s hourly funding rate
              </li>
            </ul>
            <p className="mt-3">
              Risk is enforced before every order: ±2.5% take-profit/stop-loss, ~15% position sizing, max 3 concurrent
              positions, and daily circuit breakers (5% stops new entries, 8% closes all).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Start with paper trading</h2>
            <p>
              The agent can run on real Hyperliquid market data with simulated money — same signals, same fills
              model, zero risk. Watch it for a week before going live.
            </p>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Try it free →
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
            Educational content, not financial advice. Read the{" "}
            <Link href="/risk-disclosure" className="underline">
              Risk Disclosure
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
