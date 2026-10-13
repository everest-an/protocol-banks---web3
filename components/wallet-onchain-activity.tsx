"use client"

import { useMemo } from "react"
import { ArrowDownLeft, ArrowUpRight, Download, FileCode2, Loader2 } from "lucide-react"
import { useOnchainHistory, type OnchainTx } from "@/hooks/use-onchain-history"

/**
 * The connected wallet's real on-chain activity: transfers AND contract
 * interactions across the supported chains. Renders even when the account has
 * no platform transactions — a freshly connected wallet sees its actual
 * history instead of an empty state.
 */
export function WalletOnchainActivity({ wallet, limit = 25 }: { wallet?: string | null; limit?: number }) {
  const { transactions, loading, error } = useOnchainHistory(wallet)
  const rows = useMemo(() => transactions.slice(0, limit), [transactions, limit])

  const exportCsv = () => {
    const header = ["date", "chain", "type", "direction", "counterparty", "amount", "symbol", "function", "tx_hash"]
    const lines = transactions.map((tx) => {
      const isOut = tx.from_address?.toLowerCase() === wallet?.toLowerCase()
      const counterparty = isOut ? tx.to_address : tx.from_address
      return [
        tx.timestamp,
        tx.chain,
        tx.tx_type,
        isOut ? "out" : "in",
        counterparty ?? "",
        tx.amount,
        tx.token_symbol,
        tx.contract_function ?? "",
        tx.tx_hash,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    })
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "wallet-onchain-activity.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const short = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—")

  const renderRow = (tx: OnchainTx) => {
    const isOut = tx.from_address?.toLowerCase() === wallet?.toLowerCase()
    const isContract = tx.tx_type === "contract"
    const fn = tx.contract_function?.split("(")[0] || "contract call"
    const title = isContract ? `Contract call · ${fn}` : `${isOut ? "Sent" : "Received"} ${tx.token_symbol}`
    const counterparty = isOut ? tx.to_address : tx.from_address

    return (
      <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-foreground/5 last:border-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              isContract ? "bg-blue-500/10 text-blue-500" : isOut ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
            }`}
          >
            {isContract ? (
              <FileCode2 className="h-4 w-4" />
            ) : isOut ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownLeft className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {isOut ? "To" : "From"} {short(counterparty)} · {tx.chain} ·{" "}
              {new Date(tx.timestamp).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {isContract ? (
            <div className="text-xs text-muted-foreground font-mono">gas only</div>
          ) : (
            <div className={`font-mono text-sm ${isOut ? "text-red-500" : "text-green-500"}`}>
              {isOut ? "-" : "+"}
              {Number(tx.amount) < 0.000001 ? "<0.000001" : Number(tx.amount).toFixed(6).replace(/\.?0+$/, "")}{" "}
              {tx.token_symbol}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-white/50 dark:bg-black/20 backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold">On-chain activity</h3>
          <p className="text-xs text-muted-foreground">
            Your wallet&apos;s real history — transfers and contract calls across 6 chains.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!transactions.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your wallet history…
        </div>
      ) : error ? (
        <div className="text-sm text-muted-foreground py-6 text-center">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No on-chain activity found for this wallet yet.
        </div>
      ) : (
        <div>{rows.map(renderRow)}</div>
      )}
    </div>
  )
}
