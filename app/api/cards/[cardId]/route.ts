/**
 * /api/cards/[cardId]
 *
 * GET    - Get card details (sensitive: PAN, CVV, expiry)
 * PATCH  - Update card: fund, freeze/activate, withdraw
 * DELETE - Terminate card permanently
 *
 * @module app/api/cards/[cardId]
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { userVirtualCardService } from '@/lib/services/user-virtual-card.service'
import { z } from 'zod'

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fund'), amount: z.number().positive().max(10000) }),
  z.object({ action: z.literal('withdraw'), amount: z.number().positive() }),
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('terminate') }),
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

// ─── PATCH /api/cards/[cardId] — fund / withdraw / activate / terminate ─────

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
        case 'withdraw':
          return NextResponse.json(
            await userVirtualCardService.withdrawFromCard(cardId, address, data.amount)
          )
        case 'activate':
          return NextResponse.json(
            await userVirtualCardService.activateCard(cardId, address)
          )
        case 'terminate':
          return NextResponse.json(
            await userVirtualCardService.terminateCard(cardId, address)
          )
        case 'freeze':
          return NextResponse.json(
            await userVirtualCardService.freezeCard(cardId, address)
          )
        case 'unfreeze':
          return NextResponse.json(
            await userVirtualCardService.unfreezeCard(cardId, address)
          )
        case 'sync':
          return NextResponse.json(
            await userVirtualCardService.syncCard(cardId, address)
          )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-patch' })(request)
}

// ─── DELETE /api/cards/[cardId] — terminate card ────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withAuth(async (_req, address) => {
    const { cardId } = await params
    try {
      const result = await userVirtualCardService.terminateCard(cardId, address)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to terminate card'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: 'cards-terminate' })(request)
}
