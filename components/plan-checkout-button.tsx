"use client"

import { useState } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { useToast } from "@/hooks/use-toast"

/**
 * Starts a Stripe Checkout session for a paid API plan. Billing is tied to the
 * wallet that owns the keys, so an unconnected visitor is asked to connect.
 */
export function PlanCheckoutButton({
  plan,
  label,
  featured = false,
}: {
  plan: "builder" | "growth" | "scale"
  label: string
  featured?: boolean
}) {
  const { address, connectWallet } = useUnifiedWallet()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const start = async () => {
    if (!address) {
      connectWallet()
      toast({
        title: "Connect your wallet",
        description: "Billing is tied to the account you trade with. Connect, then subscribe.",
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ plan }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.message || data.error || "Checkout failed")
      }
      window.location.href = data.url
    } catch (error) {
      toast({
        title: "Could not start checkout",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
        featured
          ? "bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
          : "border border-[#E4E2DD] hover:bg-[#F7F6F3]"
      }`}
    >
      {loading ? "Redirecting…" : label}
    </button>
  )
}
