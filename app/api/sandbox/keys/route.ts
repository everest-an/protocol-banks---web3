import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimit } from "@/lib/security/security"
import { createSandboxSession, requestIp } from "@/lib/sandbox/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers)
  const limit = checkRateLimit({
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    identifier: `sandbox-key:${ip}`,
  })

  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.error || "Too many sandbox requests. Try again later." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "3600" } },
    )
  }

  const body = await request.json().catch(() => null)
  const source = body && typeof body === "object" && typeof body.source === "string" ? body.source : "direct"

  try {
    const result = await createSandboxSession(ip, source)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      )
    }
    return NextResponse.json(result.session, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[sandbox/keys] failed:", error)
    return NextResponse.json(
      { error: "Sandbox is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
