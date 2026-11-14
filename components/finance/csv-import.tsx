"use client"

import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authHeaders } from "@/lib/authenticated-fetch"

interface CsvImportProps {
  wallet: string
  onImported: () => void
}

export function CsvImport({ wallet, onImported }: CsvImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [accountName, setAccountName] = useState("Bank account")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload() {
    if (!file) {
      setError("Choose a CSV file first.")
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("accountName", accountName)
      const response = await fetch("/api/finance/import", {
        method: "POST",
        headers: authHeaders(wallet),
        body: form,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setMessage(`Imported ${body.imported} rows · ${body.inserted} new · ${body.skipped} skipped`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
      onImported()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </Button>
      {open ? (
        <div className="mt-3 w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">Import a bank statement</p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV or Excel. Columns are detected automatically: date, description, amount/debit/credit,
            category, merchant.
          </p>
          <div className="mt-3 space-y-2">
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Account name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-medium"
            />
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {message ? <p className="mt-2 text-xs text-emerald-600">{message}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void upload()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? "Importing" : "Import"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
