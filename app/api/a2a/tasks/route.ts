/**
 * /api/a2a/tasks
 *
 * GET  - List A2A tasks for authenticated agent
 * POST - Create a new A2A task
 */

import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/api-auth'
import { a2aService } from '@/lib/services/a2a-service'
import { generateDid } from '@/lib/a2a/types'

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const did = generateDid(address)
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const result = await a2aService.listTasks(did, { status, limit, offset })
  return NextResponse.json(result)
}, { component: 'a2a-tasks' })

export const POST = withAuth(async (request: NextRequest, address: string) => {
  const body = await request.json()
  const did = generateDid(address)
  const task = await a2aService.createTask(did, body.description)
  return NextResponse.json(task, { status: 201 })
}, { component: 'a2a-tasks' })
