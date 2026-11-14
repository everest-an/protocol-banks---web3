import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { parseCsvBuffer } from "@/lib/finance/csv"
import { importCsvTransactions } from "@/lib/finance/ledger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BYTES = 5 * 1024 * 1024

export const POST = withAuth(async (request: NextRequest, address: string) => {
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "CSV is larger than 5 MB" }, { status: 413 })
    }

    const accountName = String(form.get("accountName") || "Imported account").trim()
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseCsvBuffer(buffer)
    if (!parsed.rows.length) {
      return NextResponse.json(
        { error: "No valid rows found. Check the date and amount columns.", headers: parsed.headers },
        { status: 400 },
      )
    }

    const result = await importCsvTransactions(address, accountName, parsed.rows)
    return NextResponse.json({
      ok: true,
      accountId: result.accountId,
      imported: result.imported,
      inserted: result.inserted,
      skipped: parsed.skipped,
      fxConverted: result.fxConverted,
      fxMissing: result.fxMissing,
      headers: parsed.headers,
    })
  } catch (error) {
    console.error("[finance/import] failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CSV import failed" },
      { status: 400 },
    )
  }
})
