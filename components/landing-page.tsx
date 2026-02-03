"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Users,
  RefreshCw,
  Lock,
  Layers,
  Bot,
  CreditCard,
  ChevronRight,
  Play,
} from "lucide-react"

interface LandingPageProps {
  onConnectWallet: () => void
  onTryDemo: () => void
}

export function LandingPage({ onConnectWallet, onTryDemo }: LandingPageProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-36 relative">
          <div className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Payment infrastructure
              <br />
              <span className="text-primary">for the onchain economy</span>
            </h1>
            <p className="mt-6 sm:mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Accept payments, manage treasury, and automate payroll across 10+ blockchains.
              Non-custodial, gasless, enterprise-grade.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-10">
              <Button size="lg" onClick={onConnectWallet} className="text-base px-8 py-6">
                Start Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={onTryDemo} className="text-base px-8 py-6">
                <Play className="mr-2 h-4 w-4" />
                Try Live Demo
              </Button>
              <Link href="/contact">
                <Button size="lg" variant="ghost" className="text-base px-8 py-6 text-muted-foreground w-full sm:w-auto">
                  Contact Sales
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Metrics Bar */}
      <section className="border-y border-border bg-muted/30">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">10+</p>
              <p className="text-sm text-muted-foreground mt-1">Blockchains supported</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">$0</p>
              <p className="text-sm text-muted-foreground mt-1">Gas fees with x402 Protocol</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">500+</p>
              <p className="text-sm text-muted-foreground mt-1">Transactions per second</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">100%</p>
              <p className="text-sm text-muted-foreground mt-1">Non-custodial architecture</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Products */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Products</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            A fully integrated suite of crypto payment products
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Every tool your business needs to accept payments, manage funds, and scale operations onchain.
            Start with one product and add more as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Batch Payments */}
          <Link href="/batch-payment" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-blue-500/10 w-fit mb-4">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                Batch Payments
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send to hundreds of recipients in one session. Upload Excel/CSV, auto-validate addresses,
                and process payroll at scale with concurrent execution.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* Gasless x402 */}
          <Link href="/checkout" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-yellow-500/10 w-fit mb-4">
                <Zap className="h-6 w-6 text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                Gasless Checkout (x402)
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Accept USDC payments without requiring your users to hold gas tokens.
                ERC-3009 authorization separates signing from execution for a seamless UX.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* Cross-Chain */}
          <Link href="/omnichain" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-green-500/10 w-fit mb-4">
                <Globe className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                Cross-Chain Transfers
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Move USDC natively between chains via Circle CCTP. No bridge risk,
                no slippage, no wrapped tokens. Burn-and-mint for 1:1 efficiency.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* Subscriptions */}
          <Link href="/subscriptions" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-purple-500/10 w-fit mb-4">
                <RefreshCw className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                Subscriptions & Billing
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enable recurring onchain payments. Set billing cycles, manage subscriber budgets,
                and automate collection with programmable authorization.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* AI Agents */}
          <Link href="/agents" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-orange-500/10 w-fit mb-4">
                <Bot className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                AI Agent Commerce
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Give your AI agents autonomous spending power with session keys and budget constraints.
                Secure, auditable, and revocable at any time.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* Multi-Sig */}
          <Link href="/multisig" className="group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
              <div className="p-3 rounded-lg bg-cyan-500/10 w-fit mb-4">
                <Layers className="h-6 w-6 text-cyan-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                Multi-Signature Wallets
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Safe protocol integration with configurable thresholds. Require 2-of-3, 3-of-5,
                or custom approval workflows before any transaction executes.
              </p>
              <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Why Protocol Bank - Security & Trust */}
      <section className="border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: messaging */}
            <div>
              <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Enterprise Grade</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Built for security at every layer
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Protocol Bank is non-custodial by design. Your keys stay in your wallet.
                We cannot access or move your funds -- ever. Every transaction goes through
                automated security analysis before touching the blockchain.
              </p>
              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10 h-fit">
                    <Shield className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Pre-Transaction Security Scan</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Proxy backdoor detection, flash loan analysis, signature phishing prevention,
                      and malicious approval blocking -- all before you sign.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 h-fit">
                    <Lock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Zero-Knowledge Architecture</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Shamir Secret Sharing (2-of-3 threshold) for embedded wallets.
                      PIN-derived encryption with AES-256-GCM. Server cannot reconstruct keys.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 h-fit">
                    <CreditCard className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Exact-Amount Approvals</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      No unlimited token approvals. Every transaction authorizes only the exact amount needed,
                      with address integrity hashing and tamper detection.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: visual card */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold">Transaction Security Check</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Contract Verification", status: "Verified" },
                    { label: "Proxy Backdoor Scan", status: "Clean" },
                    { label: "Flash Loan Risk", status: "None" },
                    { label: "Signature Safety", status: "Valid" },
                    { label: "Approval Amount", status: "Exact" },
                    { label: "Address Integrity", status: "Matched" },
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
                  Risk Level: SAFE — Ready to proceed
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-2xl font-bold">6</p>
                  <p className="text-xs text-muted-foreground mt-1">Security checks</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Keys exposed</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-2xl font-bold">RLS</p>
                  <p className="text-xs text-muted-foreground mt-1">Data isolation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Comparison */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Why Onchain</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Faster, cheaper, more transparent
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Traditional payment rails were built for a different era. Protocol Bank leverages blockchain
            infrastructure to deliver settlement in seconds, not days.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-foreground uppercase tracking-wider text-xs">
              <tr>
                <th className="p-4 font-medium">Method</th>
                <th className="p-4 font-medium">Cost</th>
                <th className="p-4 font-medium">Settlement</th>
                <th className="p-4 font-medium">Cross-Border</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr className="bg-primary/5">
                <td className="p-4 font-medium text-primary">Protocol Bank (x402)</td>
                <td className="p-4 text-green-600 dark:text-green-400 font-semibold">$0 gas for sender</td>
                <td className="p-4">Instant signature</td>
                <td className="p-4">Native, 10+ chains</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">Layer 2 Transfer</td>
                <td className="p-4">$0.01 - $0.10</td>
                <td className="p-4">~2 seconds</td>
                <td className="p-4">Same chain only</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">Wire Transfer (SWIFT)</td>
                <td className="p-4">$25 - $50</td>
                <td className="p-4">1-5 business days</td>
                <td className="p-4">High fees, slow</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">Traditional Payroll</td>
                <td className="p-4">$5 - $15 per employee</td>
                <td className="p-4">2-3 business days</td>
                <td className="p-4">Complex, regulated</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Supported Chains */}
      <section className="border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              One interface. Every chain.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Connect your preferred wallet and operate across all major networks from a single dashboard.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            {[
              "Ethereum", "Polygon", "Arbitrum", "Optimism",
              "Base", "BSC", "Avalanche", "Solana",
              "Bitcoin", "ZetaChain",
            ].map((chain) => (
              <div
                key={chain}
                className="px-5 py-3 rounded-full border border-border bg-card hover:border-primary/30 transition-colors"
              >
                {chain}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Ready to upgrade your treasury?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Join the next generation of businesses building on programmable money.
            Connect your wallet to get started, or explore with our live demo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 sm:mt-10">
            <Button size="lg" onClick={onConnectWallet} className="text-base px-8 py-6">
              Connect Wallet
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onTryDemo} className="text-base px-8 py-6">
              <Play className="mr-2 h-4 w-4" />
              Explore Demo
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8 text-sm text-muted-foreground">
            <Link href="/whitepaper" className="hover:text-foreground transition-colors flex items-center gap-1">
              Read the Whitepaper <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/help" className="hover:text-foreground transition-colors flex items-center gap-1">
              Usage Guide <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors flex items-center gap-1">
              Contact Sales <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
