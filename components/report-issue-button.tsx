"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { MessageSquareWarning, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"

/**
 * Floating "Report an issue" button — visible on every product page.
 * Submits to /api/support/report, which emails the founder.
 */
export function ReportIssueButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const pathname = usePathname()
  const { address } = useUnifiedWallet()
  const { toast } = useToast()

  const submit = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          page: pathname || "/",
          walletAddress: address ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Submission failed")
      toast({ title: "Report sent", description: "Thanks! The team has been notified." })
      setMessage("")
      setOpen(false)
    } catch (e) {
      toast({
        title: "Could not send report",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex items-center gap-2 rounded-full border border-white/20 bg-background/80 backdrop-blur-xl px-3.5 py-2.5 text-xs font-medium text-muted-foreground shadow-lg hover:text-foreground hover:border-primary/30 transition-colors"
        aria-label="Report an issue"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span className="hidden sm:inline">Report an issue</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Report an issue</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Something not working? Tell us what happened — the team gets an email immediately.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What went wrong? What were you trying to do?"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-white/10 bg-background/60 p-3 text-sm outline-none focus:border-primary/40 resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={sending || !message.trim()}>
                {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Send Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
