/**
 * /api/a2a/tasks/[id]
 *
 * GET   - Get task details
 * PATCH - Update task status/artifacts
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAddress } from '@/lib/api-auth'
import { a2aService } from '@/lib/services/a2a-service'
import { generateDid } from '@/lib/a2a/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = await a2aService.getTask(id)
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }
  return NextResponse.json(task)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = await getAuthenticatedAddress(request)
  if (!address) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const task = await a2aService.getTask(id)
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Only the task creator can update it
  const did = generateDid(address)
  if (task.client_did !== did) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()
  const updated = await a2aService.updateTask(id, {
    status: body.status,
    artifacts: body.artifacts,
    metadata: body.metadata,
  })

  return NextResponse.json(updated)
}
