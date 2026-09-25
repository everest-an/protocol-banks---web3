import type { Metadata } from "next"
import Link from "next/link"
import { Download, Palette, Type, Image as ImageIcon, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Media Kit - Protocol Bank",
  description:
    "Brand assets, boilerplate copy, and usage guidelines for Protocol Bank — the non-custodial AI trading agent on Hyperliquid.",
}

const BOILERPLATES = [
  {
    label: "One-liner",
    text: "Protocol Bank is a non-custodial AI trading agent: the AI can trade but never withdraw.",
  },
  {
    label: "Short (50 words)",
    text: "Protocol Bank lets an AI agent trade Hyperliquid perpetual markets for you — with trading-only permissions, so it can never withdraw your funds. Your worst case is the budget you approve, shown on screen. Paper mode is free on real market data, and every live account's PnL is public.",
  },
  {
    label: "Long (100 words)",
    text: "Protocol Bank is a non-custodial AI trading product for Hyperliquid. You connect a wallet, set a trading budget, and approve a trading-only agent wallet (EIP-712 approveAgent). The AI then trades momentum and funding-carry signals 24/7, with per-trade stop-losses, position caps, and daily circuit breakers enforced before every order. Withdrawals always require your own signature — the agent physically cannot move funds out. Every trade is explained in plain language, profits can be swept back anytime, and the agent is revocable on-chain. Paper mode runs on real market data with simulated money, free forever. Live accounts are listed publicly on the track record page.",
  },
]

const LOGOS = [
  { name: "Logo (mark)", file: "/logo.png", note: "Primary mark, transparent PNG" },
  { name: "Logo + wordmark (dark text)", file: "/logo-text-black.png", note: "For light backgrounds" },
  { name: "Logo + wordmark (light text)", file: "/logo-text-white.png", note: "For dark backgrounds" },
  { name: "App icon 512×512", file: "/icon-512x512.png", note: "Square app icon" },
  { name: "App icon 192×192", file: "/icon-192x192.png", note: "Square app icon (small)" },
  { name: "Social preview (1200×630)", file: "/og-image.png", note: "Open Graph / Twitter card" },
]

const COLORS = [
  { name: "Primary", value: "#4A90E2", cls: "bg-[#4A90E2]" },
  { name: "Emerald (profit)", value: "#10B981", cls: "bg-emerald-500" },
  { name: "Red (loss)", value: "#EF4444", cls: "bg-red-500" },
  { name: "Background (light)", value: "#FFFFFF", cls: "bg-white border border-border" },
  { name: "Foreground (dark)", value: "#0A0A0A", cls: "bg-[#0A0A0A]" },
]

export default function MediaKitPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Protocol Bank Media Kit",
            dateModified: "2026-09-20",
            inLanguage: "en",
            about: {
              "@type": "Organization",
              name: "Protocol Bank",
              url: "https://protocolbanks.com",
            },
          }),
        }}
      />
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-4xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Protocol Bank
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-4 tracking-tight">Media Kit</h1>
        <p className="text-muted-foreground mb-2">Last updated: September 2026</p>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Everything you need to write about Protocol Bank. For interviews or anything not
          covered here, reach us at{" "}
          <a href="mailto:e@awareness.market" className="text-primary underline">
            e@awareness.market
          </a>
          .
        </p>

        {/* Boilerplate */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Type className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Boilerplate</h2>
          </div>
          <div className="space-y-4">
            {BOILERPLATES.map((b) => (
              <div
                key={b.label}
                className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{b.label}</p>
                <p className="text-sm leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Logos */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Logos &amp; assets</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {LOGOS.map((l) => (
              <a
                key={l.file}
                href={l.file}
                download
                className="flex items-center gap-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-4 hover:border-primary/40 transition-colors"
              >
                <div className="h-12 w-12 rounded-lg bg-background/80 border border-white/10 flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.file} alt={l.name} className="max-h-8 max-w-8 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.note}</p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        </section>

        {/* Colors */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Brand colors</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {COLORS.map((c) => (
              <div key={c.name}>
                <div className={`h-16 rounded-xl ${c.cls}`} />
                <p className="text-sm font-medium mt-2">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Usage */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">Usage guidelines</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3">Please</p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Use &ldquo;Protocol Bank&rdquo; (two words, both capitalised)</li>
                <li>• Link to https://protocolbanks.com</li>
                <li>• Keep clear space around the mark</li>
                <li>• Use the provided files unmodified</li>
              </ul>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">Please don&apos;t</p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Say the AI &ldquo;holds your funds&rdquo; — it can never withdraw</li>
                <li>• Imply guaranteed returns</li>
                <li>• Recolor or distort the logo</li>
                <li>• Call it a bank or custodian — it is a non-custodial trading tool</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Key facts */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6">Key facts</h2>
          <div className="rounded-xl border border-white/10 dark:border-white/5 bg-white/50 dark:bg-black/20 p-5">
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Category:</dt>
                <dd>AI trading / DeFi</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Chain / venue:</dt>
                <dd>Hyperliquid (perpetuals)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Custody:</dt>
                <dd>Non-custodial (trading-only agent)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Pricing:</dt>
                <dd>Free paper mode · 20% of live profits</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Wallet support:</dt>
                <dd>MetaMask (injected EVM)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Track record:</dt>
                <dd>
                  <Link href="/live-track-record" className="text-primary underline">
                    protocolbanks.com/live-track-record
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Press contact:{" "}
          <a href="mailto:e@awareness.market" className="text-primary underline">
            e@awareness.market
          </a>
        </p>
      </div>
    </div>
  )
}
