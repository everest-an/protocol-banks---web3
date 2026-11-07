import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { virtualCardService } from '@/lib/services/virtual-card.service'
import { issueRainCard } from '@/lib/services/rain-agent-card.service'
import { isYativoConfigError } from '@/lib/services/yativo-client.service'
import { z } from 'zod'

const createCardSchema = z.object({
  initialAmount: z
    .number()
    .positive('Amount must be positive')
    .max(10000, 'Maximum card balance is $10,000')
    .optional(),
  label: z.string().max(100).optional(),
  provider: z.enum(['yativo', 'rain']).optional(),
})

function errorResponse(error: unknown) {
  if (isYativoConfigError(error)) {
    return NextResponse.json(
      { error: 'Card issuing is not available: the provider credentials are missing or rejected.' },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : 'Card operation failed'
  const status = /not configured/i.test(message)
    ? 503
    : /KYC|KYB|required/i.test(message)
      ? 409
      : message.includes('not found')
        ? 404
        : message.includes('Not authorized')
          ? 403
          : 400
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (_req, address) => {
    try {
      const { id: agentId } = await params
      const cards = await virtualCardService.listCards(agentId, address)
      return NextResponse.json({ cards })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: 'agents-virtual-cards-list' })(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (req, address) => {
    try {
      const { id: agentId } = await params
      const parsed = createCardSchema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors.map(e => e.message).join(', ') },
          { status: 400 }
        )
      }

      const provider =
        parsed.data.provider ?? (process.env.CARD_PROVIDER === 'rain' ? 'rain' : 'yativo')

      if (provider === 'rain') {
        const card = await issueRainCard(agentId, address, parsed.data.label)
        return NextResponse.json(card, { status: 201 })
      }

      if (parsed.data.initialAmount === undefined) {
        return NextResponse.json(
          { error: 'initialAmount is required for a Yativo card' },
          { status: 400 },
        )
      }

      const card = await virtualCardService.createCard({
        agentId,
        ownerAddress: address,
        initialAmount: parsed.data.initialAmount,
        label: parsed.data.label,
      })

      return NextResponse.json(card, { status: 201 })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: 'agents-virtual-cards-create' })(request)
}
