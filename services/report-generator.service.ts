import type { PostgrestSingleResponse } from "@supabase/supabase-js"

export type BatchReportItem = {
  recipient_address: string
  amount: string
  token_symbol: string
  status: string
  transaction_hash?: string | null
  error_reason?: string | null
}

export function generateBatchCsvReport(batchId: string, items: BatchReportItem[]): string {
  const headers = [
    "batch_id",
    "recipient_address",
    "amount",
    "token_symbol",
    "status",
    "transaction_hash",
    "error_reason",
  ]

  const lines = [headers.join(",")]
  for (const item of items) {
    const row = [
      batchId,
      item.recipient_address,
      item.amount,
      item.token_symbol,
      item.status,
      item.transaction_hash || "",
      (item.error_reason || "").replace(/\n/g, " ").replace(/,/g, " "),
    ]
    lines.push(row.join(","))
  }

  return lines.join("\n")
}
