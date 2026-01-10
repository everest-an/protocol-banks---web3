"use client"

import { createAppKit } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"
import type { ReactNode } from "react"

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
  icons: [typeof window !== "undefined" ? `${window.location.origin}/favicon.ico` : ""],
}

// Initialize AppKit only if project ID is configured
// Features (email, socials, onramp) are managed via cloud.reown.com dashboard
if (projectId && typeof window !== "undefined") {
  createAppKit({
    adapters: [ethersAdapter],
    networks,
    metadata,
    projectId,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "hsl(222.2 47.4% 11.2%)",
      "--w3m-border-radius-master": "8px",
    },
  })
}

export function ReownProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
