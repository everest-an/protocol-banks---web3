import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isEventName, recordEvent } from "@/lib/analytics/events"
import { requireAuth } from "@/lib/middleware/api-auth"

/**
 * POST /api/events — anonymous product analytics.
 * The wallet is attached only when the caller is signed in for it; a wallet in
 * the body is ignored so nobody can attribute events to someone else.
 */
export const dynamic = "force-dynamic"

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const hits = new Map<string, { n: number; at: number }>()

function allow(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.at > WINDOW_MS) {
    hits.set(ip, { n: 1, at: now })
    return true
  }
  entry.n++
  return entry.n <= MAX_PER_WINDOW
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allow(ip)) return NextResponse.json({ ok: false }, { status: 429 })

  let body: { name?: unknown; anonId?: unknown; props?: unknown; path?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name : ""
  if (!isEventName(name)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 })
  }

  let address: string | null = null
  try {
    const auth = await requireAuth(request, { component: "events" })
    address = auth.address ?? null
  } catch {
    address = null
  }

  const props =
    body.props && typeof body.props === "object" && !Array.isArray(body.props)
      ? (body.props as Record<string, unknown>)
      : undefined

  await recordEvent({
    name,
    wallet: address,
    anonId: typeof body.anonId === "string" ? body.anonId : null,
    path: typeof body.path === "string" ? body.path : null,
    props,
  })

  return NextResponse.json({ ok: true })
}
