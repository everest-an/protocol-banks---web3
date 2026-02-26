/**
 * POST /api/a2a
 *
 * Main A2A (Agent-to-Agent) message endpoint.
 * Receives JSON-RPC 2.0 messages, verifies signatures,
 * and routes to appropriate handlers.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { a2aService } from '@/lib/services/a2a-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await a2aService.processMessage(body)
    const status = response.error ? (
      response.error.code === -32001 ? 401 :
      response.error.code === -32002 ? 409 :
      response.error.code === -32003 ? 400 :
      response.error.code === -32006 ? 429 :
      response.error.code < -32600 ? 400 : 500
    ) : 200

    return NextResponse.json(response, { status })
  } catch (error) {
    console.error('[A2A] Error:', error)
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' } },
      { status: 500 }
    )
  }
}
