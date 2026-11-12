import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const RETENTION_MS = 48 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const start = Date.now()
  const cutoff = new Date(Date.now() - RETENTION_MS)

  try {
    const keys = await prisma.apiKey.deleteMany({
      where: { name: { startsWith: "sandbox:" }, created_at: { lt: cutoff } },
    })

    const quotes = await prisma.agentQuote.findMany({
      where: { created_at: { lt: cutoff }, terms: { path: ["sandbox"], equals: true } },
      select: { id: true },
      take: 2_000,
    })
    const quoteIds = quotes.map((quote) => quote.id)

    const orders = quoteIds.length
      ? await prisma.agentOrder.deleteMany({ where: { quote_id: { in: quoteIds } } })
      : { count: 0 }

    const deletedQuotes = quoteIds.length
      ? await prisma.agentQuote.deleteMany({ where: { id: { in: quoteIds } } })
      : { count: 0 }

    const services = await prisma.agentService.deleteMany({
      where: { name: { startsWith: "Sandbox:" }, created_at: { lt: cutoff } },
    })

    return NextResponse.json({
      success: true,
      results: {
        keys: keys.count,
        orders: orders.count,
        quotes: deletedQuotes.count,
        services: services.count,
      },
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Cron] Sandbox cleanup error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "cleanup failed", duration_ms: Date.now() - start },
      { status: 500 },
    )
  }
}
