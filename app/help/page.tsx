import { Wallet, Layers, Shield, Network, Coins, Lock, HelpCircle } from "lucide-react"

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">
          Usage Guide & Help Center
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 mb-12 sm:mb-16 leading-relaxed">
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

            {/* Cost Analysis Report */}
            <div className="mt-8 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-zinc-900/50 p-4 border-b border-zinc-800 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">Payment Cost Analysis Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900 text-zinc-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4 font-medium">Payment Method</th>
                      <th className="p-4 font-medium">Network</th>
                      <th className="p-4 font-medium">Avg. Cost (USD)</th>
                      <th className="p-4 font-medium">Settlement Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Standard Transfer (ERC-20)</td>
                      <td className="p-4">Ethereum Mainnet</td>
                      <td className="p-4">$2.00 - $15.00+</td>
                      <td className="p-4">~12 sec (1 Block)</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30 bg-blue-950/10">
                      <td className="p-4 font-medium text-blue-200">x402 Protocol (ERC-3009)</td>
                      <td className="p-4">Ethereum Mainnet</td>
                      <td className="p-4 text-green-400 font-bold">$0.00 (Gasless for User)</td>
                      <td className="p-4">Instant Signature</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Layer 2 Transfer</td>
                      <td className="p-4">Optimism / Arbitrum</td>
                      <td className="p-4">$0.01 - $0.10</td>
                      <td className="p-4">~2 sec</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Solana Transfer</td>
                      <td className="p-4">Solana</td>
                      <td className="p-4 text-green-400">&lt; $0.001</td>
                      <td className="p-4">~400 ms</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Bitcoin Transfer</td>
                      <td className="p-4">Bitcoin Network</td>
                      <td className="p-4">$1.50 - $5.00+</td>
                      <td className="p-4">~10 - 60 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-zinc-900/30 text-xs text-zinc-500 border-t border-zinc-800">
                * Costs are estimates based on average network congestion and token prices. Actual fees may vary.
              </div>
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
              <h2 className="text-2xl font-bold">Security & Privacy FAQ</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <Lock className="w-5 h-5 text-green-400" />
                  <h3 className="font-bold">Is Protocol Bank Safe?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Yes. We operate on a strict <strong>Zero-Trust / Client-Side Execution</strong> model. The application
                  runs entirely in your browser. Your private keys are managed solely by your wallet (MetaMask, Ledger,
                  etc.) and are never exposed to our servers. We cannot access or move your funds.
                </p>
              </div>

              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold">Where are my funds held?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Your funds always remain in your own non-custodial wallet or on the blockchain itself. Protocol Bank
                  is simply an interface (a "frontend") to interact with the blockchain. We do not hold user deposits.
                </p>
              </div>

              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800 md:col-span-2">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold">Is my data private?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  <strong>Blockchain Data:</strong> All transactions are public on the blockchain. This is the nature of
                  Web3.
                  <br />
                  <strong>Metadata (Tags & Notes):</strong> Your custom data (Vendor Names, Categories, Notes) is
                  encrypted and stored separately. We utilize Row-Level Security (RLS) to ensure that only your
                  authenticated wallet address can read or write this data.
                </p>
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/20 px-3 py-2 rounded border border-green-900/30 w-fit">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Audited & Verified Secure
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
