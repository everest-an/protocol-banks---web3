import * as XLSX from "xlsx"
import { categorizeTransaction } from "./categorize"
import type { CsvImportRow } from "./ledger"

const MAX_ROWS = 5000

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/[\s_-]+/g, "")
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const normalized = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) normalized.set(normalizeKey(key), value)
  for (const key of keys) {
    const value = normalized.get(normalizeKey(key))
    if (value !== undefined && value !== null && String(value).trim() !== "") return value
  }
  return undefined
}

function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const text = String(value ?? "").trim()
  if (!text) return 0
  const negative = text.includes("(") && text.includes(")")
  const cleaned = text.replace(/[^0-9.,-]/g, "").replace(/,/g, "")
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return 0
  return negative ? -Math.abs(parsed) : parsed
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
  }
  const text = String(value ?? "").trim()
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export interface ParseCsvResult {
  rows: CsvImportRow[]
  skipped: number
  headers: string[]
}

export function parseCsvBuffer(buffer: Buffer): ParseCsvResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { rows: [], skipped: 0, headers: [] }
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  if (rawRows.length > MAX_ROWS) {
    throw new Error(`CSV has ${rawRows.length} rows; the limit is ${MAX_ROWS}.`)
  }

  const headers = rawRows.length ? Object.keys(rawRows[0]) : []
  const rows: CsvImportRow[] = []
  let skipped = 0

  for (const raw of rawRows) {
    const dateValue = pick(raw, ["date", "transaction date", "posted date", "日期", "时间"])
    const descriptionValue = pick(raw, ["description", "memo", "details", "payee", "name", "摘要", "描述"])
    const merchantValue = pick(raw, ["merchant", "counterparty", "payee", "name", "商户"])
    const categoryValue = pick(raw, ["category", "分类"])
    const currencyValue = pick(raw, ["currency", "币种"])
    const referenceValue = pick(raw, ["reference", "transaction id", "transactionid", "id", "txhash", "交易号"])
    const typeValue = String(pick(raw, ["type", "transaction type", "收支"]) ?? "").toLowerCase()

    const debit = parseMoney(pick(raw, ["debit", "withdrawal", "支出", "借方"]))
    const credit = parseMoney(pick(raw, ["credit", "deposit", "收入", "贷方"]))
    const amountValue = parseMoney(pick(raw, ["amount", "value", "金额"]))

    const occurredAt = parseDate(dateValue)
    if (!occurredAt) {
      skipped += 1
      continue
    }

    let amountUsd = 0
    let direction: "in" | "out" = "out"
    if (debit > 0 && credit <= 0 && amountValue === 0) {
      amountUsd = Math.abs(debit)
      direction = "out"
    } else if (credit > 0 && debit <= 0 && amountValue === 0) {
      amountUsd = Math.abs(credit)
      direction = "in"
    } else if (amountValue !== 0) {
      amountUsd = Math.abs(amountValue)
      direction = amountValue < 0 ? "out" : "in"
    }

    if (typeValue.includes("debit") || typeValue.includes("expense") || typeValue.includes("withdraw") || typeValue.includes("out")) {
      direction = "out"
    } else if (typeValue.includes("credit") || typeValue.includes("income") || typeValue.includes("deposit") || typeValue.includes("in")) {
      direction = "in"
    }

    if (!amountUsd || !Number.isFinite(amountUsd)) {
      skipped += 1
      continue
    }

    const description = String(descriptionValue ?? merchantValue ?? "Imported transaction").trim().slice(0, 300)
    const counterparty = merchantValue ? String(merchantValue).trim().slice(0, 200) : null
    const category = categoryValue
      ? String(categoryValue).trim().slice(0, 80)
      : categorizeTransaction({ description, counterparty, kind: direction === "in" ? "income" : "expense" })

    rows.push({
      occurredAt,
      description,
      counterparty,
      amountUsd: Number(amountUsd.toFixed(2)),
      direction,
      category,
      currency: currencyValue ? String(currencyValue).trim().toUpperCase().slice(0, 8) : "USD",
      reference: referenceValue ? String(referenceValue).trim().slice(0, 120) : null,
      raw: Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : String(value)]),
      ),
    })
  }

  return { rows, skipped, headers }
}
