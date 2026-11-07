import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"
import { getRainCardSecrets } from "@/lib/services/rain-agent-card.service"

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Card details failed"
  const status = /not configured/i.test(message)
    ? 503
    : /only available for Rain/i.test(message)
      ? 501
      : message.includes("not found")
        ? 404
        : message.includes("Not authorized")
          ? 403
          : 400
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  return withAuth(async (req, address) => {
    try {
      const { id, cardId } = await params
      const card = await prisma.agentVirtualCard.findFirst({
        where: { id: cardId, agent_id: id },
        include: { agent: { select: { owner_address: true } } },
      })
      if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 })
      if (card.agent.owner_address.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
      }
      if (card.card_provider !== "RAIN") {
        return NextResponse.json(
          { error: "Card details are only available for Rain-issued cards" },
          { status: 501 },
        )
      }

      const sessionId =
        req.headers.get("x-rain-session-id") ||
        new URL(req.url).searchParams.get("sessionId") ||
        ""
      if (!sessionId) {
        return NextResponse.json(
          { error: "x-rain-session-id header or sessionId query is required" },
          { status: 400 },
        )
      }

      const secrets = await getRainCardSecrets(cardId, address, sessionId)
      return NextResponse.json({
        success: true,
        provider: "RAIN",
        cardId,
        ...secrets,
        note: "Encrypted payload. Decrypt in the browser with the session key; never log the plaintext.",
      })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-rain-card-secrets" })(request)
}
