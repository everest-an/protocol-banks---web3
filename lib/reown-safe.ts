"use client"

/**
 * Reown AppKit hooks that tolerate AppKit not being initialised.
 *
 * `createAppKit` only runs when NEXT_PUBLIC_REOWN_PROJECT_ID is configured
 * (see contexts/reown-provider.tsx). Every AppKit hook throws when it wasn't
 * called, and because these hooks are used in the header and the auth gateway —
 * both mounted on every route — a single missing environment variable takes down
 * the entire site with "Application error: a client-side exception has occurred".
 *
 * These wrappers return inert values instead, so a deployment without wallet
 * connect configured degrades to "wallet connect unavailable" rather than a
 * blank page.
 *
 * Calling the underlying hooks conditionally is safe here: `isAppKitReady` is
 * derived from a build-time environment variable, so it is constant for the life
 * of the page and hook order never changes between renders.
 */

import {
  useAppKit,
  useAppKitAccount,
  useAppKitTheme,
  useDisconnect,
} from "@reown/appkit/react"

/** Whether AppKit was initialised — i.e. whether a project ID is configured. */
export const isAppKitReady = Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID)

type AppKitOpen = ReturnType<typeof useAppKit>["open"]

const noopOpen: AppKitOpen = (async () => {
  console.warn(
    "[Reown] Wallet modal unavailable: NEXT_PUBLIC_REOWN_PROJECT_ID is not configured."
  )
}) as AppKitOpen

export function useSafeAppKit(): { open: AppKitOpen } {
  if (!isAppKitReady) return { open: noopOpen }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- constant condition, see module docs
  return useAppKit()
}

export function useSafeAppKitAccount(): {
  address: string | undefined
  isConnected: boolean
} {
  if (!isAppKitReady) return { address: undefined, isConnected: false }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- constant condition, see module docs
  const account = useAppKitAccount()
  return { address: account.address, isConnected: account.isConnected }
}

export function useSafeDisconnect(): { disconnect: () => Promise<void> } {
  if (!isAppKitReady) return { disconnect: async () => {} }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- constant condition, see module docs
  const { disconnect } = useDisconnect()
  return { disconnect: async () => { await disconnect() } }
}

export function useSafeAppKitTheme(): {
  setThemeMode: (mode: "light" | "dark") => void
} {
  if (!isAppKitReady) return { setThemeMode: () => {} }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- constant condition, see module docs
  const { setThemeMode } = useAppKitTheme()
  return { setThemeMode: setThemeMode as (mode: "light" | "dark") => void }
}
