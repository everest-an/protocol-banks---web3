/**
 * GET /.well-known/agent.json
 *
 * Standard discovery endpoint for the platform's own Agent Card.
 * Other AI agents can fetch this URL to discover Protocol Banks'
 * capabilities, supported protocols, and communication endpoints.
 *
 * @see ERC-8004
 */

import { NextResponse } from 'next/server'
import { getPlatformAgentCard } from '@/lib/a2a/types'

export async function GET() {
  const baseUrl =
    process.env.AGENT_CARD_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.protocolbanks.com'

  const card = getPlatformAgentCard(baseUrl)

  return NextResponse.json(card, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  })
}
