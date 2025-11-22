import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Download, FileText, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-12 border-b border-zinc-800 pb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
              Version 1.0
            </span>
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Updated Nov 2025</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-white">Protocol Bank Whitepaper</h1>
          <p className="text-xl text-zinc-400 max-w-2xl">
            Decentralized Treasury Management for the AI Era. A deep dive into the x402 Protocol, Enterprise
            Architecture, and the Future of Agentic Finance.
          </p>
          <div className="flex flex-wrap gap-4 mt-8">
            <Link
              href="https://github.com/everest-an/protocol-banks---web3/blob/main/WHITEPAPER.md"
              target="_blank"
              className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded hover:bg-zinc-200 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Read Full on GitHub
            </Link>
            <Link
              href="https://github.com/everest-an/protocol-banks---web3"
              target="_blank"
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 text-white rounded hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Source Code
            </Link>
          </div>
        </div>

        <article className="prose prose-invert max-w-none prose-lg">
          <h2 className="text-3xl font-bold text-white mb-6">1. Executive Summary</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            As decentralized organizations (DAOs) and AI agents become dominant economic actors, the traditional banking
            stack is becoming obsolete. Protocol Bank introduces a programmable, cross-chain treasury management layer
            designed for the future of work. By abstracting chain-specific complexities and integrating standard
            accounting practices directly with on-chain events, Protocol Bank enables seamless financial operations for
            the next generation of digital enterprises.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6">2. The "x402" Protocol</h2>
          <div className="p-6 bg-blue-950/30 border border-blue-500/30 rounded-lg mb-8">
            <h3 className="text-xl font-bold text-blue-100 mb-2">Gasless Enterprise Settlements</h3>
            <p className="text-blue-200/70 text-base mb-4">
              Protocol Bank leverages the <strong>x402 Protocol</strong> (based on ERC-3009) to separate payment
              <strong> authorization</strong> from <strong>execution</strong>.
            </p>
            <ul className="space-y-2 text-sm text-blue-200/60">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Enables "CFO Approval" workflows where the approver doesn't need ETH/Gas.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Allows AI Agents to propose payments securely via EIP-712 signatures.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Facilitates recurring billing and subscriptions on-chain.</span>
              </li>
            </ul>
          </div>

          <h2 className="text-3xl font-bold text-white mb-6">3. Market Analysis</h2>
          <p className="text-zinc-400 mb-6">
            Modern Web3 finance teams face a "fragmentation trilemma" that hinders adoption:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 not-prose">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
              <h4 className="text-white font-semibold mb-2">Chain Silos</h4>
              <p className="text-zinc-500 text-sm">Assets split across EVM, Solana, and Bitcoin layers.</p>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
              <h4 className="text-white font-semibold mb-2">Data Blindness</h4>
              <p className="text-zinc-500 text-sm">Explorers show hashes, not "Payroll" or "Vendor" context.</p>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
              <h4 className="text-white font-semibold mb-2">Manual Risk</h4>
              <p className="text-zinc-500 text-sm">Spreadsheets + Hardware wallets = High human error risk.</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-6">4. Product Architecture</h2>
          <p className="text-zinc-400 mb-8">
            Protocol Bank acts as a non-custodial overlay. We do not hold funds; we orchestrate them.
          </p>
          <ul className="space-y-4 mb-8 text-zinc-400 list-disc pl-6">
            <li>
              <strong className="text-white">Unified Batch Engine:</strong> Smart routing logic that bundles
              transactions to minimize gas fees and administrative time.
            </li>
            <li>
              <strong className="text-white">Local-First Privacy:</strong> "Wallet Tags" and financial metadata are
              encrypted locally or via RLS policies, ensuring your supplier list remains your trade secret.
            </li>
            <li>
              <strong className="text-white">Agent-Ready APIs:</strong> (Coming Soon) REST hooks that allow automated
              systems to check balances and request funding.
            </li>
          </ul>

          <div className="mt-12 pt-12 border-t border-zinc-800">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to upgrade your treasury?</h3>
            <div className="flex gap-4">
              <Link href="/contact" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Contact Sales <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href="https://github.com/everest-an/protocol-banks---web3"
                className="text-zinc-400 hover:text-zinc-300 flex items-center gap-1"
              >
                Contribute on GitHub <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
