import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AI Trading Strategies Explained: Momentum, Funding Carry & More",
  description:
    "How AI trading strategies actually work: momentum scores, funding-rate carry, mean reversion, and the risk controls that separate a real system from a black box.",
  openGraph: {
    title: "AI Trading Strategies Explained (Momentum, Funding Carry)",
    description:
      "The signals behind AI trading: risk-adjusted momentum, funding-rate carry, and why transparent strategies beat black boxes.",
  },
}

const STRATEGIES = [
  {
    name: "Momentum",
    what: "Assets that have been trending tend to keep trending for a while. A risk-adjusted momentum score measures trend strength divided by volatility — strong trends score high, choppy noise scores low.",
    why: "Simple, well-studied, and explainable — every entry can be justified with a number.",
  },
  {
    name: "Funding carry",
    what: "Perpetual markets charge a funding rate between longs and shorts. When funding is strongly negative, shorts pay longs — holding long earns the carry.",
    why: "A slow, persistent edge that compounds when combined with a directional filter.",
  },
  {
    name: "Mean reversion",
    what: "Prices that spike far from their average tend to snap back. The strategy buys dips and sells rips within a range.",
    why: "Works in sideways markets but needs hard stop-losses (it fails in strong trends).",
  },
  {
    name: "Market making",
    what: "Placing bids and asks around the mid price to earn the spread.",
    why: "High frequency, needs deep infrastructure — usually the last strategy to add.",
  },
]

const FAQ = [
  {
    q: "Which AI trading strategy is best for beginners?",
    a: "Momentum with hard stop-losses — it's transparent, easy to understand, and every trade has an explicit reason. Paper trade it first to see the behavior before risking capital.",
  },
  {
    q: "Do AI trading strategies guarantee profit?",
    a: "No. Every strategy has losing periods and can fail in changing market regimes. The goal is a positive expected value with controlled downside — not certainty.",
  },
  {
    q: "What makes a strategy trustworthy?",
    a: "Transparency (you understand the signal), explicit risk controls (stop-losses, position caps), and realistic expectations about drawdowns.",
  },
]

export default function StrategiesGuide() {
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
          AI Trading Strategies Explained
        </h1>
        <p className="text-muted-foreground mb-8">Updated August 2026 · 6 min read</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">The strategies, in plain language</h2>
            <div className="space-y-4">
              {STRATEGIES.map((s) => (
                <div key={s.name} className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
                  <h3 className="font-semibold mb-1.5">{s.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{s.what}</p>
                  <p className="text-sm">
                    <span className="font-medium">Why it&apos;s used:</span> {s.why}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">What Protocol Bank runs</h2>
            <p>
              The robust leg combines <strong>momentum (60%)</strong> and <strong>funding carry (40%)</strong> over
              Hyperliquid&apos;s top-12 perpetuals by volume. The experimental leg explores additional factors with
              small allocations — but the production signal stays simple, transparent, and risk-limited.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1.5">
              <li>Entry: combined score above a calibrated threshold</li>
              <li>Exit: +2.5% take-profit, -2.5% stop-loss, or signal fade</li>
              <li>Position: ~15% of budget, max 3 concurrent</li>
              <li>Daily circuit breakers: 5% stops new entries, 8% closes all</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Why transparency beats black boxes</h2>
            <p>
              A strategy you can explain is a strategy you can trust and improve. When the AI says{" "}
              <em>&quot;opened BTC long (momentum z=1.6, funding -0.001%/h)&quot;</em>, you can verify it against market
              data. Black boxes ask for blind faith.
            </p>
            <p className="mt-3">
              <Link href="/guides/best-ai-trading-bots" className="text-primary underline">
                See the evaluation checklist →
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
