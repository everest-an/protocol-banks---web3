/**
 * /api/cards/[cardId]
 *
 * GET    - Get card details (sensitive: PAN, CVV, expiry)
 * PATCH  - Update card: fund, freeze, unfreeze
 * DELETE - Close card permanently
 *
 * @module app/api/cards/[cardId]
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { userVirtualCardService } from '@/lib/services/user-virtual-card.service'
import { z } from 'zod'

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fund'), amount: z.number().positive().max(10000) }),
  z.object({ action: z.literal('freeze') }),
  z.object({ action: z.literal('unfreeze') }),
  z.object({ action: z.literal('sync') }),
])

// ─── GET /api/cards/[cardId] — reveal sensitive details ──────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withAuth(async (_req, address) => {
    const { cardId } = await params
    try {
      const details = await userVirtualCardService.getCardDetails(cardId, address)
      return NextResponse.json(details)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Not found'
      const status = message.includes('authorized') ? 403 : 404
      return NextResponse.json({ error: message }, { status })
    }
  }, { component: 'cards-details' })(request)
}

// ─── PATCH /api/cards/[cardId] — fund / freeze / unfreeze ────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withAuth(async (req, address) => {
    const { cardId } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      )
    }

    try {
      const data = parsed.data
      switch (data.action) {
        case 'fund':
          return NextResponse.json(
            await userVirtualCardService.fundCard({ cardId, ownerAddress: address, amount: data.amount })
          )
        case 'freeze':
          return NextResponse.json(
            await userVirtualCardService.toggleFreeze(cardId, address, true)
          )
        case 'unfreeze':
          return NextResponse.json(
            await userVirtualCardService.toggleFreeze(cardId, address, false)
          )
        case 'sync':
          await userVirtualCardService.syncCard(cardId, address)
          return NextResponse.json({ success: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-patch' })(request)
}

// ─── DELETE /api/cards/[cardId] — close card ─────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withAuth(async (_req, address) => {
    const { cardId } = await params
    try {
      const result = await userVirtualCardService.closeCard(cardId, address)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close card'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-close' })(request)
}
