import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"

/**
 * GET /api/ledger/export
 *
 * Export ledger entries for accounting/audit purposes.
 * Supports CSV, JSON, and PDF formats.
 *
 * Query params:
 * - start_date: ISO date (required)
 * - end_date: ISO date (required)
 * - token: filter by token
 * - chain: filter by chain
 * - format: "csv" (default) | "json" | "pdf"
 */
export async function GET(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const token = searchParams.get("token")
    const chain = searchParams.get("chain")
    const format = searchParams.get("format") || "csv"

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: start_date, end_date" },
        { status: 400 }
      )
    }

    // Build query
    const where: Record<string, unknown> = {
      account_address: userAddress,
      created_at: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    }
    if (token) where.token = token
    if (chain) where.chain = chain

    const entries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: { created_at: "asc" },
      take: 10000, // Max 10k entries per export
    })

    // ─── JSON Format ──────────────────────────────────────────
    if (format === "json") {
      return NextResponse.json({
        entries: entries.map((e) => ({
          ...e,
          amount: e.amount.toString(),
          balance_before: e.balance_before.toString(),
          balance_after: e.balance_after.toString(),
          created_at: e.created_at.toISOString(),
        })),
        count: entries.length,
        period: { start: startDate, end: endDate },
      })
    }

    // ─── PDF Format ───────────────────────────────────────────
    if (format === "pdf") {
      const pdfBuffer = await generatePdfReport(entries, {
        userAddress,
        startDate,
        endDate,
        token,
        chain,
      })

      const filename = `ledger_${userAddress.slice(0, 10)}_${startDate}_${endDate}.pdf`

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // ─── CSV Format (default) ─────────────────────────────────
    const csvHeaders = [
      "Date",
      "Entry Type",
      "Category",
      "Amount",
      "Token",
      "Chain",
      "Balance Before",
      "Balance After",
      "Counterparty",
      "Reference Type",
      "Reference ID",
      "TX Hash",
      "Description",
      "Idempotency Key",
    ]

    const csvRows = entries.map((e) => [
      e.created_at.toISOString(),
      e.entry_type,
      e.category,
      e.amount.toString(),
      e.token,
      e.chain,
      e.balance_before.toString(),
      e.balance_after.toString(),
      e.counterparty || "",
      e.reference_type || "",
      e.reference_id || "",
      e.tx_hash || "",
      (e.description || "").replace(/"/g, '""'),
      e.idempotency_key,
    ])

    const csv =
      csvHeaders.join(",") +
      "\n" +
      csvRows
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n")

    const filename = `ledger_${userAddress.slice(0, 10)}_${startDate}_${endDate}.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error("[API] GET /api/ledger/export error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

interface PdfMeta {
  userAddress: string
  startDate: string
  endDate: string
  token: string | null
  chain: string | null
}

async function generatePdfReport(
  entries: any[],
  meta: PdfMeta
): Promise<Buffer> {
  // Dynamic import to avoid bundling issues in edge runtime
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // ─── Header ─────────────────────────────────────────────
  doc.setFontSize(18)
  doc.text("Protocol Banks - Ledger Audit Report", 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Account: ${meta.userAddress}`, 14, 28)
  doc.text(`Period: ${meta.startDate} to ${meta.endDate}`, 14, 33)

  const filters: string[] = []
  if (meta.token) filters.push(`Token: ${meta.token}`)
  if (meta.chain) filters.push(`Chain: ${meta.chain}`)
  if (filters.length > 0) {
    doc.text(`Filters: ${filters.join(", ")}`, 14, 38)
  }
  doc.text(`Generated: ${new Date().toISOString()}`, 14, filters.length > 0 ? 43 : 38)
  doc.text(`Total entries: ${entries.length}`, 14, filters.length > 0 ? 48 : 43)

  // ─── Summary Statistics ─────────────────────────────────
  const debits = entries.filter((e) => e.entry_type === "debit")
  const credits = entries.filter((e) => e.entry_type === "credit")

  const tokenSummary: Record<string, { debits: number; credits: number }> = {}
  for (const e of entries) {
    const key = `${e.token}/${e.chain}`
    if (!tokenSummary[key]) tokenSummary[key] = { debits: 0, credits: 0 }
    const amount = parseFloat(e.amount.toString())
    if (e.entry_type === "debit") {
      tokenSummary[key].debits += amount
    } else {
      tokenSummary[key].credits += amount
    }
  }

  const summaryY = filters.length > 0 ? 55 : 50
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text("Summary", 14, summaryY)

  const summaryData = Object.entries(tokenSummary).map(([key, v]) => [
    key,
    v.credits.toFixed(6),
    v.debits.toFixed(6),
    (v.credits - v.debits).toFixed(6),
  ])

  autoTable(doc, {
    startY: summaryY + 3,
    head: [["Token/Chain", "Total Credits", "Total Debits", "Net"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  })

  // ─── Detailed Entries Table ─────────────────────────────
  const tableStartY = (doc as any).lastAutoTable?.finalY + 10 || summaryY + 30

  doc.setFontSize(12)
  doc.text("Detailed Entries", 14, tableStartY)

  const tableData = entries.map((e) => [
    e.created_at.toISOString().slice(0, 19).replace("T", " "),
    e.entry_type,
    e.category,
    e.amount.toString(),
    e.token,
    e.chain,
    e.balance_before.toString(),
    e.balance_after.toString(),
    e.counterparty ? `${e.counterparty.slice(0, 10)}...` : "",
    e.reference_type || "",
    e.tx_hash ? `${e.tx_hash.slice(0, 12)}...` : "",
  ])

  autoTable(doc, {
    startY: tableStartY + 3,
    head: [
      [
        "Date",
        "Type",
        "Category",
        "Amount",
        "Token",
        "Chain",
        "Before",
        "After",
        "Counterparty",
        "Ref Type",
        "TX Hash",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
    styles: { fontSize: 6, cellPadding: 1.5 },
    margin: { left: 14 },
  })

  // ─── Footer ─────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Protocol Banks Audit Report | Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    )
  }

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}
