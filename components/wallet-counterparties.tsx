"use client"

import { useMemo, useState } from "react"
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, FileCode2, Loader2, Plus, UserCheck } from "lucide-react"
import { useOnchainHistory } from "@/hooks/use-onchain-history"

interface Contact {
  id: string
  name?: string
  wallet_address: string
}

/**
 * Counterparties discovered from the connected wallet's own on-chain history.
 * Contacts the wallet has actually transacted with are auto-marked; everyone
 * else is one click away from becoming a contact (prefilled address).
 */
export function WalletCounterparties({
  wallet,
  contacts,
  onAddContact,
  limit = 8,
}: {
  wallet?: string | null
  contacts: Contact[]
  onAddContact: (address: string) => void
  limit?: number
}) {
  const { transactions, loading, error } = useOnchainHistory(wallet)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { rows, txsByCounterparty } = useMemo(() => {
    const byAddress = new Map<string, typeof transactions>()
    if (!wallet) return { rows: [], txsByCounterparty: byAddress }
    const me = wallet.toLowerCase()
    const contactByAddress = new Map(contacts.map((c) => [c.wallet_address?.toLowerCase(), c]))
    const agg = new Map<string, { count: number; volume: number; lastAt: string }>()
    for (const tx of transactions) {
      const from = tx.from_address?.toLowerCase()
      const to = tx.to_address?.toLowerCase()
      if (!from || !to) continue
      const counterparty = from === me ? to : from
      if (!counterparty || counterparty === me) continue
      const existing = agg.get(counterparty)
      if (existing) {
        existing.count += 1
        existing.volume += Number(tx.amount_usd) || 0
        if (tx.timestamp > existing.lastAt) existing.lastAt = tx.timestamp
      } else {
        agg.set(counterparty, { count: 1, volume: Number(tx.amount_usd) || 0, lastAt: tx.timestamp })
      }
      const list = byAddress.get(counterparty) ?? []
      if (list.length < 5) {
        list.push(tx)
        byAddress.set(counterparty, list)
      }
    }
    const rows = [...agg.entries()]
      .map(([address, v]) => ({
        address,
        ...v,
        contact: contactByAddress.get(address) ?? null,
      }))
      .sort((a, b) => b.count - a.count || b.volume - a.volume)
      .slice(0, limit)
    return { rows, txsByCounterparty: byAddress }
  }, [transactions, wallet, contacts, limit])

  if (!wallet) return null

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">On-chain counterparties</h3>
          <p className="text-xs text-muted-foreground">
            Who your wallet actually transacts with — tagged against your contacts.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning your wallet history…
        </div>
      ) : error ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">No counterparties found yet.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const isOpen = expanded === r.address
            const txs = txsByCounterparty.get(r.address) ?? []
            return (
              <div key={r.address} className="rounded-lg border border-border/60">
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(isOpen ? null : r.address)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs sm:text-sm truncate">{short(r.address)}</span>
                      {r.contact && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 font-medium">
                          <UserCheck className="h-3 w-3" />
                          {r.contact.name || "Contact"}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.count} transaction{r.count > 1 ? "s" : ""} · {new Date(r.lastAt).toLocaleDateString()}
                      {txs.length > 0 && <span className="ml-1 text-primary/70">{isOpen ? "· hide" : "· details"}</span>}
                    </div>
                  </div>
                  {r.contact ? (
                    <span className="text-[11px] text-muted-foreground shrink-0">tagged</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddContact(r.address)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add contact
                    </button>
                  )}
                </div>
                {isOpen && txs.length > 0 && (
                  <div className="border-t border-border/60 px-3 py-2 space-y-1.5 bg-muted/10">
                    {txs.map((tx) => {
                      const out = tx.from_address?.toLowerCase() === wallet?.toLowerCase()
                      const isContract = tx.tx_type === "contract"
                      return (
                        <div key={tx.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 text-muted-foreground min-w-0 truncate">
                            {isContract ? (
                              <FileCode2 className="h-3 w-3 shrink-0" />
                            ) : out ? (
                              <ArrowUpRight className="h-3 w-3 text-red-500 shrink-0" />
                            ) : (
                              <ArrowDownLeft className="h-3 w-3 text-green-500 shrink-0" />
                            )}
                            {new Date(tx.timestamp).toLocaleString()} · {tx.chain}
                          </span>
                          <span className="font-mono shrink-0">
                            {isContract
                              ? tx.contract_function?.split("(")[0] || "contract call"
                              : `${out ? "-" : "+"}${Number(tx.amount).toFixed(6).replace(/\.?0+$/, "")} ${tx.token_symbol}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
