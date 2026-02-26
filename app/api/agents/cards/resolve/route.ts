/**
 * POST /api/agents/cards/resolve
 *
 * Resolve an external Agent Card by DID.
 * First checks local database, then attempts to fetch from
 * the agent's well-known URL.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { agentCardService } from '@/lib/services/agent-card-service'
import { resolveAgentCardSchema, formatValidationError } from '@/lib/validations/agent-card'
import { extractAddressFromDid } from '@/lib/a2a/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = resolveAgentCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    )
  }

  const { did } = parsed.data

  // 1. Check local database
  const localCard = await agentCardService.getCardByDid(did)
  if (localCard) {
    return NextResponse.json({
      source: 'local',
      card: agentCardService.toPublicCard(localCard),
    })
  }

  // 2. DID resolved but no card — return info about the address
  const address = extractAddressFromDid(did)
  return NextResponse.json({
    source: 'none',
    did,
    address,
    message: 'No Agent Card found for this DID. The agent may not have registered yet.',
  })
}
