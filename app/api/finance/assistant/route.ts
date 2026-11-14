import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/security/security"
import { askFinanceAssistant } from "@/lib/finance/assistant"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const POST = withAuth(async (request: NextRequest, address: string) => {
  const body = await request.json().catch(() => ({}))
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : ""
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 })

  const limit = checkRateLimit({
    maxRequests: 10,
    windowMs: 60_000,
    identifier: `finance-assistant:${address.toLowerCase()}`,
  })
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.error || "Too many questions. Try again shortly." }, { status: 429 })
  }

  try {
    const result = await askFinanceAssistant(address, question)
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[finance/assistant] failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance assistant unavailable." },
      { status: 503 },
    )
  }
})
