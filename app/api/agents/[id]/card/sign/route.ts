/**
 * POST /api/agents/[id]/card/sign
 *
 * Submit an EIP-191 signature for an Agent Card.
 * The owner signs the card JSON to cryptographically prove identity.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { agentCardService } from '@/lib/services/agent-card-service'
import { signAgentCardSchema, formatValidationError } from '@/lib/validations/agent-card'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, address) => {
    const { id } = await params
    const body = await req.json()
    const parsed = signAgentCardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      )
    }

    try {
      const card = await agentCardService.signCard(id, address, parsed.data.signature)
      return NextResponse.json({
        success: true,
        card: agentCardService.toPublicCard(card),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'
      const status = message.includes('Invalid signature') ? 400 : message.includes('Not authorized') ? 403 : 500
      return NextResponse.json({ error: message }, { status })
    }
  }, { component: 'agents-id-card-sign' })(request)
}
