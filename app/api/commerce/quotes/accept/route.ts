import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { acceptQuote } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    if (typeof body.quoteId !== "string" || !body.quoteId.trim()) {
      return NextResponse.json({ error: "quoteId is required" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, order: await acceptQuote(owner, body.quoteId.trim()) }, { status: 201 })
  } catch (error) {
    return commerceFailure(error, "commerce/quotes/accept")
  }
}, { component: "commerce-quotes-accept" })
