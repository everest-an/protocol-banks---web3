/**
 * Agent Card Service
 *
 * Manages ERC-8004 Agent Cards: CRUD, DID generation, signature
 * verification, and external card resolution.
 *
 * @module lib/services/agent-card-service
 */

import { prisma } from '@/lib/prisma'
import { generateDid, extractAddressFromDid, type AgentCard } from '@/lib/a2a/types'
import { verifyMessage } from 'viem'
import type { CreateAgentCardInput } from '@/lib/validations/agent-card'

// ─── Types ──────────────────────────────────────────────────────────

export interface AgentCardRecord {
  id: string
  agent_id: string
  did: string
  display_name: string
  description: string | null
  version: string
  capabilities: unknown
  supported_tokens: string[]
  supported_chains: string[]
  a2a_endpoint: string | null
  mcp_endpoint: string | null
  auth_schemes: unknown
  reputation_score: number
  total_tasks: number
  completed_tasks: number
  owner_address: string
  signature: string | null
  is_public: boolean
  created_at: Date
  updated_at: Date
}

// ─── Service ────────────────────────────────────────────────────────

export const agentCardService = {
  /**
   * Create an Agent Card for an existing agent.
   */
  async createCard(
    agentId: string,
    ownerAddress: string,
    input: CreateAgentCardInput,
    chainId: number = 1
  ): Promise<AgentCardRecord> {
    // Verify the agent exists and belongs to the owner
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new Error('Agent not found')
    if (agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to manage this agent')
    }

    const did = generateDid(ownerAddress, chainId)

    return prisma.agentCard.create({
      data: {
        agent_id: agentId,
        did,
        display_name: input.display_name,
        description: input.description,
        capabilities: JSON.parse(JSON.stringify(input.capabilities)),
        supported_tokens: input.supported_tokens,
        supported_chains: input.supported_chains,
        a2a_endpoint: input.a2a_endpoint,
        mcp_endpoint: input.mcp_endpoint,
        auth_schemes: input.auth_schemes ? JSON.parse(JSON.stringify(input.auth_schemes)) : undefined,
        is_public: input.is_public,
        owner_address: ownerAddress.toLowerCase(),
      },
    })
  },

  /**
   * Get an Agent Card by agent ID.
   */
  async getCard(agentId: string): Promise<AgentCardRecord | null> {
    return prisma.agentCard.findUnique({ where: { agent_id: agentId } })
  },

  /**
   * Get an Agent Card by DID.
   */
  async getCardByDid(did: string): Promise<AgentCardRecord | null> {
    return prisma.agentCard.findUnique({ where: { did } })
  },

  /**
   * Update an Agent Card.
   */
  async updateCard(
    agentId: string,
    ownerAddress: string,
    updates: Partial<CreateAgentCardInput>
  ): Promise<AgentCardRecord> {
    const card = await prisma.agentCard.findUnique({ where: { agent_id: agentId } })
    if (!card) throw new Error('Agent Card not found')
    if (card.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to update this card')
    }

    const data: Record<string, unknown> = {}
    if (updates.display_name !== undefined) data.display_name = updates.display_name
    if (updates.description !== undefined) data.description = updates.description
    if (updates.capabilities !== undefined) data.capabilities = JSON.parse(JSON.stringify(updates.capabilities))
    if (updates.supported_tokens !== undefined) data.supported_tokens = updates.supported_tokens
    if (updates.supported_chains !== undefined) data.supported_chains = updates.supported_chains
    if (updates.a2a_endpoint !== undefined) data.a2a_endpoint = updates.a2a_endpoint
    if (updates.mcp_endpoint !== undefined) data.mcp_endpoint = updates.mcp_endpoint
    if (updates.auth_schemes !== undefined) data.auth_schemes = JSON.parse(JSON.stringify(updates.auth_schemes))
    if (updates.is_public !== undefined) data.is_public = updates.is_public
    // Invalidate signature on content change
    data.signature = null

    return prisma.agentCard.update({
      where: { agent_id: agentId },
      data,
    })
  },

  /**
   * Delete an Agent Card.
   */
  async deleteCard(agentId: string, ownerAddress: string): Promise<void> {
    const card = await prisma.agentCard.findUnique({ where: { agent_id: agentId } })
    if (!card) throw new Error('Agent Card not found')
    if (card.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to delete this card')
    }
    await prisma.agentCard.delete({ where: { agent_id: agentId } })
  },

  /**
   * Store EIP-191 signature for an Agent Card.
   * The owner signs the card JSON to prove identity.
   */
  async signCard(
    agentId: string,
    ownerAddress: string,
    signature: string
  ): Promise<AgentCardRecord> {
    const card = await prisma.agentCard.findUnique({ where: { agent_id: agentId } })
    if (!card) throw new Error('Agent Card not found')
    if (card.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to sign this card')
    }

    // Build the message that was signed (canonical card JSON)
    const cardJson = this.buildSignableMessage(card)

    // Verify signature
    const isValid = await verifyMessage({
      address: ownerAddress as `0x${string}`,
      message: cardJson,
      signature: signature as `0x${string}`,
    })

    if (!isValid) throw new Error('Invalid signature')

    return prisma.agentCard.update({
      where: { agent_id: agentId },
      data: { signature },
    })
  },

  /**
   * Build the canonical message string for signing.
   */
  buildSignableMessage(card: AgentCardRecord): string {
    return JSON.stringify({
      did: card.did,
      display_name: card.display_name,
      capabilities: card.capabilities,
      supported_tokens: card.supported_tokens,
      supported_chains: card.supported_chains,
      owner_address: card.owner_address,
    })
  },

  /**
   * Verify an Agent Card's signature.
   */
  async verifyCardSignature(card: AgentCardRecord): Promise<boolean> {
    if (!card.signature) return false
    try {
      const message = this.buildSignableMessage(card)
      return await verifyMessage({
        address: card.owner_address as `0x${string}`,
        message,
        signature: card.signature as `0x${string}`,
      })
    } catch {
      return false
    }
  },

  /**
   * List publicly discoverable Agent Cards with filtering.
   */
  async listPublicCards(filters: {
    skill?: string
    token?: string
    chain?: string
    protocol?: string
    limit?: number
    offset?: number
  }): Promise<{ cards: AgentCardRecord[]; total: number }> {
    const where: Record<string, unknown> = { is_public: true }

    if (filters.token) {
      where.supported_tokens = { has: filters.token.toUpperCase() }
    }
    if (filters.chain) {
      where.supported_chains = { has: filters.chain.toLowerCase() }
    }

    const [cards, total] = await Promise.all([
      prisma.agentCard.findMany({
        where,
        orderBy: { reputation_score: 'desc' },
        take: filters.limit ?? 20,
        skip: filters.offset ?? 0,
      }),
      prisma.agentCard.count({ where }),
    ])

    // Post-filter by skill/protocol (JSON field filtering)
    let filtered = cards
    if (filters.skill) {
      const skillId = filters.skill.toLowerCase()
      filtered = filtered.filter((c) => {
        const caps = c.capabilities as { skills?: Array<{ id: string }> }
        return caps?.skills?.some((s) => s.id.toLowerCase() === skillId)
      })
    }
    if (filters.protocol) {
      const proto = filters.protocol
      filtered = filtered.filter((c) => {
        const caps = c.capabilities as { supported_protocols?: string[] }
        return caps?.supported_protocols?.includes(proto)
      })
    }

    return { cards: filtered, total }
  },

  /**
   * Update reputation score after a task completes.
   */
  async updateReputation(
    agentId: string,
    completed: boolean
  ): Promise<void> {
    const card = await prisma.agentCard.findUnique({ where: { agent_id: agentId } })
    if (!card) return

    const newTotal = card.total_tasks + 1
    const newCompleted = completed ? card.completed_tasks + 1 : card.completed_tasks
    const score = newTotal > 0 ? (newCompleted / newTotal) * 100 : 0

    await prisma.agentCard.update({
      where: { agent_id: agentId },
      data: {
        total_tasks: newTotal,
        completed_tasks: newCompleted,
        reputation_score: Math.round(score * 100) / 100,
      },
    })
  },

  /**
   * Convert a DB record to the public AgentCard JSON format.
   */
  toPublicCard(record: AgentCardRecord, baseUrl?: string): AgentCard {
    return {
      did: record.did,
      name: record.display_name,
      description: record.description ?? undefined,
      version: record.version,
      url: baseUrl,
      capabilities: record.capabilities as AgentCard['capabilities'],
      supported_tokens: record.supported_tokens,
      supported_chains: record.supported_chains,
      a2a_endpoint: record.a2a_endpoint ?? undefined,
      mcp_endpoint: record.mcp_endpoint ?? undefined,
      auth_schemes: record.auth_schemes as AgentCard['auth_schemes'],
      reputation: {
        score: record.reputation_score,
        total_tasks: record.total_tasks,
        completed_tasks: record.completed_tasks,
      },
      owner_address: record.owner_address,
      signature: record.signature ?? undefined,
    }
  },
}
