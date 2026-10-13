"use client"

import { useEffect, useState } from "react"

export interface OnchainTx {
  id: string
  tx_hash: string
  from_address: string
  to_address: string
  token_symbol: string
  amount: string
  amount_usd: number
  timestamp: string
  chain: string
  chain_id: string
  tx_type: "native" | "token" | "contract"
  contract_function?: string
}

/**
 * The connected wallet's real on-chain history (native transfers, token
 * transfers and contract interactions) across every supported chain. No
 * platform transactions required — a fresh wallet still gets a populated
 * dashboard.
 */
export function useOnchainHistory(wallet?: string | null) {
  const [transactions, setTransactions] = useState<OnchainTx[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet) {
      setTransactions([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    // Public endpoint: on-chain data needs no wallet sign-in.
    fetch(`/api/transactions?address=${wallet}&chainId=all`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`)
        return d
      })
      .then((d) => {
        if (!cancelled) setTransactions((d.transactions ?? []) as OnchainTx[])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [wallet])

  return { transactions, loading, error }
}
