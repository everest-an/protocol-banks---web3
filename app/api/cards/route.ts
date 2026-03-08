/**
 * /api/cards
 *
 * GET  - List all virtual Visa cards for the authenticated user
 * POST - Create a new virtual Visa card (funded from Yativo platform balance)
 *
 * Flow: User deposits USDC → Yativo platform USD balance → Issue virtual card
 *
 * @module app/api/cards
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { userVirtualCardService } from '@/lib/services/user-virtual-card.service'
import { z } from 'zod'

const createCardSchema = z.object({
  initialAmount: z
    .number({ required_error: 'initialAmount is required' })
    .positive('Amount must be positive')
    .max(10000, 'Maximum card balance is $10,000 USD'),
  label: z.string().max(100).optional(),
})

// ─── GET /api/cards ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return withAuth(async (_req, address) => {
    const cards = await userVirtualCardService.listCards(address)
    return NextResponse.json({ cards })
  }, { component: 'cards-list' })(request)
}

// ─── POST /api/cards ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  return withAuth(async (req, address) => {
    const body = await req.json().catch(() => ({}))
    const parsed = createCardSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      )
    }

    try {
      const card = await userVirtualCardService.createCard({
        ownerAddress: address,
        initialAmount: parsed.data.initialAmount,
        label: parsed.data.label,
      })
      return NextResponse.json(card, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create card'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-create' })(request)
}
