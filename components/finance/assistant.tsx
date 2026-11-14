"use client"

import { useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  "这个月钱花哪了？",
  "交易赚亏多少？",
  "现金流还能撑多久？",
  "哪些客户还没付款？",
]

export function FinanceAssistant({ wallet }: { wallet: string }) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(value: string) {
    const prompt = value.trim()
    if (!prompt) return
    setBusy(true)
    setError(null)
    setAnswer(null)
    try {
      const response = await fetch("/api/finance/assistant", {
        method: "POST",
        headers: { ...authHeaders(wallet), "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setAnswer(body.answer)
      setProvider(body.provider ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assistant unavailable.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        Ask your finance
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuestion(suggestion)
              void ask(suggestion)
            }}
            disabled={busy}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void ask(question)
            }
          }}
          placeholder="问：这个月现金流怎么样？"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          maxLength={500}
        />
        <Button size="sm" onClick={() => void ask(question)} disabled={busy || !question.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {answer ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
          {provider ? <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">via {provider}</p> : null}
        </div>
      ) : null}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Read-only: the assistant can explain your data but cannot move funds, trade, or change budgets.
      </p>
    </div>
  )
}
