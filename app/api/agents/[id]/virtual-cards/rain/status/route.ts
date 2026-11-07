import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { agentService } from "@/lib/services/agent-service"
import { rainCardService } from "@/lib/services/rain-card.service"
import { getRainAccount } from "@/lib/services/rain-agent-card.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (_req, address) => {
    const { id } = await params
    const agent = await agentService.get(id, address)
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

    return NextResponse.json({
      configured: rainCardService.isConfigured(),
      account: await getRainAccount(address),
    })
  }, { component: "agents-rain-status" })(request)
}
