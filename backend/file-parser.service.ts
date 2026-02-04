/**
 * File Parser Service
 * Parses CSV and Excel files for batch payments
 */

import * as XLSX from 'xlsx'

export interface ParsedRow {
  recipient: string
  amount: string | number
  token?: string
  memo?: string
  [key: string]: string | number | undefined
}

export interface ParseResult {
  success: boolean
  data: ParsedRow[]
  errors: string[]
  headers: string[]
}

// Expected column mappings
const COLUMN_MAPPINGS: Record<string, string[]> = {
  recipient: ['recipient', 'address', 'wallet', 'wallet_address', 'to', 'payee'],
  amount: ['amount', 'value', 'sum', 'payment', 'pay'],
  token: ['token', 'currency', 'asset', 'coin'],
  memo: ['memo', 'note', 'description', 'reference', 'notes'],
}

/**
 * Find matching column name from headers
 */
function findColumn(headers: string[], field: string): string | undefined {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  const possibleNames = COLUMN_MAPPINGS[field] || [field]
  
  for (const name of possibleNames) {
    const index = normalizedHeaders.indexOf(name.toLowerCase())
    if (index !== -1) {
      return headers[index]
    }
  }
  return undefined
}

/**
 * Parse CSV string
 */
export function parseCsv(csvString: string): ParseResult {
  const errors: string[] = []
  const data: ParsedRow[] = []
  
  try {
    const lines = csvString.trim().split('\n')
    if (lines.length < 2) {
      return { success: false, data: [], errors: ['CSV must have headers and at least one data row'], headers: [] }
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    
    // Find column mappings
    const recipientCol = findColumn(headers, 'recipient')
    const amountCol = findColumn(headers, 'amount')
    const tokenCol = findColumn(headers, 'token')
    const memoCol = findColumn(headers, 'memo')
    
    if (!recipientCol) {
      errors.push('Missing required column: recipient (or address, wallet)')
    }
    if (!amountCol) {
      errors.push('Missing required column: amount (or value, sum)')
    }
    
    if (errors.length > 0) {
      return { success: false, data: [], errors, headers }
    }
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
      const row: ParsedRow = {
        recipient: '',
        amount: 0,
      }
      
      headers.forEach((header, index) => {
        const value = values[index] || ''
        if (header === recipientCol) row.recipient = value
        else if (header === amountCol) row.amount = parseFloat(value) || value
        else if (header === tokenCol) row.token = value
        else if (header === memoCol) row.memo = value
        else row[header] = value
      })
      
      if (row.recipient || row.amount) {
        data.push(row)
      }
    }
    
    return { success: true, data, errors: [], headers }
  } catch (err) {
    return { success: false, data: [], errors: [`Failed to parse CSV: ${err}`], headers: [] }
  }
}

/**
 * Parse Excel file
 */
export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = []
  const data: ParsedRow[] = []
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
    
    if (jsonData.length < 2) {
      return { success: false, data: [], errors: ['Excel file must have headers and at least one data row'], headers: [] }
    }
    
    // Get headers from first row
    const headers = jsonData[0].map(h => String(h || '').trim())
    
    // Find column mappings
    const recipientCol = findColumn(headers, 'recipient')
    const amountCol = findColumn(headers, 'amount')
    const tokenCol = findColumn(headers, 'token')
    const memoCol = findColumn(headers, 'memo')
    
    if (!recipientCol) {
      errors.push('Missing required column: recipient (or address, wallet)')
    }
    if (!amountCol) {
      errors.push('Missing required column: amount (or value, sum)')
    }
    
    if (errors.length > 0) {
      return { success: false, data: [], errors, headers }
    }
    
    // Parse data rows
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i]
      if (!rowData || rowData.length === 0) continue
      
      const row: ParsedRow = {
        recipient: '',
        amount: 0,
      }
      
      headers.forEach((header, index) => {
        const value = rowData[index]
        if (header === recipientCol) row.recipient = String(value || '')
        else if (header === amountCol) row.amount = typeof value === 'number' ? value : parseFloat(String(value)) || 0
        else if (header === tokenCol) row.token = String(value || '')
        else if (header === memoCol) row.memo = String(value || '')
        else row[header] = value
      })
      
      if (row.recipient || row.amount) {
        data.push(row)
      }
    }
    
    return { success: true, data, errors: [], headers }
  } catch (err) {
    return { success: false, data: [], errors: [`Failed to parse Excel file: ${err}`], headers: [] }
  }
}

/**
 * Detect file type and parse accordingly
 */
export function parseFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const result = e.target?.result
      
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        resolve(parseCsv(result as string))
      } else if (file.name.match(/\.xlsx?$/i) || file.type.includes('spreadsheet')) {
        resolve(parseExcel(result as ArrayBuffer))
      } else {
        resolve({ success: false, data: [], errors: ['Unsupported file type'], headers: [] })
      }
    }
    
    reader.onerror = () => {
      resolve({ success: false, data: [], errors: ['Failed to read file'], headers: [] })
    }
    
    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}
