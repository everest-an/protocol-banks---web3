/**
 * GET /api/a2a/messages
 *
 * Retrieve A2A message history for the authenticated agent.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { a2aService } from '@/lib/services/a2a-service'
import { generateDid } from '@/lib/a2a/types'

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const did = generateDid(address)
  const { searchParams } = new URL(request.url)

  const result = await a2aService.getMessages(did, {
    message_type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    offset: parseInt(searchParams.get('offset') || '0'),
  })

  return NextResponse.json(result)
}, { component: 'a2a-messages' })
