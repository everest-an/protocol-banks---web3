/**
 * /api/agents/[id]/virtual-cards
 *
 * GET  - List all virtual Visa cards for an AI agent
 * POST - Create a new virtual Visa card (funded from Yativo platform balance)
 *
 * @module app/api/agents/[id]/virtual-cards
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { virtualCardService } from '@/lib/services/virtual-card.service'
import { z } from 'zod'

// ─── Validation ──────────────────────────────────────────────────────────────

const createCardSchema = z.object({
  initialAmount: z
    .number({ required_error: 'initialAmount is required' })
    .positive('Amount must be positive')
    .max(10000, 'Maximum card balance is $10,000'),
  label: z.string().max(100).optional(),
})

// ─── GET /api/agents/[id]/virtual-cards ──────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (_req, address) => {
    const { id: agentId } = await params

    const cards = await virtualCardService.listCards(agentId, address)
    return NextResponse.json({ cards })
  }, { component: 'agents-virtual-cards-list' })(request)
}

// ─── POST /api/agents/[id]/virtual-cards ─────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, address) => {
    const { id: agentId } = await params

    const body = await req.json().catch(() => ({}))
    const parsed = createCardSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      )
    }

    const card = await virtualCardService.createCard({
      agentId,
      ownerAddress: address,
      initialAmount: parsed.data.initialAmount,
      label: parsed.data.label,
    })

    return NextResponse.json(card, { status: 201 })
  }, { component: 'agents-virtual-cards-create' })(request)
}
