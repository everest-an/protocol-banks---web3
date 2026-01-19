import { parse } from "csv-parse/sync"
import XLSX from "xlsx"
import { z } from "zod"

const PAYMENT_ROW_SCHEMA = z.object({
  recipient_address: z.string().min(1),
  amount: z.string().min(1),
  token_symbol: z.string().min(1),
})

export type ParsedPaymentItem = {
  recipient_address: string
  amount: string
  token_symbol: string
  row: number
}

export type ParseResult = {
  items: ParsedPaymentItem[]
  errors: { row: number; error: string }[]
  totalRows: number
}

const COLUMN_ALIASES = ["recipient", "address", "wallet", "to", "destination", "recipient_address"]

function normalizeHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const lower = h.trim().toLowerCase()
    if (COLUMN_ALIASES.includes(lower)) map[lower] = "recipient_address"
    if (lower === "amount") map[lower] = "amount"
    if (lower === "token" || lower === "token_symbol") map[lower] = "token_symbol"
  }
  return map
}

function remapRow(row: Record<string, string>, headerMap: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    const mapped = headerMap[key.trim().toLowerCase()]
    if (mapped) out[mapped] = value
  }
  return out
}

export function parseCsv(content: string): ParseResult {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  const headerMap = normalizeHeaders(Object.keys(records[0] || {}))
  const errors: { row: number; error: string }[] = []
  const items: ParsedPaymentItem[] = []

  records.slice(0, 10000).forEach((row, idx) => {
    const mapped = remapRow(row, headerMap)
    const result = PAYMENT_ROW_SCHEMA.safeParse(mapped)
    if (!result.success) {
      errors.push({ row: idx + 2, error: "Missing required columns" })
      return
    }
    items.push({ ...result.data, row: idx + 2 })
  })

  return { items, errors, totalRows: records.length }
}

export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" })
  const errors: { row: number; error: string }[] = []
  const items: ParsedPaymentItem[] = []
  let totalRows = 0

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })
    if (!rows.length) return

    const headerMap = normalizeHeaders(Object.keys(rows[0]))
    rows.slice(0, 10000).forEach((row, idx) => {
      totalRows++
      const mapped = remapRow(row, headerMap)
      const result = PAYMENT_ROW_SCHEMA.safeParse(mapped)
      if (!result.success) {
        errors.push({ row: idx + 2, error: "Missing required columns" })
        return
      }
      items.push({ ...result.data, row: idx + 2 })
    })
  })

  return { items, errors, totalRows }
}
