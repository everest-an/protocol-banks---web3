/**
 * Report Export Service
 * Generates CSV, Excel, and PDF reports for payment transactions
 */

import * as XLSX from "xlsx"
import { createClient } from "@/lib/supabase/server"

// ============================================
// Types
// ============================================

export type ReportType = "transactions" | "monthly" | "recipient"
export type ReportFormat = "csv" | "excel" | "pdf"

export interface Transaction {
  id: string
  tx_hash: string
  from_address: string
  to_address: string
  amount: string
  token: string
  status: string
  created_at: string
  recipient_name?: string
  memo?: string
}

export interface ReportOptions {
  type: ReportType
  format: ReportFormat
  startDate: string
  endDate: string
  walletAddress: string
  pdfOptions?: PDFOptions
}

export interface PDFOptions {
  companyName?: string
  companyAddress?: string
  includeLogo?: boolean
  includeQRCode?: boolean
}

export interface ReportSummary {
  totalTransactions: number
  totalAmount: number
  token: string
  uniqueRecipients: number
  dateRange: {
    start: string
    end: string
  }
}

export interface MonthlyData {
  month: string
  transactionCount: number
  totalAmount: number
  recipients: string[]
}

export interface RecipientData {
  address: string
  name?: string
  transactionCount: number
  totalAmount: number
  lastTransaction: string
}

// ============================================
// Report Service
// ============================================

export class ReportService {
  /**
   * Fetch transactions for report
   */
  async fetchTransactions(
    walletAddress: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("from_address", walletAddress.toLowerCase())
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`)
    }

    return data || []
  }

  /**
   * Calculate report summary
   */
  calculateSummary(transactions: Transaction[], startDate: string, endDate: string): ReportSummary {
    const uniqueRecipients = new Set(transactions.map((tx) => tx.to_address.toLowerCase()))

    const totalAmount = transactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.amount || "0")
    }, 0)

    const token = transactions[0]?.token || "USDC"

    return {
      totalTransactions: transactions.length,
      totalAmount,
      token,
      uniqueRecipients: uniqueRecipients.size,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    }
  }

  /**
   * Group transactions by month
   */
  groupByMonth(transactions: Transaction[]): MonthlyData[] {
    const monthMap = new Map<string, MonthlyData>()

    transactions.forEach((tx) => {
      const date = new Date(tx.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          transactionCount: 0,
          totalAmount: 0,
          recipients: [],
        })
      }

      const monthData = monthMap.get(monthKey)!
      monthData.transactionCount++
      monthData.totalAmount += parseFloat(tx.amount || "0")
      if (!monthData.recipients.includes(tx.to_address)) {
        monthData.recipients.push(tx.to_address)
      }
    })

    return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month))
  }

  /**
   * Group transactions by recipient
   */
  groupByRecipient(transactions: Transaction[]): RecipientData[] {
    const recipientMap = new Map<string, RecipientData>()

    transactions.forEach((tx) => {
      const address = tx.to_address.toLowerCase()

      if (!recipientMap.has(address)) {
        recipientMap.set(address, {
          address: tx.to_address,
          name: tx.recipient_name,
          transactionCount: 0,
          totalAmount: 0,
          lastTransaction: tx.created_at,
        })
      }

      const recipientData = recipientMap.get(address)!
      recipientData.transactionCount++
      recipientData.totalAmount += parseFloat(tx.amount || "0")
      if (new Date(tx.created_at) > new Date(recipientData.lastTransaction)) {
        recipientData.lastTransaction = tx.created_at
      }
    })

    return Array.from(recipientMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }

  /**
   * Generate CSV content
   */
  generateCSV(transactions: Transaction[]): string {
    const headers = ["Date", "Recipient", "Amount", "Token", "Status", "Tx Hash", "Memo"]
    const rows = transactions.map((tx) => [
      new Date(tx.created_at).toISOString().split("T")[0],
      tx.to_address,
      tx.amount,
      tx.token,
      tx.status,
      tx.tx_hash,
      tx.memo || "",
    ])

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    return csvContent
  }

  /**
   * Generate Excel workbook
   */
  generateExcel(
    transactions: Transaction[],
    summary: ReportSummary,
    options: ReportOptions
  ): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ["Payment Report Summary"],
      [],
      ["Period", `${summary.dateRange.start} to ${summary.dateRange.end}`],
      ["Total Transactions", summary.totalTransactions],
      ["Total Amount", `${summary.totalAmount.toFixed(2)} ${summary.token}`],
      ["Unique Recipients", summary.uniqueRecipients],
      [],
      ["Generated", new Date().toISOString()],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

    // Transactions sheet
    const txHeaders = ["Date", "Recipient", "Amount", "Token", "Status", "Tx Hash", "Memo"]
    const txRows = transactions.map((tx) => [
      new Date(tx.created_at).toISOString().split("T")[0],
      tx.to_address,
      parseFloat(tx.amount || "0"),
      tx.token,
      tx.status,
      tx.tx_hash,
      tx.memo || "",
    ])
    const txSheet = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows])

    // Set column widths
    txSheet["!cols"] = [
      { wch: 12 }, // Date
      { wch: 44 }, // Recipient
      { wch: 15 }, // Amount
      { wch: 8 }, // Token
      { wch: 12 }, // Status
      { wch: 68 }, // Tx Hash
      { wch: 30 }, // Memo
    ]
    XLSX.utils.book_append_sheet(workbook, txSheet, "Transactions")

    // Monthly summary sheet (if monthly report)
    if (options.type === "monthly") {
      const monthlyData = this.groupByMonth(transactions)
      const monthlyHeaders = ["Month", "Transactions", "Total Amount", "Recipients"]
      const monthlyRows = monthlyData.map((m) => [
        m.month,
        m.transactionCount,
        m.totalAmount.toFixed(2),
        m.recipients.length,
      ])
      const monthlySheet = XLSX.utils.aoa_to_sheet([monthlyHeaders, ...monthlyRows])
      XLSX.utils.book_append_sheet(workbook, monthlySheet, "Monthly Summary")
    }

    // Recipient summary sheet (if recipient report)
    if (options.type === "recipient") {
      const recipientData = this.groupByRecipient(transactions)
      const recipientHeaders = ["Address", "Name", "Transactions", "Total Amount", "Last Transaction"]
      const recipientRows = recipientData.map((r) => [
        r.address,
        r.name || "",
        r.transactionCount,
        r.totalAmount.toFixed(2),
        new Date(r.lastTransaction).toISOString().split("T")[0],
      ])
      const recipientSheet = XLSX.utils.aoa_to_sheet([recipientHeaders, ...recipientRows])
      XLSX.utils.book_append_sheet(workbook, recipientSheet, "Recipients")
    }

    return workbook
  }

  /**
   * Generate Excel buffer
   */
  generateExcelBuffer(workbook: XLSX.WorkBook): Buffer {
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  }

  /**
   * Prepare PDF data
   */
  preparePDFData(
    transactions: Transaction[],
    summary: ReportSummary,
    options: ReportOptions
  ): PDFReportData {
    return {
      summary,
      transactions: transactions.map((tx) => ({
        date: new Date(tx.created_at).toISOString().split("T")[0],
        recipient: tx.to_address,
        recipientName: tx.recipient_name,
        amount: parseFloat(tx.amount || "0").toFixed(2),
        token: tx.token,
        txHash: tx.tx_hash,
        status: tx.status,
      })),
      monthlyData: options.type === "monthly" ? this.groupByMonth(transactions) : undefined,
      recipientData: options.type === "recipient" ? this.groupByRecipient(transactions) : undefined,
      pdfOptions: options.pdfOptions,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Save report record to database
   */
  async saveReportRecord(
    walletAddress: string,
    options: ReportOptions,
    summary: ReportSummary,
    fileUrl?: string
  ): Promise<string> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("report_exports")
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        report_type: options.type,
        format: options.format,
        date_range_start: options.startDate,
        date_range_end: options.endDate,
        transaction_count: summary.totalTransactions,
        total_amount: summary.totalAmount,
        file_url: fileUrl,
        status: "completed",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select("id")
      .single()

    if (error) {
      console.error("[ReportService] Failed to save report record:", error)
      throw new Error(`Failed to save report: ${error.message}`)
    }

    return data.id
  }
}

// ============================================
// PDF Data Type
// ============================================

export interface PDFReportData {
  summary: ReportSummary
  transactions: {
    date: string
    recipient: string
    recipientName?: string
    amount: string
    token: string
    txHash: string
    status: string
  }[]
  monthlyData?: MonthlyData[]
  recipientData?: RecipientData[]
  pdfOptions?: PDFOptions
  generatedAt: string
}

// Export singleton instance
export const reportService = new ReportService()
