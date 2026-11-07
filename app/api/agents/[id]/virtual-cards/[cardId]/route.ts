import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/api-auth'
import { prisma } from '@/lib/prisma'
import { virtualCardService } from '@/lib/services/virtual-card.service'
import { isYativoConfigError } from '@/lib/services/yativo-client.service'

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fund'), amount: z.number().positive().max(10000) }),
  z.object({ action: z.literal('withdraw'), amount: z.number().positive() }),
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('terminate') }),
  z.object({ action: z.literal('freeze') }),
  z.object({ action: z.literal('unfreeze') }),
])

function errorResponse(error: unknown) {
  if (isYativoConfigError(error)) {
    return NextResponse.json(
      { error: 'Card operations are not available: the provider credentials are missing or rejected.' },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : 'Card operation failed'
  const status = message.includes('not found')
    ? 404
    : message.includes('Not authorized')
      ? 403
      : 400
  return NextResponse.json({ error: message }, { status })
}

async function ownedCard(cardId: string, agentId: string, ownerAddress: string) {
  const card = await prisma.agentVirtualCard.findFirst({
    where: { id: cardId, agent_id: agentId },
    include: { agent: { select: { owner_address: true } } },
  })
  if (!card) throw new Error('Card not found')
  if (card.agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) throw new Error('Not authorized')
  return card
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  return withAuth(async (_req, address) => {
    try {
      const { id, cardId } = await params
      await ownedCard(cardId, id, address)
      return NextResponse.json(await virtualCardService.getCardDetails(cardId, address))
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: 'agents-virtual-cards-detail' })(request)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  return withAuth(async (req, address) => {
    try {
      const { id, cardId } = await params
      await ownedCard(cardId, id, address)

      const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors.map((e) => e.message).join(', ') },
          { status: 400 },
        )
      }

      const data = parsed.data
      switch (data.action) {
        case 'fund':
          return NextResponse.json(await virtualCardService.fundCard({ cardId, ownerAddress: address, amount: data.amount }))
        case 'withdraw':
          return NextResponse.json(await virtualCardService.withdrawFromCard(cardId, address, data.amount))
        case 'activate':
          return NextResponse.json(await virtualCardService.activateCard(cardId, address))
        case 'terminate':
          return NextResponse.json(await virtualCardService.terminateCard(cardId, address))
        case 'freeze':
          return NextResponse.json(await virtualCardService.freezeCard(cardId, address))
        case 'unfreeze':
          return NextResponse.json(await virtualCardService.unfreezeCard(cardId, address))
      }
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: 'agents-virtual-cards-detail' })(request)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  return withAuth(async (_req, address) => {
    try {
      const { id, cardId } = await params
      await ownedCard(cardId, id, address)
      return NextResponse.json(await virtualCardService.terminateCard(cardId, address))
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: 'agents-virtual-cards-detail' })(request)
}
