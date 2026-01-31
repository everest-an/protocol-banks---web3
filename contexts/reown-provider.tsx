"use client"

import { type ReactNode, useEffect, useState, createContext, useContext, useRef } from "react"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Context to track AppKit initialization status
const AppKitContext = createContext<{ isInitialized: boolean }>({ isInitialized: false })

export const useAppKitStatus = () => useContext(AppKitContext)

export function ReownProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const initAttempted = useRef(false)
  
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return
    
    // Only attempt initialization once
    if (initAttempted.current) return
    initAttempted.current = true
    
    // Check if we're in v0 preview environment
    const isV0Preview = window.location.hostname.includes("vusercontent.net")
    if (isV0Preview) {
      console.log("[ReownProvider] Skipping AppKit initialization in v0 preview")
      return
    }
    
    if (!projectId) {
      console.log("[ReownProvider] No project ID configured")
      return
    }

    // Dynamically import and initialize AppKit
    const initAppKit = async () => {
      try {
        const { createAppKit } = await import("@reown/appkit/react")
        const { EthersAdapter } = await import("@reown/appkit-adapter-ethers")
        const { mainnet, sepolia, base } = await import("@reown/appkit/networks")
        
        const ethersAdapter = new EthersAdapter()
        const metadata = {
          name: "Protocol Banks",
          description: "Professional stablecoin payment infrastructure for global businesses",
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        }

        createAppKit({
          adapters: [ethersAdapter],
          networks: [mainnet, sepolia, base],
          metadata,
          projectId,
          themeMode: "dark",
          themeVariables: {
            "--w3m-accent": "hsl(222.2 47.4% 11.2%)",
            "--w3m-border-radius-master": "8px",
          },
        })
        
        setIsInitialized(true)
        console.log("[ReownProvider] AppKit initialized successfully")
      } catch (error) {
        console.error("[ReownProvider] Failed to initialize AppKit:", error)
      }
    }

    initAppKit()
  }, [])

  return (
    <AppKitContext.Provider value={{ isInitialized }}>
      {children}
    </AppKitContext.Provider>
  )
}
