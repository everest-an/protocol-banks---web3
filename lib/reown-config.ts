import { createAppKit } from "@reown/appkit"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base, arbitrum, bsc } from "@reown/appkit/networks"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Create Ethers adapter
const ethersAdapter = new EthersAdapter()

// Define HashKey Chain
const hashkey = {
  id: 177,
  name: "HashKey Chain",
  network: "hashkey",
  nativeCurrency: { name: "HashKey Coin", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hsk.xyz"] },
    public: { http: ["https://mainnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Scan", url: "https://hashkey.blockscout.com" },
  },
} as const

// Configure supported networks
const networks = [mainnet, sepolia, base, arbitrum, bsc, hashkey] as [
  typeof mainnet,
  typeof sepolia,
  typeof base,
  typeof arbitrum,
  typeof bsc,
  typeof hashkey,
]

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
    appKit = createAppKit({
      adapters: [ethersAdapter],
      networks,
      metadata,
      projectId,
      // Enable email and social login features
      features: {
        email: true,
        socials: ["google", "apple", "discord", "github", "x", "facebook"],
        emailShowWallets: true,
        onramp: true, // Enable fiat on-ramp for buying crypto
      },
      themeMode: "light",
      themeVariables: {
        "--w3m-accent": "hsl(222.2 47.4% 11.2%)",
        "--w3m-border-radius-master": "8px",
      },
    })
  } catch (error) {
    console.error("[v0] Failed to initialize Reown AppKit:", error)
  }
}

export { appKit, projectId }
