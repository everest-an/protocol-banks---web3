"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"

/**
 * Settings → Telegram: bind this wallet to a Telegram chat so trade progress
 * (opens/closes/guards) is pushed there and the assistant answers questions
 * about THIS account only.
 */
export default function TelegramSettingsPage() {
  const { address: wallet, isConnected } = useUnifiedWallet()
  const [bound, setBound] = useState<boolean | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!wallet) return
    setError(null)
    try {
      const r = await fetch("/api/trading/telegram-link", { headers: authHeaders(wallet) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`)
      setBound(!!d.bound)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
    }
  }, [wallet])

  useEffect(() => {
    void load()
  }, [load])

  const connect = async () => {
    if (!wallet) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch("/api/trading/telegram-link", { method: "POST", headers: authHeaders(wallet) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`)
      setLink(d.url as string)
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败")
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!wallet) return
    setBusy(true)
    try {
      await fetch("/api/trading/telegram-link", { method: "DELETE", headers: authHeaders(wallet) })
      setLink(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2 mb-2">
        <Send className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Telegram</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        绑定后：交易进展（开仓/平仓/风控告警）推送到你的 Telegram，助手只回答**这个钱包**的数据。
      </p>

      {!isConnected ? (
        <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
          请先连接钱包。
        </div>
      ) : (
        <div className="rounded-xl border border-border p-5 space-y-4">
          <div className="text-sm">
            钱包：<span className="font-mono">{wallet}</span>
            {bound === null ? (
              <span className="ml-2 text-muted-foreground">（查询中…）</span>
            ) : bound ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 text-xs px-2 py-0.5 font-medium">
                已绑定
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 font-medium">
                未绑定
              </span>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={connect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {bound ? "重新生成绑定链接" : "生成绑定链接"}
            </button>
            {bound && (
              <button
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
              >
                解绑
              </button>
            )}
          </div>

          {link && (
            <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                链接 15 分钟内有效。打开它并按「开始 / START」即完成绑定：
              </div>
              <a href={link} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 text-sm break-all">
                {link}
              </a>
            </div>
          )}

          <div className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
            也可以在 Telegram 里直接发 <span className="font-mono">/start 绑定码</span>；
            解绑：<span className="font-mono">/unbind</span>。
          </div>
        </div>
      )}
    </div>
  )
}
