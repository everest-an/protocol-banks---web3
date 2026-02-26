/**
 * /api/agents/[id]/card
 *
 * GET    - Get agent's ERC-8004 Agent Card
 * PUT    - Create or update Agent Card
 * DELETE - Remove Agent Card
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAddress } from '@/lib/api-auth'
import { agentCardService } from '@/lib/services/agent-card-service'
import { createAgentCardSchema, formatValidationError } from '@/lib/validations/agent-card'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const card = await agentCardService.getCard(id)
  if (!card) {
    return NextResponse.json({ error: 'Agent Card not found' }, { status: 404 })
  }
  return NextResponse.json(agentCardService.toPublicCard(card))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = createAgentCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    // Check if card exists — update or create
    const existing = await agentCardService.getCard(id)
    if (existing) {
      const updated = await agentCardService.updateCard(id, address, parsed.data)
      return NextResponse.json(agentCardService.toPublicCard(updated))
    }

    const card = await agentCardService.createCard(id, address, parsed.data)
    return NextResponse.json(agentCardService.toPublicCard(card), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create card'
    const status = message.includes('Not authorized') ? 403 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  try {
    await agentCardService.deleteCard(id, address)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete card'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
