import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/middleware/api-auth"
import { agentService } from "@/lib/services/agent-service"
import {
  createRainContract,
  getRainContracts,
} from "@/lib/services/rain-agent-card.service"

const schema = z.object({
  chainId: z.number().int().positive(),
})

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Rain contract failed"
  const status = /not configured/i.test(message)
    ? 503
    : /KYB|KYC|required/i.test(message)
      ? 409
      : 502
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (_req, address) => {
    try {
      const { id } = await params
      const agent = await agentService.get(id, address)
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })
      return NextResponse.json({ contracts: await getRainContracts(address) })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-rain-contract" })(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, address) => {
    try {
      const { id } = await params
      const agent = await agentService.get(id, address)
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      const parsed = schema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return NextResponse.json({ error: "chainId is required" }, { status: 400 })
      }

      const contracts = await createRainContract(address, parsed.data.chainId)
      return NextResponse.json({ success: true, contracts }, { status: 201 })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-rain-contract" })(request)
}
