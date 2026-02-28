/**
 * POST /api/agents/[id]/rotate-key
 *
 * Generates a new API key for the agent and invalidates the old one.
 * The new key is returned once — it cannot be retrieved again.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateAgentApiKey } from "@/lib/services/agent-service"
import { withAuth } from "@/lib/middleware/api-auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (_request, ownerAddress) => {
    const { id } = await params

    // Verify ownership
    const agent = await prisma.agent.findFirst({
      where: { id, owner_address: ownerAddress.toLowerCase() },
      select: { id: true, name: true, status: true },
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    if (agent.status === "deactivated") {
      return NextResponse.json(
        { error: "Cannot rotate key for a deactivated agent" },
        { status: 400 }
      )
    }

    // Generate new key
    const { key, prefix, hash } = generateAgentApiKey()

    await prisma.agent.update({
      where: { id },
      data: {
        api_key_hash: hash,
        api_key_prefix: prefix,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      api_key: key,
      api_key_prefix: prefix,
      message: "API key rotated. Save the new key — it will not be shown again.",
    })
  })(req)
}
