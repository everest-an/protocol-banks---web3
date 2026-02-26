/**
 * /api/a2a/tasks
 *
 * GET  - List A2A tasks for authenticated agent
 * POST - Create a new A2A task
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
  const status = searchParams.get('status') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const result = await a2aService.listTasks(did, { status, limit, offset })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await request.json()
  const did = generateDid(address)
  const task = await a2aService.createTask(did, body.description)
  return NextResponse.json(task, { status: 201 })
}
