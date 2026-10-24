"use client"

/**
 * Inert stand-ins for the Reown AppKit hooks.
 *
 * AppKit is retired: the login flow uses injected EVM wallets (MetaMask)
 * directly (see hooks/use-unified-wallet.ts). The real hooks used to be
 * imported here behind `isAppKitReady`, which still pulled the whole AppKit
 * runtime into every page — including a reCAPTCHA script that took ~9 s on the
 * landing page — for branches that could never execute.
 *
 * Restoring AppKit means re-adding the `@reown/appkit/react` imports, gating
 * them on the project id again, and re-mounting ReownProvider in the root layout.
 */

export const isAppKitReady = false

type AppKitOpenOptions = {
  view?: "Connect" | "Account" | "Networks" | "ApproveTransaction" | "WalletSendTransaction" | "OnRamp" | "Swap" | "WalletReceive"
}
type AppKitOpen = (options?: AppKitOpenOptions) => Promise<void>

const noopOpen: AppKitOpen = async () => {
  console.warn("[Reown] AppKit is retired — connect an injected wallet (MetaMask) instead.")
}

export function useSafeAppKit(): { open: AppKitOpen } {
  return { open: noopOpen }
}

export function useSafeAppKitAccount(): { address: string | undefined; isConnected: boolean } {
  return { address: undefined, isConnected: false }
}

export function useSafeDisconnect(): { disconnect: () => Promise<void> } {
  return { disconnect: async () => {} }
}

export function useSafeAppKitTheme(): { setThemeMode: (mode: "light" | "dark") => void } {
  return { setThemeMode: () => {} }
}
