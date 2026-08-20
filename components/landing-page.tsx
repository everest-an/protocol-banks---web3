"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UnicornHero } from "@/components/unicorn-hero"
import { MarketTicker } from "@/components/market-ticker"
import {
  ArrowRight,
  Shield,
  Lock,
  Bot,
  ChevronRight,
  Play,
  Wallet,
  Check,
  Zap,
  TrendingUp,
  OctagonX,
  PiggyBank,
  Activity,
  Clock,
} from "lucide-react"

interface LandingPageProps {
  onConnectWallet: () => void
  onTryDemo: () => void
}

const HOW_IT_WORKS = [
  {
    icon: Wallet,
    step: "1",
    title: "Connect your wallet",
    text: "Sign in with MetaMask or any EVM wallet. Your keys never leave your device.",
  },
  {
    icon: PiggyBank,
    step: "2",
    title: "Fund your trading wallet",
    text: "Move the amount you're comfortable risking into the AI trading wallet. That's your maximum loss — never more.",
  },
  {
    icon: Bot,
    step: "3",
    title: "The AI trades. You watch.",
    text: "The agent scans markets 24/7, opens and closes positions, and reports every move in plain language.",
  },
]

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Proven strategies",
    text: "Momentum and funding-carry signals over real Hyperliquid market data — no hype, just math with guardrails.",
  },
  {
    icon: Shield,
    title: "Risk guardrails built in",
    text: "Position caps, take-profit and stop-loss on every trade, and a daily loss circuit breaker that stops new entries.",
  },
  {
    icon: Activity,
    title: "Full transparency",
    text: "A live feed shows every decision and its reasoning: what the AI did, why, and what it made or lost.",
  },
  {
    icon: OctagonX,
    title: "You can always stop it",
    text: "Pause the agent or hit Emergency Stop anytime. Revoke its access completely — the AI can never withdraw your funds.",
  },
]

export function LandingPage({ onConnectWallet, onTryDemo }: LandingPageProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

        <div className="container mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-36 relative z-10">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-16 items-center">
            {/* Left: Text content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Bot className="h-4 w-4" />
                <span>AI Trading Agent · live on Hyperliquid</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
                Your AI trades.
                <br />
                <span className="text-primary">You keep control.</span>
              </h1>
              <p className="mt-6 sm:mt-8 text-lg sm:text-xl text-muted-foreground leading-relaxed">
                Connect your wallet, fund a trading wallet, and let the agent work real
                markets around the clock. Watch every trade in plain language, sweep
                profits anytime, and stop it with one click.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-10">
                <Button size="lg" onClick={onConnectWallet} className="text-base px-8 py-6">
                  Connect Wallet
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={onTryDemo} className="text-base px-8 py-6">
                  <Play className="mr-2 h-4 w-4" />
                  Try Paper Trading
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Paper mode uses real market data with simulated money. Zero risk, full experience.
              </p>
            </div>

            {/* Right: visual */}
            <div className="hidden lg:block relative aspect-square max-h-[560px] lg:translate-x-4 xl:translate-x-8">
              <UnicornHero />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Metrics Bar */}
      <section className="border-y border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">24/7</p>
              <p className="text-sm text-muted-foreground mt-1">Agent watches the markets</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground mt-1">Withdrawal rights for the AI</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">1-click</p>
              <p className="text-sm text-muted-foreground mt-1">Pause, stop, or sweep profits</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">100%</p>
              <p className="text-sm text-muted-foreground mt-1">Non-custodial by design</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            From wallet to working agent in 3 minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            No strategy configuration, no trading knowledge required. Set a budget,
            and the agent handles the rest.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl transition-all h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-lg bg-primary/10 w-fit">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-4xl font-bold text-foreground/10">{item.step}</span>
              </div>
              <h3 className="text-base font-semibold mb-1.5">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Why it&apos;s safe</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built so the worst case is written on the screen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Every dollar the AI can trade is a dollar you chose to allocate.
              Every limit is enforced before an order goes out.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl transition-all"
              >
                <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cockpit showcase */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Activity className="h-4 w-4" />
              <span>Live Cockpit</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Every move, explained
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              The cockpit shows your balance, a real-time equity curve, open positions,
              and a natural-language feed of what the AI is doing — not raw logs.
            </p>
            <ul className="space-y-3">
              {[
                "Real-time PnL curve with daily breakdown",
                "Plain-language feed: \"Closed BTC long +$8.40 (take-profit hit)\"",
                "Main wallet vs trading wallet, always visible",
                "One-click profit sweep back to your wallet",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button size="lg" onClick={onTryDemo} className="group">
                See it live
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          {/* Mini cockpit mock */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold font-mono tabular-nums">$520.40</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Agent running
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-white/10 p-3">
                  <p className="text-[11px] text-muted-foreground">Main Wallet</p>
                  <p className="text-sm font-mono tabular-nums">$120.00</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">AI can never touch</p>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <p className="text-[11px] text-muted-foreground">Trading Wallet</p>
                  <p className="text-sm font-mono tabular-nums">$400.40</p>
                  <p className="text-[10px] text-amber-500/90 mt-0.5">Max loss: $400.40</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 p-3 mb-4">
                <div className="h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded flex items-end px-2 gap-1">
                  {[35, 42, 38, 50, 46, 58, 55, 66, 62, 74, 70, 82].map((h, i) => (
                    <div key={i} className="flex-1 bg-primary/60 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { time: "10:32", text: "Added to BTC long (momentum 0.87)", color: "bg-blue-500/10 text-blue-500" },
                  { time: "10:15", text: "Closed ETH short +$8.40 (trailing stop)", color: "bg-emerald-500/10 text-emerald-500" },
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`p-1 rounded-full mt-0.5 ${a.color}`}>
                      <Clock className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                <p className="text-xl font-bold">3</p>
                <p className="text-xs text-muted-foreground mt-1">Positions max</p>
              </div>
              <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                <p className="text-xl font-bold">±2.5%</p>
                <p className="text-xs text-muted-foreground mt-1">TP / SL</p>
              </div>
              <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                <p className="text-xl font-bold">5%</p>
                <p className="text-xs text-muted-foreground mt-1">Daily loss stop</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Security model</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                The AI can trade. It can never withdraw.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                The agent holds a revocable trading permission scoped to your trading
                wallet. Your main wallet is untouchable, and the permission can be
                revoked from Hyperliquid at any moment.
              </p>
              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10 h-fit">
                    <Shield className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">No withdrawal permission — ever</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The agent wallet is approved with trading-only rights on Hyperliquid.
                      It cannot move funds off the exchange.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 h-fit">
                    <Lock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Keys stay with you</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You sign the agent approval with your own wallet. The agent&apos;s signing
                      key is encrypted at rest and scoped to one trading wallet only.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 h-fit">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Circuit breakers on every trade</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Per-trade stop-loss, position caps, and a daily loss limit that
                      stops new entries automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold">Fund safety checklist</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Agent withdrawal rights", status: "None" },
                    { label: "Main wallet exposure", status: "Zero" },
                    { label: "Max loss visible on screen", status: "Always" },
                    { label: "Revocation", status: "Instant" },
                    { label: "Stop-loss on every position", status: "On" },
                    { label: "Daily loss circuit breaker", status: "Armed" },
                  ].map((check) => (
                    <div key={check.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{check.label}</span>
                      <span className="text-sm font-medium text-emerald-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Your funds stay in your account structure
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Withdraw rights</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-xs text-muted-foreground mt-1">Risk monitoring</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                  <p className="text-2xl font-bold">1-click</p>
                  <p className="text-xs text-muted-foreground mt-1">Emergency stop</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live markets ticker */}
      <section className="border-y border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-5">
          <div className="text-center mb-4">
            <p className="text-xs font-medium text-primary uppercase tracking-wider">
              Real markets. Real data. The agent scans these right now.
            </p>
          </div>
          <MarketTicker />
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Put an AI to work on your funds
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Start with paper trading to watch the agent work risk-free.
            Go live whenever you're ready — you stay in control either way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 sm:mt-10">
            <Button size="lg" onClick={onConnectWallet} className="text-base px-8 py-6">
              Connect Wallet
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onTryDemo} className="text-base px-8 py-6">
              <Play className="mr-2 h-4 w-4" />
              Try Paper Trading
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8 text-sm text-muted-foreground">
            <Link href="/products" className="hover:text-foreground transition-colors flex items-center gap-1">
              Explore all products <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/help" className="hover:text-foreground transition-colors flex items-center gap-1">
              Usage Guide <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors flex items-center gap-1">
              Contact <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
