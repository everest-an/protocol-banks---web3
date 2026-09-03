import Link from "next/link"
import {
  Wallet,
  Bot,
  TrendingUp,
  Shield,
  PiggyBank,
  OctagonX,
  HelpCircle,
  ArrowRight,
  Check,
} from "lucide-react"

const STEPS = [
  {
    icon: Wallet,
    step: "1",
    title: "Connect your wallet",
    text: "Click Connect Wallet in the top right and approve the MetaMask prompt. Your keys never leave your device — we sign in via SIWE (Sign-In with Ethereum).",
  },
  {
    icon: PiggyBank,
    step: "2",
    title: "Fund your trading wallet",
    text: "Paper mode needs nothing. To go live, deposit USDC into your Hyperliquid account and give the AI a budget you're comfortable risking.",
  },
  {
    icon: Bot,
    step: "3",
    title: "The AI trades. You watch.",
    text: "The agent scans real Hyperliquid markets 24/7, opens and closes positions, and reports every move in plain language on the cockpit.",
  },
]

const COCKPIT = [
  { title: "Total Assets", text: "Your combined balance across the main wallet and the trading wallet, plus today's PnL." },
  { title: "Main Wallet vs Trading Wallet", text: "The main wallet is yours alone — the AI can never touch it. The trading wallet holds the budget the AI may trade, and it's also your maximum possible loss." },
  { title: "Equity Curve", text: "Your account value over time. Switch between 7-day and 30-day views." },
  { title: "What the AI is doing", text: "A natural-language feed: every scan, entry, exit, and risk decision, with reasons and PnL." },
  { title: "Open Positions", text: "Current positions with direction, leverage, entry/mark price, and unrealized PnL." },
  { title: "Controls", text: "Pause AI stops new entries (existing positions are still managed). Emergency Stop halts trading entirely. Reset restarts the paper account." },
]

const RISK_CONTROLS = [
  { title: "Take-profit / Stop-loss", text: "Every position carries a +2.5% take-profit and a -2.5% stop-loss, enforced before any order goes out." },
  { title: "Position limits", text: "At most 3 concurrent positions, each sized at ~15% of the trading wallet." },
  { title: "Daily loss circuit breaker", text: "A 5% daily loss stops new entries for the day; an 8% loss closes everything." },
  { title: "No withdrawal rights", text: "The AI's agent wallet is approved with trading-only permissions on Hyperliquid. It can never move funds off the exchange." },
  { title: "Revoke anytime", text: "You can revoke the agent's permissions on Hyperliquid at any moment — and we delete our key material on request." },
]

const FAQ = [
  {
    q: "Is this safe?",
    a: "The core safety property is that the AI can trade but never withdraw. Your main wallet is never exposed, the trading wallet is the maximum you can lose, and every order passes through pre-configured risk limits.",
  },
  {
    q: "What's the difference between paper and live mode?",
    a: "Paper mode uses real Hyperliquid market data with simulated money — zero risk, ideal for watching the agent work. Live mode trades your actual USDC after you approve the agent wallet.",
  },
  {
    q: "Which wallets are supported?",
    a: "MetaMask and other injected EVM wallets. Hyperliquid funding happens through Arbitrum, which MetaMask supports natively.",
  },
  {
    q: "What does the AI actually trade?",
    a: "The most liquid perpetual markets on Hyperliquid, using two signals: 24-hour momentum (risk-adjusted trend) and funding-rate carry. It's long/short with strict size and stop rules.",
  },
  {
    q: "How do I withdraw profits?",
    a: "Use the Withdraw Profit button in the cockpit to sweep available funds from the trading wallet back to your main wallet. You can also withdraw from Hyperliquid to your wallet at any time.",
  },
  {
    q: "What happens if the AI loses money?",
    a: "Losses are capped by the stop-loss on every position and the daily circuit breakers. The worst case is losing your trading-wallet budget — never more, and never your main wallet.",
  },
]

export default function HelpPage() {
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
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-4xl">
        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <HelpCircle className="h-4 w-4" />
            <span>Usage Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Let the AI trade. <span className="text-primary">Keep control.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            From wallet to working agent in minutes — no trading knowledge required.
            Everything below is written for first-time users.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Last updated: August 2026</p>

          <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-5 mt-6">
            <p className="text-sm font-semibold text-primary mb-1">TL;DR</p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Connect MetaMask, set a trading budget on Hyperliquid, approve a <strong>trading-only agent
              wallet</strong> (EIP-712), and the AI trades momentum + funding-carry signals 24/7. The agent can trade
              but never withdraw — your funds stay in your own wallet, and the worst case is the budget you choose,
              shown on screen. Start with free paper trading to watch the agent work risk-free before going live.
            </p>
          </div>
        </div>

        {/* Getting started */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">How do I get started?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.step} className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-3xl font-bold text-foreground/10">{s.step}</span>
                </div>
                <h3 className="font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/trading">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Open the cockpit <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Cockpit guide */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">How does the cockpit work?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {COCKPIT.map((c) => (
              <div key={c.title} className="flex gap-3 p-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-xl">
                <div className="p-1 rounded-full bg-emerald-500/10 mt-0.5 h-fit">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{c.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Going live */}
        <section className="mb-14">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">How do I go live with real funds?</h2>
            </div>
            <ol className="space-y-4 text-sm sm:text-base text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1. Fund Hyperliquid.</span>{" "}
                Deposit USDC to your wallet address at app.hyperliquid.xyz (Arbitrum bridge via MetaMask).
              </li>
              <li>
                <span className="font-medium text-foreground">2. Create the agent wallet.</span>{" "}
                On the cockpit&apos;s Go Live card, click Create. We generate a key for the agent and encrypt it.
              </li>
              <li>
                <span className="font-medium text-foreground">3. Sign the approval.</span>{" "}
                MetaMask will ask you to sign a Hyperliquid approveAgent message. This grants
                trading-only rights — no withdrawals, ever.
              </li>
              <li>
                <span className="font-medium text-foreground">4. Watch and withdraw.</span>{" "}
                The agent starts trading. Sweep profits back to your main wallet anytime, or revoke the agent on Hyperliquid.
              </li>
            </ol>
          </div>
        </section>

        {/* Risk controls */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">What risk controls protect my funds?</h2>
          </div>
          <div className="space-y-4">
            {RISK_CONTROLS.map((r) => (
              <div key={r.title} className="flex gap-4 p-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-xl">
                <div className="p-2 rounded-lg bg-primary/10 h-fit shrink-0">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">FAQ</h2>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-xl p-5">
                <h3 className="font-semibold mb-1.5 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  {f.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <h2 className="text-2xl font-bold mb-3">Ready to try it?</h2>
          <p className="text-muted-foreground mb-6">Paper trading is free and uses real market data.</p>
          <div className="flex justify-center gap-3">
            <Link href="/trading">
              <span className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors">
                <Bot className="h-4 w-4" />
                Open AI Trading
              </span>
            </Link>
            <Link href="/">
              <span className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-white/5 transition-colors">
                <OctagonX className="h-4 w-4" />
                Back Home
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
