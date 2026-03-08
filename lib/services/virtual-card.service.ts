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
   * Users send USDC here to top up the platform's USD pool.
   */
  async getDepositAddress(token: YativoFundingToken = 'USDC') {
    return yativoClient.getDepositAddress(token)
  },

  /**
   * Get the current platform USD balance available for card issuance.
   */
  async getPlatformBalance() {
    return yativoClient.getPlatformBalance()
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
    const yativoCard = await yativoClient.createCard({
      initial_amount: input.initialAmount,
      label: input.label ?? `${agent.name} Card`,
    })

    // 3. Persist the card record in our database
    const dbCard = await prisma.agentVirtualCard.create({
      data: {
        agent_id: input.agentId,
        owner_address: input.ownerAddress,
        card_provider: 'YATIVO',
        provider_card_id: yativoCard.id,
        last4: yativoCard.last4,
        status: yativoCard.status,
        balance: yativoCard.balance,
        currency: yativoCard.currency,
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
   * Get sensitive card details (PAN, CVV, expiry) for a specific card.
   * This is a privileged operation — always audit-logged.
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

    // Fetch sensitive details from Yativo
    const details = await yativoClient.getCardDetails(dbCard.provider_card_id)

    // Log the access for audit trail
    await prisma.agentActivity.create({
      data: {
        agent_id: dbCard.agent_id,
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
      pan: details.pan,
      cvv: details.cvv,
      expiryMonth: details.expiry_month,
      expiryYear: details.expiry_year,
      status: dbCard.status,
      balance: dbCard.balance,
      currency: dbCard.currency,
    }
  },

  /**
   * Add funds to an existing card from the platform's Yativo balance.
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
    if (dbCard.status === 'CLOSED') throw new Error('Cannot fund a closed card')

    // Fund via Yativo
    const updated = await yativoClient.fundCard({
      card_id: dbCard.provider_card_id,
      amount: input.amount,
    })

    // Sync balance in our DB
    const updatedDbCard = await prisma.agentVirtualCard.update({
      where: { id: input.cardId },
      data: { balance: updated.balance, updated_at: new Date() },
    })

    return toPublicCard(updatedDbCard)
  },

  /**
   * Freeze or unfreeze a card.
   */
  async toggleFreeze(cardId: string, ownerAddress: string, freeze: boolean): Promise<VirtualCardPublic> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) {
      throw new Error('Not authorized')
    }

    const updated = freeze
      ? await yativoClient.freezeCard(dbCard.provider_card_id)
      : await yativoClient.unfreezeCard(dbCard.provider_card_id)

    const updatedDbCard = await prisma.agentVirtualCard.update({
      where: { id: cardId },
      data: { status: updated.status, updated_at: new Date() },
    })

    return toPublicCard(updatedDbCard)
  },

  /**
   * Permanently close a card and return remaining balance to platform pool.
   */
  async closeCard(cardId: string, ownerAddress: string): Promise<{ success: boolean; refundedAmount: number }> {
    const dbCard = await prisma.agentVirtualCard.findFirst({
      where: { id: cardId },
      include: { agent: { select: { owner_address: true } } },
    })

    if (!dbCard) throw new Error('Card not found')
    if (dbCard.agent.owner_address !== ownerAddress) {
      throw new Error('Not authorized')
    }

    const result = await yativoClient.closeCard(dbCard.provider_card_id)

    await prisma.agentVirtualCard.update({
      where: { id: cardId },
      data: { status: 'CLOSED', balance: 0, updated_at: new Date() },
    })

    return { success: result.success, refundedAmount: result.refunded_amount }
  },

  /**
   * Sync card balances and statuses from Yativo (background refresh).
   */
  async syncCards(agentId: string): Promise<void> {
    const dbCards = await prisma.agentVirtualCard.findMany({
      where: { agent_id: agentId, status: { not: 'CLOSED' } },
    })

    await Promise.allSettled(
      dbCards.map(async (dbCard) => {
        const liveCard = await yativoClient.getCard(dbCard.provider_card_id)
        await prisma.agentVirtualCard.update({
          where: { id: dbCard.id },
          data: {
            status: liveCard.status,
            balance: liveCard.balance,
            updated_at: new Date(),
          },
        })
      })
    )
  },
}
