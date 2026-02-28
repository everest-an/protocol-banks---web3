/**
 * Audit Log API
 *
 * Server-side endpoint for storing and retrieving audit logs.
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAndChecksumAddress, sanitizeTextInput } from "@/lib/security/security"
import { withAuth } from "@/lib/middleware/api-auth"

export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { action, actor, target_type, target_id, details } = body

    // Validate actor address
    const actorValidation = validateAndChecksumAddress(actor)
    if (!actorValidation.valid && actor !== "SYSTEM") {
      return NextResponse.json({ error: "Invalid actor address" }, { status: 400 })
    }

    // Sanitize details
    const sanitizedDetails = { ...details }
    for (const key in sanitizedDetails) {
      if (typeof sanitizedDetails[key] === "string") {
        const result = sanitizeTextInput(sanitizedDetails[key])
        sanitizedDetails[key] = result.sanitized
      }
    }

    // Get client info
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Insert audit log
    const data = await prisma.auditLog.create({
      data: {
        action,
        actor: actorValidation.checksummed || actor,
        target_type,
        target_id,
        details: sanitizedDetails,
        ip_address: ip,
        user_agent: userAgent,
      },
    })

    return NextResponse.json({ success: true, log: data })
  } catch (error: any) {
    console.error("[API] Audit log error:", error)
    return NextResponse.json({ error: error.message || "Failed to create audit log" }, { status: 500 })
  }
}, { component: 'audit-log' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actor = searchParams.get("actor")
    const action = searchParams.get("action")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!actor) {
      return NextResponse.json({ error: "Actor (wallet address) is required" }, { status: 400 })
    }

    // Validate actor address
    const actorValidation = validateAndChecksumAddress(actor)
    if (!actorValidation.valid) {
      return NextResponse.json({ error: "Invalid actor address" }, { status: 400 })
    }

    // Build query
    const data = await prisma.auditLog.findMany({
      where: {
        AND: [
          {
            OR: [
              { actor: { equals: actorValidation.checksummed!, mode: "insensitive" } },
              { actor: "SYSTEM" },
            ],
          },
          ...(action ? [{ action }] : []),
        ],
      },
      orderBy: { created_at: "desc" },
      take: limit,
    })

    return NextResponse.json({ logs: data })
  } catch (error: any) {
    console.error("[API] Audit log fetch error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch audit logs" }, { status: 500 })
  }
}
