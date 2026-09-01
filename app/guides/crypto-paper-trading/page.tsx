import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crypto Paper Trading: Practice With Real Market Data (2026)",
  description:
    "What crypto paper trading is, why it's the safest way to test an AI trading agent, and how to paper trade on real Hyperliquid market data with simulated money.",
  openGraph: {
    title: "Crypto Paper Trading: Practice With Real Market Data",
    description:
      "Paper trading runs an AI agent on live market data with simulated money — the zero-risk way to validate a strategy before going live.",
  },
}

const FAQ = [
  {
    q: "What is crypto paper trading?",
    a: "Paper trading simulates trades using real market data and a virtual balance. You test strategies, learn execution mechanics, and measure performance — without risking real money.",
  },
  {
    q: "How is paper trading different from live trading?",
    a: "The prices, signals, and fills model are identical; only the money is simulated. The main difference in live mode is real slippage, funding costs, and psychological pressure.",
  },
  {
    q: "How long should I paper trade before going live?",
    a: "At least one to two weeks, ideally covering both calm and volatile market conditions. Look at drawdowns, win rate, and how the strategy behaves in stress — not just total return.",
  },
]

export default function PaperTradingGuide() {
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
          Crypto Paper Trading: Practice With Real Market Data
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: August 2026 · 5 min read</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold mb-3">What is crypto paper trading?</h2>
            <p>
              Paper trading is a simulation: your account gets a virtual balance, trades execute at real market prices,
              and fees and slippage are modeled — but no real money moves. It&apos;s the standard way professional
              traders validate a system before risking capital.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">Why paper trade an AI agent first</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>See the strategy&apos;s real behavior</strong> — win rate, drawdowns, how it reacts to
                volatility — on live market data.
              </li>
              <li>
                <strong>Learn to read the signals</strong> — understand why the agent enters and exits before real
                money depends on it.
              </li>
              <li>
                <strong>Build trust in the safety rails</strong> — watch stop-losses and circuit breakers fire in
                practice, not in theory.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">How to paper trade with Protocol Bank</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Open the AI trading cockpit — no wallet needed for the demo account.</li>
              <li>The agent scans real Hyperliquid markets and executes simulated trades automatically.</li>
              <li>Watch the plain-language activity feed: every entry, exit, and risk decision explained.</li>
              <li>Connect your wallet for your own private paper account before considering live mode.</li>
            </ol>
            <p className="mt-3">
              <Link href="/trading" className="text-primary underline">
                Start paper trading →
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">When to go live</h2>
            <p>
              After at least a week or two, if you understand the strategy, accept its drawdowns, and are comfortable
              losing the entire budget you plan to allocate — then consider live mode with a small amount.
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
            Related:{" "}
            <Link href="/guides/ai-crypto-trading" className="underline">
              AI crypto trading guide
            </Link>{" "}
            ·{" "}
            <Link href="/guides/is-ai-trading-safe" className="underline">
              Is AI trading safe?
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
