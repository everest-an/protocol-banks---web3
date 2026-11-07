import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { createQuote, listQuotes } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const role = request.nextUrl.searchParams.get("role") || "all"
    return NextResponse.json({ ok: true, quotes: await listQuotes(owner, role) })
  } catch (error) {
    return commerceFailure(error, "commerce/quotes")
  }
}, { component: "commerce-quotes" })

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    return NextResponse.json({ ok: true, quote: await createQuote(owner, body) }, { status: 201 })
  } catch (error) {
    return commerceFailure(error, "commerce/quotes")
  }
}, { component: "commerce-quotes" })
