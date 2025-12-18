"use client"

import { createAppKit } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"
import type { ReactNode } from "react"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

if (typeof window !== "undefined") {
  console.log("[v0] Reown Project ID configured:", projectId ? `${projectId.slice(0, 8)}...` : "NOT SET")
}

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

// To enable email/social login, configure in your Reown project dashboard:
// 1. Go to https://cloud.reown.com
// 2. Select your project
// 3. Enable "Email Wallets" and "Social Login" in Features tab
// 4. Add your domain to the "Domain" tab whitelist
if (projectId) {
  console.log("[v0] Initializing Reown AppKit...")

  createAppKit({
    adapters: [ethersAdapter],
    networks,
    metadata,
    projectId,
    // Features are managed remotely via cloud.reown.com dashboard
    // Do not set features.email, features.socials, or features.onramp here
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "hsl(222.2 47.4% 11.2%)",
      "--w3m-border-radius-master": "8px",
    },
  })

  console.log("[v0] Reown AppKit initialized successfully")
} else {
  console.warn("[v0] Reown Project ID not configured - email/social login disabled")
}

export function ReownProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
