"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BatchPaymentDemo } from "@/components/batch-payment-demo"
import { NetworkGraphDemo } from "@/components/network-graph-demo"
import { UnicornHero } from "@/components/unicorn-hero"
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Users,
  RefreshCw,
  Lock,
  BarChart3,
  Bot,
  CreditCard,
  ChevronRight,
  Play,
  Bitcoin,
  ArrowLeftRight,
  Wallet,
  Receipt,
  PieChart,
  Check,
  TrendingUp,
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

        <div className="container mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-36 relative z-10">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-16 items-center">
            {/* Left: Text content */}
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
                Payment infrastructure for the{" "}
                <span className="text-primary">onchain economy</span>
              </h1>
              <p className="mt-6 sm:mt-8 text-lg sm:text-xl text-muted-foreground leading-relaxed">
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
                  Try Live Test
                </Button>
                <Link href="/contact">
                  <Button size="lg" variant="ghost" className="text-base px-8 py-6 text-muted-foreground w-full sm:w-auto">
                    Contact Sales
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Unicorn Studio WebGL visual — shifted right with more space */}
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
            Complete crypto treasury infrastructure
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Everything your business needs to send, receive, and manage funds onchain.
            Start with one product and add more as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* Send & Pay */}
          <Link href="/pay" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-blue-500/10 w-fit mb-3">
                <ArrowRight className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Send & Pay
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send crypto payments to any address. Support multi-chain transfers with real-time confirmation.
              </p>
            </div>
          </Link>

          {/* Receive */}
          <Link href="/receive" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-green-500/10 w-fit mb-3">
                <Wallet className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Receive
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate payment links and QR codes. Accept payments on any chain with instant notifications.
              </p>
            </div>
          </Link>

          {/* Batch Payments */}
          <Link href="/batch-payment" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-orange-500/10 w-fit mb-3">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Batch Payments
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send to hundreds of recipients at once. Upload CSV, auto-validate, and execute payroll at scale.
              </p>
            </div>
          </Link>

          {/* Swap */}
          <Link href="/swap" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-purple-500/10 w-fit mb-3">
                <ArrowLeftRight className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Swap
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Exchange tokens across 70+ chains. Rango aggregates 100+ DEXs for best prices.
              </p>
            </div>
          </Link>

          {/* Card */}
          <Link href="/card" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-yellow-500/10 w-fit mb-3">
                <CreditCard className="h-5 w-5 text-yellow-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Card
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Spend crypto balances anywhere. Virtual and physical cards backed by your onchain treasury.
              </p>
            </div>
          </Link>

          {/* Subscriptions */}
          <Link href="/subscriptions" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-pink-500/10 w-fit mb-3">
                <RefreshCw className="h-5 w-5 text-pink-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Subscriptions
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Recurring onchain payments. Set billing cycles and automate collection.
              </p>
            </div>
          </Link>

          {/* AI Agents */}
          <Link href="/agents" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 w-fit mb-3">
                <Bot className="h-5 w-5 text-cyan-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                AI Agents
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Autonomous spending with session keys. Budget controls and instant revocation.
              </p>
            </div>
          </Link>

          {/* Yield */}
          <Link href="/yield" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 w-fit mb-3">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Yield
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Put idle treasury to work. Earn yield on stablecoins via curated DeFi protocols.
              </p>
            </div>
          </Link>

          {/* Split Payments */}
          <Link href="/split-payments" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 w-fit mb-3">
                <PieChart className="h-5 w-5 text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Split Payments
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Distribute funds by percentage. Perfect for royalties, revenue sharing, and teams.
              </p>
            </div>
          </Link>

          {/* Invoicing */}
          <Link href="/acquiring/invoices" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-slate-500/10 w-fit mb-3">
                <Receipt className="h-5 w-5 text-slate-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Invoicing
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create and send professional crypto invoices. Track payment status in real-time.
              </p>
            </div>
          </Link>

          {/* Acquiring */}
          <Link href="/acquiring" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-gray-500/10 w-fit mb-3">
                <CreditCard className="h-5 w-5 text-gray-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Acquiring
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hosted checkout pages, invoicing, and payment links for merchants.
              </p>
            </div>
          </Link>

          {/* Analytics */}
          <Link href="/analytics" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-rose-500/10 w-fit mb-3">
                <BarChart3 className="h-5 w-5 text-rose-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Analytics
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Track transactions, volumes, and trends. Export reports for accounting.
              </p>
            </div>
          </Link>

          {/* Reconciliation */}
          <Link href="/reconciliation" className="group">
            <div className="p-5 rounded-2xl border border-white/20 bg-white/60 dark:bg-black/20 backdrop-blur-xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all h-full">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 w-fit mb-3">
                <RefreshCw className="h-5 w-5 text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 group-hover:text-primary transition-colors">
                Reconciliation
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Match on-chain transactions with records. Audit-ready reports.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Feature Showcase 1: Global Payment Mesh */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1">
            <Link href="/analytics" className="block group">
              <div className="rounded-2xl border border-border overflow-hidden shadow-2xl hover:shadow-primary/20 hover:border-primary/30 transition-all cursor-pointer">
                <NetworkGraphDemo />
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3 group-hover:text-primary transition-colors">
                Click to explore Analytics Dashboard →
              </p>
            </Link>
          </div>
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Globe className="h-4 w-4" />
              <span>Network Visualization</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Global Payment Mesh
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Visualize your entire payment network in real-time. See how funds flow across chains, 
              wallets, and vendors in an interactive 3D graph. Identify patterns, track settlements, 
              and understand your treasury's global footprint at a glance.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-muted-foreground">Real-time transaction flow visualization</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-muted-foreground">Multi-chain network topology mapping</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-muted-foreground">Interactive zoom, filter, and time-travel controls</span>
              </li>
            </ul>
            <div className="mt-8">
              <Link href="/analytics">
                <Button size="lg" className="group">
                  Explore Network Graph
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase 2: Batch Payment */}
      <section className="border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium mb-4">
                <Users className="h-4 w-4" />
                <span>Payroll & Operations</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Batch Payment Dashboard
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Manage hundreds of vendors, contractors, and suppliers from a single interface. 
                Upload spreadsheets, validate addresses automatically, and execute mass payouts 
                with just one click. Perfect for payroll, grants, and vendor settlements.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-muted-foreground">CSV/Excel upload with auto-validation</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-muted-foreground">ENS & address book resolution</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/10 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-muted-foreground">Concurrent execution with real-time progress tracking</span>
                </li>
              </ul>
              <div className="mt-8">
                <Link href="/batch-payment">
                  <Button size="lg" className="group">
                    Start Batch Payment
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
            <Link href="/batch-payment" className="block group">
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/80 to-white/40 dark:from-black/40 dark:to-black/20 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-orange-500/30 transition-all">
                <BatchPaymentDemo />
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3 group-hover:text-orange-500 transition-colors">
                Click to open full Batch Payment →
              </p>
            </Link>
          </div>
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
              <div className="rounded-2xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 shadow-lg">
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
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                  <p className="text-2xl font-bold">6</p>
                  <p className="text-xs text-muted-foreground mt-1">Security checks</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Keys exposed</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-4 text-center">
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

        <div className="overflow-x-auto rounded-xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 dark:bg-white/5 text-foreground uppercase tracking-wider text-xs">
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
      <section className="border-y border-border bg-muted/20 overflow-hidden">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              One interface. Every chain.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Connect your preferred wallet and operate across all major networks from a single dashboard.
            </p>
          </div>
          
          <div className="relative w-full mx-auto">
            <style jsx global>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-marquee {
                animation: marquee 40s linear infinite;
              }
              .animate-marquee:hover {
                animation-play-state: paused;
              }
            `}</style>
            
            <div 
              className="flex overflow-hidden relative"
              style={{ 
                maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', 
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' 
              }}
            >
               <div className="flex animate-marquee gap-6 sm:gap-8 items-center py-6">
                  {[
                    { name: "Ethereum", logo: "/networks/eth.png" },
                    { name: "Polygon", logo: "/networks/polygon.png" },
                    { name: "Arbitrum", logo: "/networks/arb.png" },
                    { name: "Optimism", logo: "/networks/optimism.png" },
                    { name: "Base", logo: "/networks/base.png" },
                    { name: "BSC", logo: "/networks/bnb.png" },
                    { name: "Avalanche", logo: "/networks/avax.png" },
                    { name: "HashKey", logo: "/networks/hsk.png" },
                    { name: "Solana", logo: "/networks/solana.png" },
                    { name: "Tron", logo: "/networks/tron.png" },
                    { name: "Bitcoin", icon: "Bitcoin", color: "#F7931A" },
                    { name: "Zeta", color: "#005741" },
                    // Repeat list to ensure smooth seamless loop
                    { name: "Ethereum", logo: "/networks/eth.png" },
                    { name: "Polygon", logo: "/networks/polygon.png" },
                    { name: "Arbitrum", logo: "/networks/arb.png" },
                    { name: "Optimism", logo: "/networks/optimism.png" },
                    { name: "Base", logo: "/networks/base.png" },
                    { name: "BSC", logo: "/networks/bnb.png" },
                    { name: "Avalanche", logo: "/networks/avax.png" },
                    { name: "HashKey", logo: "/networks/hsk.png" },
                    { name: "Solana", logo: "/networks/solana.png" },
                    { name: "Tron", logo: "/networks/tron.png" },
                    { name: "Bitcoin", icon: "Bitcoin", color: "#F7931A" },
                    { name: "Zeta", color: "#005741" },
                  ].map((chain, i) => (
                    <div
                      key={`${chain.name}-${i}`}
                      className="flex items-center gap-4 px-8 py-4 rounded-full border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl hover:bg-white/60 hover:dark:bg-black/40 hover:border-primary/30 transition-all shrink-0 cursor-default"
                    >
                      {chain.logo ? (
                        <div className="relative h-8 w-8">
                           <Image 
                              src={chain.logo} 
                              alt={chain.name} 
                              width={32} 
                              height={32}
                              className="object-contain" 
                           />
                        </div>
                      ) : chain.icon === "Bitcoin" ? (
                         <Bitcoin className="h-8 w-8 text-[#F7931A]" />
                      ) : (
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: chain.color || '#666' }}>
                          {chain.name[0]}
                        </div>
                      )}
                      <span className="font-medium text-base">{chain.name}</span>
                    </div>
                  ))}
               </div>
            </div>
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
              Explore Test
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
