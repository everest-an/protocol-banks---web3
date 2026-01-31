"use client"

import { createAppKit } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"
import type { ReactNode } from "react"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Configure supported networks
const networks = [mainnet, sepolia, base]

// Check if we're in v0 preview environment
const isV0Preview = typeof window !== "undefined" && 
  window.location.hostname.includes("vusercontent.net")

// Initialize AppKit at module load time (required for hooks to work)
// Only initialize if we have a project ID and not in v0 preview
let appKitInitialized = false

if (typeof window !== "undefined" && projectId && !isV0Preview) {
  try {
    const ethersAdapter = new EthersAdapter()
    const metadata = {
      name: "Protocol Banks",
      description: "Professional stablecoin payment infrastructure for global businesses",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    }

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
    
    appKitInitialized = true
    console.log("[ReownProvider] AppKit initialized successfully")
  } catch (error) {
    console.error("[ReownProvider] Failed to initialize AppKit:", error)
  }
} else if (isV0Preview) {
  console.log("[ReownProvider] Skipping AppKit initialization in v0 preview")
}

// Export for other components to check
export const isAppKitInitialized = () => appKitInitialized

export function ReownProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
