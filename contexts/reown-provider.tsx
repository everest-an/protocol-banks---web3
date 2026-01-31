"use client"

import { createAppKit } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"
import { type ReactNode, useEffect, useRef } from "react"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Configure supported networks
const networks = [mainnet, sepolia, base]

export function ReownProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false)

  useEffect(() => {
    // Only initialize once and only on the client
    if (initialized.current || !projectId) return
    
    // Skip initialization in v0 preview environment to avoid blob URL worker errors
    const isV0Preview = typeof window !== "undefined" && 
      window.location.hostname.includes("vusercontent.net")
    
    if (isV0Preview) {
      console.log("[ReownProvider] Skipping AppKit initialization in v0 preview")
      return
    }

    try {
      // Create Ethers adapter
      const ethersAdapter = new EthersAdapter()

      // Metadata for your app
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
      
      initialized.current = true
    } catch (error) {
      console.error("[ReownProvider] Failed to initialize AppKit:", error)
    }
  }, [])

  return <>{children}</>
}
