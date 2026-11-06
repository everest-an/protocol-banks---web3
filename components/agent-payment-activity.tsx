"use client"

import { ArrowUpRight, Bot, CheckCircle2, Clock, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react"
import { useAgentPayments, type AgentPayment } from "@/hooks/use-agent-payments"

const short = (address?: string) => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—")

const TX_EXPLORERS: Record<string, string> = {
  base: "https://basescan.org/tx/",
  ethereum: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  bsc: "https://bscscan.com/tx/",
}

const txExplorer = (chain: string, txHash: string) =>
  `${TX_EXPLORERS[chain.toLowerCase()] || "https://basescan.org/tx/"}${txHash}`

function statusMeta(status: AgentPayment["status"]) {
  if (status === "confirmed") {
    return { label: "Confirmed", className: "bg-green-500/10 text-green-600 border-green-500/20", Icon: CheckCircle2 }
  }
  if (status === "failed") {
    return { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20", Icon: XCircle }
  }
  if (status === "submitted") {
    return { label: "Submitted", className: "bg-blue-500/10 text-blue-600 border-blue-500/20", Icon: Clock }
  }
  return { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", Icon: Clock }
}

export function AgentPaymentActivity({ wallet, isDemoMode = false }: { wallet?: string | null; isDemoMode?: boolean }) {
  const { payments, loading, error, refresh } = useAgentPayments(wallet, !isDemoMode)

  if (isDemoMode || !wallet) return null

  return (
    <div className="rounded-xl border border-foreground/10 bg-white/50 dark:bg-black/20 backdrop-blur-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agent payments
          </h3>
          <p className="text-xs text-muted-foreground">
            Payer-signed EIP-3009 payments from this wallet, with the durable status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading agent payments...
        </div>
      ) : error ? (
        <div className="text-sm text-muted-foreground py-6 text-center px-4">{error}</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No agent payments for this wallet yet.
        </div>
      ) : (
        <div>
          {payments.map((payment) => {
            const meta = statusMeta(payment.status)
            return (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-3 py-3 border-b border-foreground/5 last:border-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      ${Number(payment.amountUsd).toFixed(2)} {payment.token}
                      <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>
                        <meta.Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      To {short(payment.to)} · {payment.chain} · {new Date(payment.createdAt).toLocaleString()}
                    </div>
                    {payment.error ? (
                      <div className="text-xs text-red-500/90 truncate max-w-[60ch]" title={payment.error}>
                        {payment.error}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {payment.txHash ? (
                    <a
                      href={txExplorer(payment.chain, payment.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                    >
                      {payment.txHash.slice(0, 10)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No tx</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
