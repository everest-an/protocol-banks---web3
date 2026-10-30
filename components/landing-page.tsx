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
    title: "Create a key, set the policy",
    text: "Choose the operations, a per-call cap, a daily cap and a coin allowlist. The server enforces them on every call — the agent cannot widen them.",
  },
  {
    step: "02",
    title: "Call the sandbox",
    text: "The same five endpoints against a paper account with real market data. Place an order, read the fill, watch a $5,000 request get a 403.",
  },
  {
    step: "03",
    title: "Approve the wallet, go live",
    text: "Approve a Hyperliquid agent wallet with trading-only rights. The same code goes live; the wallet can trade, never withdraw.",
  },
]

const FEATURES = [
  {
    icon: Shield,
    title: "A cap the model cannot raise",
    text: "The policy lives on the key and is checked before an order reaches the venue. A prompt injection, a bug or a loop cannot raise it.",
  },
  {
    icon: Lock,
    title: "Trading-only rights",
    text: "The agent wallet can place and cancel orders; it cannot withdraw. The funded budget is the maximum loss, written on screen.",
  },
  {
    icon: Zap,
    title: "One credential, five endpoints",
    text: "state, orders, pay, swap and invoice under one key — with a usage log per call and a receipt per fill.",
  },
  {
    icon: Check,
    title: "Open client, closed core",
    text: "The SDK, tool manifest and MCP proxy are MIT. The policy and risk engine stay hosted: you integrate, not fork.",
  },
]

const SAFETY_CHECKLIST = [
  { label: "Policy enforcement", status: "Server-side" },
  { label: "Model can raise the cap", status: "Never" },
  { label: "Agent withdrawal rights", status: "None" },
  { label: "Max loss visible on screen", status: "Always" },
  { label: "Revocation", status: "Instant" },
  { label: "Stop-loss on every position", status: "On" },
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

/** The hero artifact: the API refusing what the model asked for. */
function TerminalArtifact() {
  return (
    <div className="rounded-lg border border-[#E4E2DD] bg-white overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E4E2DD]">
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="w-2 h-2 rounded-full bg-[#D9D6D0]" />
        <span className="ml-3 font-mono text-[11px] text-[#6F6B64]">agent-api — sandbox</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-[#1F7A4D]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A4D] animate-pulse" />
          policy enforced
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4 font-mono text-xs sm:text-sm">
        <p className="text-[#6F6B64]">key pb_… · read, trade · $100/call · $200/day</p>

        <div>
          <p className="text-[#111111]">POST /v1/agent/orders {"{ sizeUsd: 20 }"}</p>
          <p className="mt-1 text-[#1F7A4D]">200 fill 0.000249 @ $80,065.91 · fee $0.008 · remaining $180.00</p>
        </div>

        <div>
          <p className="text-[#111111]">POST /v1/agent/orders {"{ sizeUsd: 5000 }"}</p>
          <p className="mt-1 text-[#8A6116]">403 order of $5000.00 exceeds this key&apos;s per-call cap of $100</p>
        </div>

        <p className="border-t border-[#E4E2DD] pt-3 text-[#6F6B64]">the model asked; the server said no.</p>
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
            <span className="hidden sm:block">non-custodial · execution + policy for ai agents</span>
          </div>

          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center mt-12 sm:mt-16">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] uppercase">
                Your agent can trade.
                <br />
                <span className="text-primary">It can never drain the account.</span>
              </h1>
              <p className="mt-7 text-lg text-[#6F6B64] leading-relaxed max-w-[52ch]">
                One API key, one policy the server enforces — operations, per-call cap, daily cap and coin
                allowlist. Trading runs through a trading-only Hyperliquid wallet; pay executes from a signed
                EIP-3009 authorization, and swap returns a transaction the agent signs.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <Link
                  href="/settings/api-keys"
                  className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-7 py-4 text-base font-medium text-neutral-50 hover:bg-neutral-800 active:scale-[0.98] transition"
                >
                  Start in sandbox
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  href="/agent-api"
                  className="inline-flex items-center justify-center rounded-md border border-[#E4E2DD] bg-transparent px-7 py-4 text-base text-[#111111] hover:bg-white transition"
                >
                  Read the API
                </Link>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                <a
                  href="https://github.com/everest-an/protocolbanks-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  Open client, MIT-licensed
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <Link href="/trading" className="text-[#6F6B64] hover:text-[#111111] transition-colors">
                  watch the paper agent
                </Link>
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
              From a key to a live agent in three steps
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] leading-relaxed max-w-[60ch]">
              No SDK required. The same five endpoints move from sandbox to live without a code change.
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
            <Label>surfaces</Label>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
              Sandbox, live, and the receipt
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] leading-relaxed max-w-[60ch]">
              Start simulated, go live when the wallet is approved, and check the public record any time.
            </p>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-4">
            <Reveal>
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ sandbox ]</span>
                <h3 className="mt-3 text-base font-semibold">Sandbox</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  The same endpoints against a paper account with real market data. Integration tests and demos with
                  simulated fills — free.
                </p>
                <Link href="/settings/api-keys" className="mt-6 w-fit">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-md border-[#E4E2DD] bg-transparent text-[#111111] hover:bg-[#F7F6F3]"
                  >
                    Create a key
                  </Button>
                </Link>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-lg border border-[#111111] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ live ]</span>
                <h3 className="mt-3 text-base font-semibold">Live execution</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  Trading runs through a trading-only agent wallet. Plans from $199/mo, or 8 bps per executed order.
                </p>
                <Link href="/pricing" className="mt-6 w-fit">
                  <Button
                    size="sm"
                    className="rounded-md bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
                  >
                    See plans
                  </Button>
                </Link>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6 h-full flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ track record ]</span>
                <h3 className="mt-3 text-base font-semibold">Public record</h3>
                <p className="mt-2 text-sm text-[#6F6B64] leading-relaxed flex-1">
                  Every live account is public: real budgets, realized PnL, wins and losses. No cherry-picking.
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
                The agent holds a revocable trading permission scoped to the trading wallet. The key&apos;s policy
                decides what it may do, and the permission can be revoked from Hyperliquid at any moment.
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
              <Label>the demo cockpit</Label>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Every move, explained</h2>
              <p className="text-lg text-[#6F6B64] leading-relaxed mb-6">
                The paper agent your API key can drive: balance, equity curve, positions, and a plain-language feed.
                The same account is available at GET /v1/agent/state.
              </p>
              <ul className="space-y-3">
                {[
                  "Real-time PnL curve with daily breakdown",
                  'Plain-language feed: "Closed BTC long +$8.40 (take-profit hit)"',
                  "Policy and spentTodayUsd in every state response",
                  "Positions with the reason the agent opened them",
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
                  Open the demo
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">Plans from $0 to live</h2>
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
              <div className="rounded-lg border border-[#E4E2DD] bg-white p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ sandbox ]</p>
                <p className="text-3xl font-bold mt-3 font-mono tabular-nums">Free</p>
                <p className="text-sm text-[#6F6B64] mt-2 leading-relaxed">
                  Full API against a paper account. One key, $50 per call, $200 per day, real market data.
                </p>
              </div>
              <div className="rounded-lg border border-[#111111] bg-white p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ live ]</p>
                <p className="text-3xl font-bold mt-3 font-mono tabular-nums">
                  From $199 <span className="text-base font-normal text-[#6F6B64]">/ month</span>
                </p>
                <p className="text-sm text-[#6F6B64] mt-2 leading-relaxed">
                  Trading through a trading-only wallet. 3 keys at Builder, 10 at Growth — or 8 bps pay-as-you-go.
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-[#6F6B64] font-mono text-xs">
              <Link href="/pricing" className="text-primary underline">
                see all plans
              </Link>{" "}
              ·{" "}
              <Link href="/live-track-record" className="text-primary underline">
                public track record
              </Link>
            </p>
          </Reveal>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[#E4E2DD] py-20 sm:py-28">
          <Reveal className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Give your agent an execution layer.
            </h2>
            <p className="mt-4 text-lg text-[#6F6B64] max-w-xl leading-relaxed">
              One key, one server-enforced policy, five endpoints. Start in the sandbox; the same code goes live when
              the agent wallet is approved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link
                href="/settings/api-keys"
                className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-7 py-4 text-base font-medium text-neutral-50 hover:bg-neutral-800 active:scale-[0.98] transition"
              >
                Start in sandbox
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/agent-api"
                className="inline-flex items-center justify-center rounded-md border border-[#E4E2DD] bg-transparent px-7 py-4 text-base text-[#111111] hover:bg-white transition"
              >
                Read the API
              </Link>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={onConnectWallet}
                className="font-mono text-xs text-[#6F6B64] underline decoration-[#C9C6BF] underline-offset-2 hover:text-[#111111] transition-colors"
              >
                already have an account? connect
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-7 mt-9 font-mono text-xs text-[#6F6B64]">
              <Link href="/live-track-record" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                live track record <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/agent-api" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                agent api <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/pricing" className="hover:text-[#111111] transition-colors flex items-center gap-1">
                pricing <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href="https://github.com/everest-an/protocolbanks-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111111] transition-colors flex items-center gap-1"
              >
                open sdk (MIT) <ChevronRight className="h-3.5 w-3.5" />
              </a>
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
