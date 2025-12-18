import { createAppKit } from "@reown/appkit"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Create Ethers adapter
const ethersAdapter = new EthersAdapter()

// Configure supported networks
const networks = [mainnet, sepolia, base]

// Metadata for your app
const metadata = {
  name: "Protocol Banks",
  description: "Professional stablecoin payment infrastructure for global businesses",
  url: typeof window !== "undefined" ? window.location.origin : "https://protocolbanks.com",
  icons: [
    typeof window !== "undefined" ? `${window.location.origin}/favicon.ico` : "https://protocolbanks.com/favicon.ico",
  ],
}

let appKit: ReturnType<typeof createAppKit> | null = null

if (projectId && projectId !== "") {
  try {
    // Create AppKit instance
    // Note: Features (email, socials, onramp) should be configured on dashboard.reown.com
    // Local configuration will be ignored if remote config exists
    appKit = createAppKit({
      adapters: [ethersAdapter],
      networks,
      metadata,
      projectId,
      themeMode: "dark",
      themeVariables: {
        "--w3m-accent": "hsl(var(--primary))",
        "--w3m-border-radius-master": "8px",
      },
    })
  } catch (error) {
    console.error("[v0] Failed to initialize Reown AppKit:", error)
  }
}

export { appKit, projectId }
