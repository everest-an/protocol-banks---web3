import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Download, FileText } from "lucide-react"
import Link from "next/link"

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-12 border-b border-zinc-800 pb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Protocol Bank Whitepaper</h1>
          <p className="text-xl text-zinc-400 max-w-2xl">
            Technical architecture and economic model for the next-generation enterprise crypto payment infrastructure.
          </p>
          <div className="flex gap-4 mt-8">
            <Link
              href="https://github.com/everest-an/protocol-banks---web3"
              target="_blank"
              className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded hover:bg-zinc-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Link>
            <Link
              href="https://github.com/everest-an/protocol-banks---web3"
              target="_blank"
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 text-white rounded hover:bg-zinc-800 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View on GitHub
            </Link>
          </div>
        </div>

        <article className="prose prose-invert max-w-none prose-lg">
          <h2 className="text-3xl font-bold text-white mb-6">Abstract</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Protocol Bank introduces a decentralized settlement layer designed specifically for enterprise treasury
            management. By unifying fragmented blockchain networks (Ethereum, Solana, Bitcoin) into a single operational
            interface, Protocol Bank enables corporations to manage crypto payroll, supplier payments, and inter-entity
            settlements with the same ease as traditional banking, but with the speed and transparency of Web3.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6">1. The Enterprise Problem</h2>
          <p className="text-zinc-400 mb-6">
            Modern enterprises face three critical challenges when adopting crypto payments:
          </p>
          <ul className="space-y-4 mb-8 text-zinc-400 list-disc pl-6">
            <li>
              <strong className="text-white">Operational Fragmentation:</strong> Finance teams must manage multiple
              wallets, seed phrases, and disparate dApps for different chains.
            </li>
            <li>
              <strong className="text-white">Lack of Context:</strong> Blockchain explorers show raw hashes, not
              business context (e.g., "Invoice #2024-001 payment to AWS").
            </li>
            <li>
              <strong className="text-white">Inefficient Execution:</strong> processing hundreds of payments manually is
              error-prone and gas-intensive.
            </li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6">2. The Protocol Bank Solution</h2>
          <p className="text-zinc-400 mb-8">
            Protocol Bank acts as an aggregation layer on top of existing settlement networks. It provides:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 not-prose">
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <h3 className="text-xl font-bold text-white mb-2">Unified Batching</h3>
              <p className="text-zinc-400 text-sm">
                Smart contract logic that aggregates payments across tokens (USDT, USDC, DAI) into single signing
                events.
              </p>
            </div>
            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <h3 className="text-xl font-bold text-white mb-2">Identity Layer</h3>
              <p className="text-zinc-400 text-sm">
                Local-first "Wallet Tags" system that maps on-chain addresses to real-world corporate entities without
                exposing sensitive data.
              </p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-6">3. Technology Stack</h2>
          <p className="text-zinc-400 mb-4">
            The platform leverages cutting-edge standards to ensure compatibility and security:
          </p>
          <ul className="space-y-4 mb-8 text-zinc-400 list-disc pl-6">
            <li>
              <strong className="text-white">x402 Protocol / ERC-3009:</strong> Implementation of
              transferWithAuthorization for gas-abstracted payments, allowing treasury managers to sign off on payments
              that are executed by relayers.
            </li>
            <li>
              <strong className="text-white">Client-Side Encryption:</strong> All vendor metadata is encrypted locally,
              ensuring that the "graph" of a company's financial network remains private.
            </li>
          </ul>
        </article>
      </main>
      <Footer />
    </div>
  )
}
