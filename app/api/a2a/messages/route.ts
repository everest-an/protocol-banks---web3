/**
 * GET /api/a2a/messages
 *
 * Retrieve A2A message history for the authenticated agent.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAddress } from '@/lib/api-auth'
import { a2aService } from '@/lib/services/a2a-service'
import { generateDid } from '@/lib/a2a/types'

export async function GET(request: NextRequest) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const did = generateDid(address)
  const { searchParams } = new URL(request.url)

  const result = await a2aService.getMessages(did, {
    message_type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    offset: parseInt(searchParams.get('offset') || '0'),
  })

  return NextResponse.json(result)
}
