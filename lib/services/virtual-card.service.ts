/**
 * Virtual Card Service
 *
 * Business logic layer for managing AI agent virtual Visa cards.
 * Bridges Protocol Banks' internal data model with the Yativo API.
 *
 * Flow: USDC (on-chain) → Yativo Platform Balance (USD) → Virtual Card
 *
 * @module lib/services/virtual-card.service
 */

import { prisma } from '@/lib/prisma'
import { yativoClient, type YativoFundingToken } from './yativo-client.service'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateVirtualCardInput {
  agentId: string
  ownerAddress: string
  /** Amount in USD to load onto the card */
  initialAmount: number
  /** Optional label for identification */
  label?: string
}

export interface FundVirtualCardInput {
  cardId: string
  ownerAddress: string
  amount: number
}

export interface VirtualCardPublic {
  id: string
  provider: string
  providerCardId: string
  last4: string | null
  status: string
  balance: number
  currency: string
  label: string | null
  agentId: string
  createdAt: Date
  updatedAt: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPublicCard(card: {
  id: string
  card_provider: string
  provider_card_id: string
  last4: string | null
  status: string
  balance: number
  currency: string
  label: string | null
  agent_id: string
  created_at: Date
  updated_at: Date
}): VirtualCardPublic {
  return {
    id: card.id,
    provider: card.card_provider,
    providerCardId: card.provider_card_id,
    last4: card.last4,
    status: card.status,
    balance: card.balance,
    currency: card.currency,
    label: card.label,
    agentId: card.agent_id,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const virtualCardService = {
  /**
   * Get the Yativo USDC deposit address for funding the platform balance.
   */
  async getDepositAddress(token: YativoFundingToken = 'USDC') {
    return yativoClient.getDepositAddress(token)
  },

  /**
   * Get the current platform wallet balance.
   */
  async getPlatformBalance() {
    return yativoClient.getWalletBalance()
  },

  /**
   * Create a new virtual Visa card for an AI agent.
   *
   * This deducts from the platform's Yativo USD balance (which must have
   * been pre-funded with USDC). The card is immediately usable online.
   */
  async createCard(input: CreateVirtualCardInput): Promise<VirtualCardPublic> {
    // 1. Verify the agent exists and belongs to the owner
    const agent = await prisma.agent.findFirst({
      where: { id: input.agentId, owner_address: input.ownerAddress },
    })
    if (!agent) {
      throw new Error('Agent not found or not authorized')
    }

    // 2. Issue the card via Yativo API
    const response = await yativoClient.createCard({
      amount: input.initialAmount,
      name_on_card: input.label ?? `${agent.name} Card`,
    })

    const yativoCard = response.data

    // 3. Persist the card record in our database
    const dbCard = await prisma.agentVirtualCard.create({
      data: {
        agent_id: input.agentId,
        owner_address: input.ownerAddress,
        card_provider: 'YATIVO',
        provider_card_id: yativoCard.id ?? yativoCard.card_id ?? '',
        last4: yativoCard.last4 ?? yativoCard.card_number?.slice(-4) ?? null,
        status: yativoCard.status ?? 'active',
        balance: yativoCard.balance ?? input.initialAmount,
        currency: yativoCard.currency ?? 'USD',
        label: input.label ?? `${agent.name} Card`,
      },
    })

    return toPublicCard(dbCard)
  },

  /**
   * List all virtual cards for a specific AI agent.
   */
  async listCards(agentId: string, ownerAddress: string): Promise<VirtualCardPublic[]> {
    // Verify ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, owner_address: ownerAddress },
    })
    if (!agent) throw new Error('Agent not found or not authorized')

    const cards = await prisma.agentVirtualCard.findMany({
      where: { agent_id: agentId },
      orderBy: { created_at: 'desc' },
    })

    return cards.map(toPublicCard)
  },

  /**
   * Get card details for a specific card.
   */
  async getCardDetails(cardId: string, ownerAddress: string) {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true, name: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) {
      throw new Error('Not authorized to access this card')
    }

    // Log the access for audit trail
    await prisma.agentActivity.create({
      data: {
        agent_id: dbCard.agent_id,
        owner_address: ownerAddress,
        action: 'virtual_card_details_accessed',
        details: {
          card_id: cardId,
          last4: dbCard.last4,
          accessed_by: ownerAddress,
        },
      },
    }).catch(() => { /* Non-blocking audit log */ })

    return {
      id: dbCard.id,
      last4: dbCard.last4,
      pan: null as string | null,
      cvv: null as string | null,
      expiryMonth: null as string | null,
      expiryYear: null as string | null,
      status: dbCard.status,
      balance: dbCard.balance,
      currency: dbCard.currency,
    }
  },

  /**
   * Add funds to an existing card from the platform's Yativo balance.
   * Endpoint: POST /customer/virtual/cards/topup
   */
  async fundCard(input: FundVirtualCardInput): Promise<VirtualCardPublic> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: input.cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== input.ownerAddress) {
      throw new Error('Not authorized to fund this card')
    }
    if (dbCard.status === 'terminated') throw new Error('Cannot fund a terminated card')

    const response = await yativoClient.fundCard({
      card_id: dbCard.provider_card_id,
      amount: input.amount,
    })

    const newBalance = response.data?.balance ?? (dbCard.balance + input.amount)

    const updatedDbCard = await prisma.agentVirtualCard.update({
      where: { id: input.cardId },
      data: { balance: newBalance, updated_at: new Date() },
    })

    return toPublicCard(updatedDbCard)
  },

  /**
   * Activate a card.
   * Endpoint: POST /customer/virtual/cards/activate
   */
  async activateCard(cardId: string, ownerAddress: string): Promise<VirtualCardPublic> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) throw new Error('Not authorized')

    const response = await yativoClient.activateCard(dbCard.provider_card_id)

    const updatedDbCard = await prisma.agentVirtualCard.update({
      where: { id: cardId },
      data: { status: response.data?.status ?? 'active', updated_at: new Date() },
    })

    return toPublicCard(updatedDbCard)
  },

  /**
   * Withdraw funds from a card back to platform balance.
   * Endpoint: POST /customer/virtual/cards/withdraw
   */
  async withdrawFromCard(cardId: string, ownerAddress: string, amount: number): Promise<VirtualCardPublic> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) throw new Error('Not authorized')

    const response = await yativoClient.withdrawFromCard(dbCard.provider_card_id, amount)

    const newBalance = response.data?.balance ?? Math.max(0, dbCard.balance - amount)

    const updatedDbCard = await prisma.agentVirtualCard.update({
      where: { id: cardId },
      data: { balance: newBalance, updated_at: new Date() },
    })

    return toPublicCard(updatedDbCard)
  },

  /**
   * Terminate (permanently close) a card.
   * Endpoint: POST /customer/virtual/cards/terminate
   */
  async terminateCard(cardId: string, ownerAddress: string): Promise<{ success: boolean }> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) throw new Error('Not authorized')

    await yativoClient.terminateCard(dbCard.provider_card_id)

    await prisma.agentVirtualCard.update({
      where: { id: cardId },
      data: { status: 'terminated', balance: 0, updated_at: new Date() },
    })

    return { success: true }
  },
}
