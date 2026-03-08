"use client"

import { createAppKit } from "@reown/appkit/react"
import { useAppKitTheme } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { mainnet, sepolia, base } from "@reown/appkit/networks"
import { type ReactNode, useEffect, useState } from "react"
import { useTheme } from "next-themes"

// Reown Project ID - Get from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || ""

// Create Ethers adapter
const ethersAdapter = new EthersAdapter()

// Configure supported networks
const networks = [mainnet, sepolia, base] as [typeof mainnet, typeof sepolia, typeof base]

// Metadata for your app
const metadata = {
  name: "Protocol Banks",
  description: "Professional stablecoin payment infrastructure for global businesses",
  url: typeof window !== "undefined" ? window.location.origin : "https://protocolbanks.com",
  icons: [typeof window !== "undefined" ? `${window.location.origin}/favicon.ico` : ""],
}

// Initialize AppKit only if project ID is configured AND we're in the browser
if (projectId && typeof window !== "undefined") {
  createAppKit({
    adapters: [ethersAdapter],
    networks,
    metadata,
    projectId,
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "hsl(222.2 47.4% 11.2%)",
      "--w3m-border-radius-master": "8px",
    },
  })
}

/** Syncs Reown AppKit theme with next-themes — only runs on client */
function ThemeSync() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Only call useAppKitTheme after mount to avoid SSR crash
  if (!mounted) return null

  return <ThemeSyncInner resolvedTheme={resolvedTheme} />
}

/** Inner component that safely uses useAppKitTheme after client mount */
function ThemeSyncInner({ resolvedTheme }: { resolvedTheme: string | undefined }) {
  const { setThemeMode } = useAppKitTheme()

  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") {
      setThemeMode(resolvedTheme)
    }
  }, [resolvedTheme, setThemeMode])

  return null
}

export function ReownProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeSync />
      {children}
    </>
  )
}
