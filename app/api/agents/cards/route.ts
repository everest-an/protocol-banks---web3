/**
 * GET /api/agents/cards
 *
 * Discover publicly available Agent Cards.
 * Supports filtering by skill, token, chain, and protocol.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { agentCardService } from '@/lib/services/agent-card-service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const result = await agentCardService.listPublicCards({
    skill: searchParams.get('skill') || undefined,
    token: searchParams.get('token') || undefined,
    chain: searchParams.get('chain') || undefined,
    protocol: searchParams.get('protocol') as 'a2a' | 'mcp' | 'x402' | undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    offset: parseInt(searchParams.get('offset') || '0'),
  })

  return NextResponse.json({
    cards: result.cards.map((c) => agentCardService.toPublicCard(c)),
    total: result.total,
  })
}
