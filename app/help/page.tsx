import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Wallet, Layers, Shield, Network } from "lucide-react"

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Usage Guide & Help Center</h1>
        <p className="text-xl text-zinc-400 mb-16 leading-relaxed">
          Master the Protocol Bank interface. Learn how to manage multi-chain payments, visualize your financial
          network, and secure your enterprise assets.
        </p>

        <div className="space-y-16">
          {/* Section 1: Getting Started */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-purple-400">
                <Wallet className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Getting Started</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                Protocol Bank supports a multi-chain environment. To begin, click the "Connect Wallet" button in the top
                right corner. We support the following wallets:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong className="text-white">Ethereum & EVM:</strong> MetaMask, Rabby, Coinbase Wallet.
                </li>
                <li>
                  <strong className="text-white">Solana:</strong> Phantom, Solflare.
                </li>
                <li>
                  <strong className="text-white">Bitcoin:</strong> Unisat, Xverse.
                </li>
              </ul>
              <p className="mt-4">
                Once connected, the dashboard will automatically sync your balances for USDT, USDC, and DAI across
                supported networks.
              </p>
            </div>
          </section>

          {/* Section 2: Batch Payments */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Batch Payments & x402 Protocol</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                The Batch Payment tool allows you to send multiple transactions in a single session. You can mix
                different tokens (USDT, USDC) and recipients.
              </p>
              <h3 className="text-lg font-semibold text-white mt-6 mb-2">Using the x402 Protocol</h3>
              <p>
                Enable the <strong className="text-white">x402 Protocol</strong> toggle to use ERC-3009 gasless
                authorization for USDC payments. This allows you to sign a secure authorization message instead of
                broadcasting a standard transaction, which can then be settled by a relayer or smart contract,
                optimizing gas efficiency for high-volume enterprise operations.
              </p>
            </div>
          </section>

          {/* Section 3: Wallet Tags */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-400">
                <Network className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Network Visualization</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                The <strong>Wallet Tags</strong> (Entity Network) dashboard provides a visual map of your financial
                relationships.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong className="text-white">Tagging:</strong> Assign names and categories (e.g., "Supplier",
                  "Subsidiary") to wallet addresses.
                </li>
                <li>
                  <strong className="text-white">Interactive Graph:</strong> Visualize payment flows as animated
                  particles. Click nodes to view detailed financial history.
                </li>
                <li>
                  <strong className="text-white">Privacy:</strong> All tags are stored locally or encrypted with your
                  user session. Your labeled data is never exposed publicly.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Security */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-green-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Security & Privacy</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                Protocol Bank operates on a <strong>client-side execution model</strong>. This means:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Your private keys never leave your wallet.</li>
                <li>We do not have access to your funds.</li>
                <li>Transactions are signed directly in your browser.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
