/**
 * User Virtual Card Service
 *
 * Business logic for managing virtual Visa cards at the user level.
 * Bridges Protocol Banks' AuthUser with the Yativo Card Issuing API.
 *
 * Flow: USDC deposit → Yativo USD balance → Virtual card issuance → Spending
 *
 * @module lib/services/user-virtual-card.service
 */

import { prisma } from '@/lib/prisma'
import { yativoClient, type YativoFundingToken } from './yativo-client.service'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateUserCardInput {
  ownerAddress: string
  initialAmount: number
  label?: string
}

export interface FundUserCardInput {
  cardId: string
  ownerAddress: string
  amount: number
}

export interface VirtualCardPublic {
  id: string
  provider: 'YATIVO'
  providerCardId: string
  last4: string | null
  status: string
  balance: number
  currency: string
  label: string | null
  ownerAddress: string
  createdAt: Date
  updatedAt: Date
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function toPublic(card: {
  id: string
  card_provider: string
  provider_card_id: string
  last4: string | null
  status: string
  balance: number
  currency: string
  label: string | null
  owner_address: string
  created_at: Date
  updated_at: Date
}): VirtualCardPublic {
  return {
    id: card.id,
    provider: 'YATIVO',
    providerCardId: card.provider_card_id,
    last4: card.last4,
    status: card.status,
    balance: card.balance,
    currency: card.currency,
    label: card.label,
    ownerAddress: card.owner_address,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const userVirtualCardService = {
  /**
   * Get the USDC/USDT deposit address for funding the platform balance.
   */
  async getDepositAddress(token: YativoFundingToken = 'USDC') {
    return yativoClient.getDepositAddress(token)
  },

  /**
   * List all virtual cards for a wallet address.
   */
  async listCards(ownerAddress: string): Promise<VirtualCardPublic[]> {
    const cards = await prisma.userVirtualCard.findMany({
      where: { owner_address: ownerAddress.toLowerCase() },
      orderBy: { created_at: 'desc' },
    })
    return cards.map(toPublic)
  },

  /**
   * Create a new virtual Visa card.
   * Deducts from the platform's Yativo USD balance (pre-funded with USDC).
   */
  async createCard(input: CreateUserCardInput): Promise<VirtualCardPublic> {
    const yativoCard = await yativoClient.createCard({
      initial_amount: input.initialAmount,
      label: input.label ?? `Protocol Banks Card`,
    })

    const dbCard = await prisma.userVirtualCard.create({
      data: {
        owner_address: input.ownerAddress.toLowerCase(),
        card_provider: 'YATIVO',
        provider_card_id: yativoCard.id,
        last4: yativoCard.last4,
        status: yativoCard.status,
        balance: yativoCard.balance,
        currency: yativoCard.currency,
        label: input.label ?? null,
      },
    })

    return toPublic(dbCard)
  },

  /**
   * Get sensitive card details (PAN, CVV, expiry).
   * This is a privileged operation — always audit-logged.
   */
  async getCardDetails(cardId: string, ownerAddress: string) {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to access this card')
    }

    const details = await yativoClient.getCardDetails(dbCard.provider_card_id)

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
      label: dbCard.label,
    }
  },

  /**
   * Add funds to an existing card from the platform's Yativo balance.
   */
  async fundCard(input: FundUserCardInput): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: input.cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== input.ownerAddress.toLowerCase()) throw new Error('Not authorized')
    if (dbCard.status === 'CLOSED') throw new Error('Cannot fund a closed card')

    const updated = await yativoClient.fundCard({
      card_id: dbCard.provider_card_id,
      amount: input.amount,
    })

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: input.cardId },
      data: { balance: updated.balance, updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Freeze or unfreeze a card.
   */
  async toggleFreeze(cardId: string, ownerAddress: string, freeze: boolean): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    const updated = freeze
      ? await yativoClient.freezeCard(dbCard.provider_card_id)
      : await yativoClient.unfreezeCard(dbCard.provider_card_id)

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: updated.status, updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Permanently close a card. Remaining balance is returned to platform pool.
   */
  async closeCard(cardId: string, ownerAddress: string): Promise<{ success: boolean; refundedAmount: number }> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    const result = await yativoClient.closeCard(dbCard.provider_card_id)

    await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: 'CLOSED', balance: 0, updated_at: new Date() },
    })

    return { success: result.success, refundedAmount: result.refunded_amount }
  },

  /**
   * Sync a single card's balance and status from Yativo.
   */
  async syncCard(cardId: string, ownerAddress: string): Promise<void> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')
    if (dbCard.status === 'CLOSED') return

    const liveCard = await yativoClient.getCard(dbCard.provider_card_id)
    await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: liveCard.status, balance: liveCard.balance, updated_at: new Date() },
    })
  },
}
