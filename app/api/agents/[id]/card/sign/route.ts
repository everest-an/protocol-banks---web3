/**
 * POST /api/agents/[id]/card/sign
 *
 * Submit an EIP-191 signature for an Agent Card.
 * The owner signs the card JSON to cryptographically prove identity.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAddress } from '@/lib/api-auth'
import { agentCardService } from '@/lib/services/agent-card-service'
import { signAgentCardSchema, formatValidationError } from '@/lib/validations/agent-card'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
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
}
