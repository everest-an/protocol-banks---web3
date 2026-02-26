/**
 * A2A Service
 *
 * High-level service for A2A message processing and task management.
 *
 * @module lib/services/a2a-service
 */

import { prisma } from '@/lib/prisma'
import { routeA2AMessage } from '@/lib/a2a/message-router'
import type { A2AResponse } from '@/lib/a2a/message-types'

export const a2aService = {
  /**
   * Process an incoming A2A JSON-RPC message.
   * Delegates to the message router for validation, verification, and handling.
   */
  async processMessage(body: unknown): Promise<A2AResponse> {
    return routeA2AMessage(body)
  },

  /**
   * Create a new A2A task for tracking multi-step interactions.
   */
  async createTask(clientDid: string, description?: string): Promise<{
    id: string
    status: string
    client_did: string
  }> {
    const task = await prisma.a2ATask.create({
      data: {
        client_did: clientDid,
        description,
        status: 'submitted',
      },
    })
    return { id: task.id, status: task.status, client_did: task.client_did }
  },

  /**
   * Get a task by ID.
   */
  async getTask(taskId: string) {
    return prisma.a2ATask.findUnique({ where: { id: taskId } })
  },

  /**
   * Update task status and artifacts.
   */
  async updateTask(
    taskId: string,
    updates: {
      status?: string
      artifacts?: unknown
      metadata?: unknown
    }
  ) {
    return prisma.a2ATask.update({
      where: { id: taskId },
      data: {
        status: updates.status,
        artifacts: updates.artifacts ? JSON.parse(JSON.stringify(updates.artifacts)) : undefined,
        metadata: updates.metadata ? JSON.parse(JSON.stringify(updates.metadata)) : undefined,
      },
    })
  },

  /**
   * List tasks for a given client DID.
   */
  async listTasks(clientDid: string, filters?: {
    status?: string
    limit?: number
    offset?: number
  }) {
    const where: Record<string, unknown> = { client_did: clientDid }
    if (filters?.status) where.status = filters.status

    const [tasks, total] = await Promise.all([
      prisma.a2ATask.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: filters?.limit ?? 20,
        skip: filters?.offset ?? 0,
      }),
      prisma.a2ATask.count({ where }),
    ])

    return { tasks, total }
  },

  /**
   * Get message history for a DID.
   */
  async getMessages(did: string, filters?: {
    message_type?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    const where: Record<string, unknown> = {
      OR: [{ from_did: did }, { to_did: did }],
    }
    if (filters?.message_type) where.message_type = filters.message_type
    if (filters?.status) where.status = filters.status

    const [messages, total] = await Promise.all([
      prisma.a2AMessage.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
        select: {
          id: true,
          message_type: true,
          from_did: true,
          from_address: true,
          to_did: true,
          status: true,
          task_id: true,
          proposal_id: true,
          created_at: true,
          processed_at: true,
          // Exclude payload and signature for list view
        },
      }),
      prisma.a2AMessage.count({ where }),
    ])

    return { messages, total }
  },
}
