// Excel and CSV parser for batch payments
// Supports .csv, .xlsx, .xls files with automatic field detection

import * as XLSX from "xlsx"

export interface ParsedRecipient {
  address: string
  amount: string
  token: string
  vendorName?: string
  vendorId?: string
  memo?: string
  chainId?: number
}

export interface ParseResult {
  success: boolean
  recipients: ParsedRecipient[]
  errors: string[]
  warnings: string[]
  detectedFields: string[]
}

// Field name aliases for flexible column matching
const FIELD_ALIASES: Record<string, string[]> = {
  address: [
    "address",
    "wallet",
    "wallet_address",
    "walletaddress",
    "recipient",
    "recipient_address",
    "to",
    "to_address",
    "destination",
  ],
  amount: ["amount", "value", "sum", "total", "payment", "payment_amount"],
  token: ["token", "currency", "coin", "asset", "symbol", "token_symbol"],
  vendorName: ["vendorname", "vendor_name", "vendor", "name", "recipient_name", "payee", "payee_name", "company"],
  vendorId: ["vendorid", "vendor_id", "id", "reference", "ref", "invoice", "invoice_id"],
  memo: ["memo", "note", "notes", "description", "comment", "remarks"],
  chainId: ["chainid", "chain_id", "chain", "network", "network_id"],
}

// Normalize header name for matching
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// Find the standard field name for a header
function matchHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header)

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
      return field
    }
  }

  return null
}

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Validate amount
function isValidAmount(amount: string): boolean {
  const num = Number.parseFloat(amount)
  return !isNaN(num) && num > 0
}

// Parse CSV text content
function parseCSVContent(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentCell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        currentRow.push(currentCell.trim())
        currentCell = ""
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentCell.trim())
        if (currentRow.some((cell) => cell !== "")) {
          rows.push(currentRow)
        }
        currentRow = []
        currentCell = ""
        if (char === "\r") i++ // Skip \n in \r\n
      } else if (char !== "\r") {
        currentCell += char
      }
    }
  }

  // Handle last cell and row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow)
    }
  }

  return rows
}

// Main parse function
export async function parsePaymentFile(file: File): Promise<ParseResult> {
  const result: ParseResult = {
    success: false,
    recipients: [],
    errors: [],
    warnings: [],
    detectedFields: [],
  }

  try {
    const fileName = file.name.toLowerCase()
    let rows: string[][] = []

    // Parse based on file type
    if (fileName.endsWith(".csv")) {
      const text = await file.text()
      rows = parseCSVContent(text)
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })

      // Get first sheet
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        result.errors.push("Excel file has no sheets")
        return result
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 })
      rows = jsonData.map((row) => (row as any[]).map((cell) => String(cell ?? "")))
    } else {
      result.errors.push(`Unsupported file type: ${fileName}. Please use .csv, .xlsx, or .xls`)
      return result
    }

    if (rows.length < 2) {
      result.errors.push("File must contain at least a header row and one data row")
      return result
    }

    // Parse headers
    const headers = rows[0]
    const fieldMap: Record<number, string> = {}

    headers.forEach((header, index) => {
      const field = matchHeaderToField(header)
      if (field) {
        fieldMap[index] = field
        result.detectedFields.push(`${header} → ${field}`)
      }
    })

    // Check required fields
    const mappedFields = Object.values(fieldMap)
    if (!mappedFields.includes("address")) {
      result.errors.push("Missing required column: address (or wallet, recipient, to)")
      return result
    }
    if (!mappedFields.includes("amount")) {
      result.errors.push("Missing required column: amount (or value, sum, payment)")
      return result
    }

    // Default token if not specified
    const hasTokenColumn = mappedFields.includes("token")
    if (!hasTokenColumn) {
      result.warnings.push("No token column found, defaulting to USDT")
    }

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowData: Record<string, string> = {}

      // Map columns to fields
      Object.entries(fieldMap).forEach(([indexStr, field]) => {
        const index = Number.parseInt(indexStr)
        rowData[field] = row[index] || ""
      })

      // Skip empty rows
      if (!rowData.address && !rowData.amount) {
        continue
      }

      // Validate address
      if (!rowData.address) {
        result.warnings.push(`Row ${i + 1}: Missing address, skipped`)
        continue
      }

      if (!isValidAddress(rowData.address)) {
        result.warnings.push(`Row ${i + 1}: Invalid address format "${rowData.address}", skipped`)
        continue
      }

      // Validate amount
      if (!rowData.amount) {
        result.warnings.push(`Row ${i + 1}: Missing amount, skipped`)
        continue
      }

      if (!isValidAmount(rowData.amount)) {
        result.warnings.push(`Row ${i + 1}: Invalid amount "${rowData.amount}", skipped`)
        continue
      }

      // Create recipient
      const recipient: ParsedRecipient = {
        address: rowData.address,
        amount: rowData.amount,
        token: rowData.token || "USDT",
        vendorName: rowData.vendorName,
        vendorId: rowData.vendorId,
        memo: rowData.memo,
        chainId: rowData.chainId ? Number.parseInt(rowData.chainId) : undefined,
      }

      result.recipients.push(recipient)
    }

    if (result.recipients.length === 0) {
      result.errors.push("No valid recipients found in file")
      return result
    }

    result.success = true
    return result
  } catch (error: any) {
    result.errors.push(`Failed to parse file: ${error.message}`)
    return result
  }
}

// Generate sample CSV template
export function generateSampleCSV(): string {
  const headers = ["address", "amount", "token", "vendorName", "vendorId", "memo"]
  const sampleRows = [
    ["0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF", "1000", "USDT", "Acme Corp", "INV-001", "Monthly payment"],
    ["0x8B3392483BA26D65E331dB86D4F430E9B3814E5e", "2500", "USDC", "Tech Solutions", "INV-002", "Software license"],
    ["0x1234567890123456789012345678901234567890", "500", "DAI", "Marketing Agency", "INV-003", "Campaign fees"],
  ]

  return [headers.join(","), ...sampleRows.map((row) => row.join(","))].join("\n")
}

// Generate sample Excel template
export function generateSampleExcel(): Blob {
  const headers = ["address", "amount", "token", "vendorName", "vendorId", "memo"]
  const sampleData = [
    headers,
    ["0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF", "1000", "USDT", "Acme Corp", "INV-001", "Monthly payment"],
    ["0x8B3392483BA26D65E331dB86D4F430E9B3814E5e", "2500", "USDC", "Tech Solutions", "INV-002", "Software license"],
    ["0x1234567890123456789012345678901234567890", "500", "DAI", "Marketing Agency", "INV-003", "Campaign fees"],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sampleData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Payment")

  // Set column widths
  worksheet["!cols"] = [
    { wch: 45 }, // address
    { wch: 12 }, // amount
    { wch: 8 }, // token
    { wch: 20 }, // vendorName
    { wch: 15 }, // vendorId
    { wch: 25 }, // memo
  ]

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}
