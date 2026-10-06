"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { MarketTicker } from "@/components/market-ticker"
import {
  ArrowRight,
  Check,
  ChevronRight,
  Lock,
  MessagesSquare,
  Play,
  Shield,
  Zap,
} from "lucide-react"

interface LandingPageProps {
  onConnectWallet: () => void
  onTryDemo: () => void
}

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect your wallet",
    text: "Sign in with MetaMask or any EVM wallet. Your keys never leave your device.",
  },
  {
    step: "02",
    title: "Fund your trading wallet",
    text: "Move the amount you're comfortable risking into the AI trading wallet. That's your maximum loss — never more.",
  },
  {
    step: "03",
    title: "The AI trades. You watch.",
    text: "The agent scans markets 24/7, opens and closes positions, and reports every move in plain language.",
  },
]

const FEATURES = [
  {
    icon: Shield,
    title: "No withdrawal permission — ever",
    text: "The agent wallet is approved with trading-only rights on Hyperliquid. It cannot move funds off the exchange.",
  },
  {
    icon: Lock,
    title: "Keys stay with you",
    text: "You sign the agent approval with your own wallet. The agent's signing key is encrypted at rest and scoped to one trading wallet only.",
  },
  {
    icon: Zap,
    title: "Circuit breakers on every trade",
    text: "Per-trade stop-loss, position caps, and a daily loss limit that stops new entries automatically.",
  },
  {
    icon: Check,
    title: "You can always stop it",
    text: "Pause the agent or hit Emergency Stop anytime. Revoke its access completely — the AI can never withdraw your funds.",
  },
]

const SAFETY_CHECKLIST = [
  { label: "Agent withdrawal rights", status: "None" },
  { label: "Main wallet exposure", status: "Zero" },
  { label: "Max loss visible on screen", status: "Always" },
  { label: "Revocation", status: "Instant" },
  { label: "Stop-loss on every position", status: "On" },
  { label: "Daily loss circuit breaker", status: "Armed" },
]

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">[ {children} ]</p>
  )
}

/** Quiet entry: fade + 12px rise, once, transform/opacity only. */
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${className} transition duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {children}
    </div>
  )
}

function BrandChip({ src, name, px = 18 }: { src: string; name: string; px?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Image src={src} alt={name} width={px} height={px} className="opacity-90" />
      <span className="font-mono text-[11px] text-[#6F6B64]">{name}</span>
    </span>
  )
}

/** The hero artifact: what the product actually is, told as a terminal window. */
function TerminalArtifact() {
  const bars = [38, 44, 40, 52, 48, 58, 54, 65, 61, 72, 68, 80]
  const log = [
    { time: "10:32", text: "added to btc long (momentum 0.87)", pnl: null },
    { time: "10:15", text: "closed eth short (trailing stop)", pnl: "+$8.40" },
  ]

  return (
    <div className="rounded-lg border border-[#E4E2DD] bg-white overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E4E2DD]">
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="ml-3 font-mono text-[11px] text-[#6F6B64]">agent — live</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-[#1F7A4D]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A4D] animate-pulse" />
          running
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4 font-mono text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.08em] text-[#6F6B64]">total assets</span>
          <span className="text-2xl tracking-tight tabular-nums">$520.40</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-[#E4E2DD] p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">main wallet</p>
            <p className="mt-1 tabular-nums">$120.00</p>
            <p className="mt-0.5 text-[10px] text-[#6F6B64]">ai can never touch</p>
          </div>
          <div className="rounded-md border border-[#E4E2DD] p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">trading wallet</p>
            <p className="mt-1 tabular-nums">$400.40</p>
            <p className="mt-0.5 text-[10px] text-[#8A6116]">max loss: $400.40</p>
          </div>
        </div>

        <div className="flex items-end gap-1 h-14">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 bg-[#111111]/80 rounded-t-[2px]" style={{ height: `${h}%` }} />
          ))}
        </div>

        <div className="space-y-2 pt-1">
          {log.map((entry) => (
            <div key={entry.time} className="flex items-baseline gap-3 text-xs">
              <span className="text-[#6F6B64] tabular-nums">{entry.time}</span>
              <span className="text-[#111111]">
                {entry.text}
                {entry.pnl ? <span className="ml-2 text-[#1F7A4D] tabular-nums">{entry.pnl}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LandingPage({ onConnectWallet, onTryDemo }: LandingPageProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#F7F6F3] text-[#111111]">
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10">
        {/* Hero */}
        <section className="pt-14 pb-20 sm:pt-20 sm:pb-24">
          <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">
            <span>PB V2.0</span>
            <span className="hidden sm:block">non-custodial · built on hyperliquid</span>
          </div>

          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center mt-12 sm:mt-16">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] uppercase">
                Your AI trades.
                <br />
                <span className="text-primary">You keep control.</span>
              </h1>
              <p className="mt-7 text-lg text-[#6F6B64] leading-relaxed max-w-[52ch]">
                Connect your wallet, fund a trading wallet, and let the agent work real
                markets around the clock. The AI can trade but never withdraw — your worst
                case is the budget you choose, written on the screen.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <Button
                  size="lg"
                  onClick={onConnectWallet}
                  className="text-base px-7 py-6 rounded-md bg-neutral-900 text-neutral-50 hover:bg-neutral-800 active:scale-[0.98] transition"
                >
                  Connect Wallet
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onTryDemo}
                  className="text-base px-7 py-6 rounded-md border-[#E4E2DD] bg-transparent text-[#111111] hover:bg-white"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Try Paper Trading
                </Button>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-sm">
                <Link
                  href="/live-track-record"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  Every live account is public — see real PnL
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="text-[#6F6B64] font-mono text-xs">paper mode is free · real market data</span>
              </div>

              {/* Trust: official marks of what actually signs and executes */}
              <div className="mt-10 pt-6 border-t border-[#E4E2DD] flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">SIGNS WITH</span>
                <BrandChip src="/brands/metamask.svg" name="MetaMask" />
                <BrandChip src="/brands/walletconnect.svg" name="WalletConnect" />
                <span aria-hidden className="hidden sm:block w-px h-3.5 bg-[#E4E2DD]" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">TRADES ON</span>
                <BrandChip src="/brands/hyperliquid.png" name="Hyperliquid" />
              </div>
            </div>

            <Reveal className="lg:pl-4">
              <TerminalArtifact />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-24">
          <Reveal>
            <Label>how it works</Label>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
              From wallet to working agent in 3 minutes
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] leading-relaxed max-w-[60ch]">
              No strategy configuration, no trading knowledge required. Set a budget, and the agent handles the rest.
            </p>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 md:divide-x divide-[#E4E2DD] border-y border-[#E4E2DD]">
            {HOW_IT_WORKS.map((item, i) => (
              <Reveal key={item.step} className={`py-8 ${i > 0 ? "md:pl-8" : ""} ${i < 2 ? "md:pr-8" : ""}`}>
                <p className="font-mono text-xs text-[#6F6B64] tabular-nums">{item.step}</p>
                <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed">{item.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The product */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-24">
          <Reveal>
            <Label>the product</Label>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
              Three ways to use it — all non-custodial
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] leading-relaxed max-w-[60ch]">
              Start with simulated money, go live when you&apos;re ready, and check the public track record any time.
            </p>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-4">
            <Reveal>
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ paper ]</span>
                <h3 className="mt-3 text-base font-semibold">Paper mode</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  Watch the agent trade real Hyperliquid markets with simulated money. Zero risk, full experience —
                  free forever.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 w-fit rounded-md border-[#E4E2DD] bg-transparent text-[#111111] hover:bg-[#F7F6F3]"
                  onClick={onTryDemo}
                >
                  Try it free
                </Button>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-lg border border-[#111111] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ live ]</span>
                <h3 className="mt-3 text-base font-semibold">Live mode</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  Real funds, real markets. The AI trades through a trading-only agent wallet and can never withdraw.
                  20% of profits, nothing on losses.
                </p>
                <Button
                  size="sm"
                  className="mt-6 w-fit rounded-md bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
                  onClick={onConnectWallet}
                >
                  Go live
                </Button>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ track record ]</span>
                <h3 className="mt-3 text-base font-semibold">Track record</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  Every live account is public: real budgets, real realized PnL, updated automatically. Wins and losses
                  both shown.
                </p>
                <Link href="/live-track-record" className="mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit rounded-md border-[#E4E2DD] bg-transparent text-[#111111] hover:bg-[#F7F6F3]"
                  >
                    See live PnL
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Live markets ticker */}
        <section className="border-t border-[#E4E2DD] py-6">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-4">
            [ real markets · the agent scans these right now ]
          </p>
          <MarketTicker />
        </section>

        {/* Why it's safe */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-24">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-start">
            <Reveal>
              <Label>security model</Label>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                The AI can trade. It can never withdraw.
              </h2>
              <p className="mt-4 text-lg text-[#6F6B64] leading-relaxed">
                The agent holds a revocable trading permission scoped to your trading wallet. Your main wallet is
                untouchable, and the permission can be revoked from Hyperliquid at any moment.
              </p>
              <div className="mt-8 space-y-4">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex gap-4 border-b border-[#E4E2DD] pb-4 last:border-0">
                    <f.icon className="h-4 w-4 text-[#6F6B64] mt-1 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm">{f.title}</h4>
                      <p className="text-sm text-[#6F6B64] mt-1 leading-relaxed">{f.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64] mb-5">[ fund safety checklist ]</p>
                <div className="space-y-0">
                  {SAFETY_CHECKLIST.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center justify-between py-3 border-b border-[#E4E2DD] last:border-0"
                    >
                      <span className="text-sm text-[#6F6B64]">{check.label}</span>
                      <span className="font-mono text-sm text-[#1F7A4D] flex items-center gap-1.5 tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A4D]" />
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Cockpit showcase */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <Reveal>
              <Label>live cockpit</Label>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Every move, explained</h2>
              <p className="text-lg text-[#6F6B64] leading-relaxed mb-6">
                The cockpit shows your balance, a real-time equity curve, open positions, and a natural-language feed of
                what the AI is doing — not raw logs.
              </p>
              <ul className="space-y-3">
                {[
                  "Real-time PnL curve with daily breakdown",
                  'Plain-language feed: "Closed BTC long +$8.40 (take-profit hit)"',
                  "Main wallet vs trading wallet, always visible",
                  "One-click profit sweep back to your wallet",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#1F7A4D] mt-0.5 shrink-0" />
                    <span className="text-sm text-[#6F6B64]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={onTryDemo}
                  className="group rounded-md bg-neutral-900 text-neutral-50 hover:bg-neutral-800 active:scale-[0.98] transition"
                >
                  See it live
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Reveal>

            <Reveal className="space-y-4">
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">total assets</p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-1">$520.40</p>
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#1F7A4D]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A4D] animate-pulse" />
                    agent running
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-md border border-[#E4E2DD] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">main wallet</p>
                    <p className="text-sm font-mono tabular-nums mt-1">$120.00</p>
                    <p className="font-mono text-[10px] text-[#6F6B64] mt-0.5">ai can never touch</p>
                  </div>
                  <div className="rounded-md border border-[#E4E2DD] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64]">trading wallet</p>
                    <p className="text-sm font-mono tabular-nums mt-1">$400.40</p>
                    <p className="font-mono text-[10px] text-[#8A6116] mt-0.5">max loss: $400.40</p>
                  </div>
                </div>
                <div className="rounded-md border border-[#E4E2DD] p-3 mb-4">
                  <div className="h-14 flex items-end px-1 gap-1">
                    {[35, 42, 38, 50, 46, 58, 55, 66, 62, 74, 70, 82].map((h, i) => (
                      <div key={i} className="flex-1 bg-[#111111]/80 rounded-t-[2px]" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { time: "10:32", text: "added to btc long (momentum 0.87)" },
                    { time: "10:15", text: "closed eth short +$8.40 (trailing stop)" },
                  ].map((a) => (
                    <div key={a.time} className="flex items-baseline gap-3 font-mono text-xs">
                      <span className="text-[#6F6B64] tabular-nums">{a.time}</span>
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: "3", l: "positions max" },
                  { v: "±2.5%", l: "tp / sl" },
                  { v: "5%", l: "daily loss stop" },
                ].map((s) => (
                  <div key={s.l} className="rounded-md border border-[#E4E2DD] bg-white p-4 text-center">
                    <p className="font-mono text-lg tabular-nums">{s.v}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6F6B64] mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-[#E4E2DD] py-16 sm:py-20">
          <Reveal>
            <Label>pricing</Label>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">We only earn when you profit</h2>
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ paper ]</p>
                <p className="text-3xl font-bold mt-3 font-mono tabular-nums">Free</p>
                <p className="text-sm text-[#6F6B64] mt-2 leading-relaxed">
                  Real market data, simulated money. Watch the agent trade, read every decision, verify it works — zero
                  risk, forever.
                </p>
              </div>
              <div className="rounded-lg border border-[#111111] bg-white p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ live ]</p>
                <p className="text-3xl font-bold mt-3 font-mono tabular-nums">
                  20% <span className="text-base font-normal text-[#6F6B64]">of profits</span>
                </p>
                <p className="text-sm text-[#6F6B64] mt-2 leading-relaxed">
                  Profit-share only, charged when you sweep profits out. No subscription, no upfront fee. If the agent
                  doesn&apos;t make money, you pay nothing.
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-[#6F6B64] font-mono text-xs">
              see real live-account performance on the{" "}
              <Link href="/live-track-record" className="text-primary underline">
                live track record
              </Link>
            </p>
          </Reveal>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-28">
          <Reveal className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Put an AI to work on your funds
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] max-w-xl leading-relaxed">
              Start with paper trading to watch the agent work risk-free. Go live whenever you&apos;re ready — you stay
              in control either way.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Button
                size="lg"
                onClick={onConnectWallet}
                className="text-base px-7 py-6 rounded-md bg-neutral-900 text-neutral-50 hover:bg-neutral-800 active:scale-[0.98] transition"
              >
                Connect Wallet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onTryDemo}
                className="text-base px-7 py-6 rounded-md border-[#E4E2DD] bg-transparent text-[#111111] hover:bg-white"
              >
                <Play className="mr-2 h-4 w-4" />
                Try Paper Trading
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-7 mt-9 font-mono text-xs text-[#6F6B64]">
              <Link href="/live-track-record" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                live track record <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/help" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                usage guide <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/contact" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                contact <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="https://discord.gg/aBeZEsfXkH"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111111] transition-colors flex items-center gap-1"
              >
                <MessagesSquare className="h-3.5 w-3.5" />
                discord <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}
