/**
 * Report Generation API
 * POST /api/reports/generate
 *
 * Generates CSV, Excel, or PDF reports for payment transactions
 */

import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import {
  reportService,
  type ReportOptions,
  type ReportFormat,
  type ReportType,
} from "@/lib/services/report-service"
import { PaymentReportPDF } from "@/components/reports/payment-report-pdf"
import { getSupabase } from "@/lib/supabase"
import {
  withErrorHandling,
  validateRequired,
  validateAddress,
  validateEnum,
} from "@/lib/errors/api-handler"
import { ApiError, ErrorCodes } from "@/lib/errors"

// ============================================
// Types
// ============================================

interface GenerateReportRequest {
  type: ReportType
  format: ReportFormat
  startDate: string
  endDate: string
  walletAddress: string
  pdfOptions?: {
    companyName?: string
    companyAddress?: string
    includeLogo?: boolean
    includeQRCode?: boolean
  }
}

// ============================================
// Validation
// ============================================

const VALID_TYPES = ["transactions", "monthly", "recipient"] as const
const VALID_FORMATS = ["csv", "excel", "pdf"] as const

function validateDateFormat(dateStr: string, fieldName: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `${fieldName} must be in YYYY-MM-DD format`,
      field: fieldName,
    })
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: `${fieldName} is not a valid date`,
      field: fieldName,
    })
  }
}

// ============================================
// API Handler
// ============================================

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate user
  const supabase = getSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new ApiError({ code: ErrorCodes.AUTH_REQUIRED })
  }

  // Parse and validate request
  const body: GenerateReportRequest = await request.json()

  validateRequired(body, ["type", "format", "startDate", "endDate", "walletAddress"])
  validateEnum(body.type, VALID_TYPES, "type")
  validateEnum(body.format, VALID_FORMATS, "format")
  validateAddress(body.walletAddress, "walletAddress")
  validateDateFormat(body.startDate, "startDate")
  validateDateFormat(body.endDate, "endDate")

  // Validate date range
  const startDate = new Date(body.startDate)
  const endDate = new Date(body.endDate)
  if (startDate > endDate) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: "startDate cannot be after endDate",
      field: "startDate",
    })
  }

  // Fetch transactions
  const transactions = await reportService.fetchTransactions(
    body.walletAddress,
    body.startDate,
    `${body.endDate}T23:59:59.999Z`
  )

  // Calculate summary
  const summary = reportService.calculateSummary(transactions, body.startDate, body.endDate)

  const options: ReportOptions = {
    type: body.type,
    format: body.format,
    startDate: body.startDate,
    endDate: body.endDate,
    walletAddress: body.walletAddress,
    pdfOptions: body.pdfOptions,
  }

  // Generate report based on format
  let content: Buffer | string
  let contentType: string
  let filename: string
  const timestamp = new Date().toISOString().split("T")[0]

  switch (body.format) {
    case "csv": {
      content = reportService.generateCSV(transactions)
      contentType = "text/csv"
      filename = `payment-report-${timestamp}.csv`
      break
    }

    case "excel": {
      const workbook = reportService.generateExcel(transactions, summary, options)
      content = reportService.generateExcelBuffer(workbook)
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      filename = `payment-report-${timestamp}.xlsx`
      break
    }

    case "pdf": {
      const pdfData = reportService.preparePDFData(transactions, summary, options)
      // @ts-expect-error - React element type mismatch with react-pdf
      const pdfElement = createElement(PaymentReportPDF, { data: pdfData })
      content = await renderToBuffer(pdfElement)
      contentType = "application/pdf"
      filename = `payment-report-${timestamp}.pdf`
      break
    }
  }

  // Save report record
  try {
    await reportService.saveReportRecord(body.walletAddress, options, summary)
  } catch (err) {
    console.warn("[Reports] Failed to save report record:", err)
    // Continue even if save fails
  }

  // Return file
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": content.length.toString(),
    },
  })
})

// ============================================
// GET - Report Preview/Summary
// ============================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Authenticate user
  const supabase = getSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new ApiError({ code: ErrorCodes.AUTH_REQUIRED })
  }

  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get("walletAddress")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  if (!walletAddress || !startDate || !endDate) {
    throw new ApiError({
      code: ErrorCodes.VALIDATION_MISSING_FIELD,
      message: "walletAddress, startDate, and endDate are required",
    })
  }

  validateAddress(walletAddress, "walletAddress")
  validateDateFormat(startDate, "startDate")
  validateDateFormat(endDate, "endDate")

  // Fetch transactions for preview
  const transactions = await reportService.fetchTransactions(
    walletAddress,
    startDate,
    `${endDate}T23:59:59.999Z`
  )

  const summary = reportService.calculateSummary(transactions, startDate, endDate)

  return NextResponse.json({
    success: true,
    data: {
      preview: {
        transactionCount: summary.totalTransactions,
        totalAmount: summary.totalAmount,
        token: summary.token,
        uniqueRecipients: summary.uniqueRecipients,
        dateRange: summary.dateRange,
      },
      availableFormats: ["csv", "excel", "pdf"],
      availableTypes: ["transactions", "monthly", "recipient"],
    },
  })
})
