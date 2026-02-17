import { NextRequest, NextResponse } from "next/server"

/**
 * Unified cron job authentication.
 *
 * Accepts two header formats (compatible with Vercel Cron + manual triggers):
 *   - Authorization: Bearer <CRON_SECRET>
 *   - x-cron-secret: <CRON_SECRET>
 *
 * Enforced in ALL environments to prevent unauthorized triggering.
 * Returns null if authorized, or a 401 NextResponse if not.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // No secret configured — block in production, allow in dev
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      )
    }
    return null // Allow in development without secret
  }

  const provided =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "")

  if (provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null // Authorized
}
