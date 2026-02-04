import type { Metadata } from "next"
import { OmnichainVault } from "@/components/omnichain-vault"
import { QuickSwapWidget } from "@/components/quick-swap-widget"

export const metadata: Metadata = {
  title: "Omnichain Vault | Protocol Banks",
  description: "Manage all your assets across chains from a single interface. Powered by ZetaChain.",
}

export default function OmnichainPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cross-Chain Hub</h1>
        <p className="text-muted-foreground">
          One address, all chains. Manage Bitcoin, Ethereum, Solana, and more from a single interface.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OmnichainVault />
        </div>
        <div className="lg:col-span-1">
          <QuickSwapWidget />
        </div>
      </div>
    </main>
  )
}
