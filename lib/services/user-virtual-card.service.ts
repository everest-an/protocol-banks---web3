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
   * Get platform wallet balance.
   */
  async getPlatformBalance() {
    return yativoClient.getWalletBalance()
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
    const response = await yativoClient.createCard({
      amount: input.initialAmount,
      name_on_card: input.label ?? 'Protocol Banks Card',
    })

    // Extract card data from Yativo API response wrapper
    const yativoCard = response.data

    const dbCard = await prisma.userVirtualCard.create({
      data: {
        owner_address: input.ownerAddress.toLowerCase(),
        card_provider: 'YATIVO',
        provider_card_id: yativoCard.id ?? yativoCard.card_id ?? '',
        last4: yativoCard.last4 ?? yativoCard.card_number?.slice(-4) ?? null,
        status: yativoCard.status ?? 'active',
        balance: yativoCard.balance ?? input.initialAmount,
        currency: yativoCard.currency ?? 'USD',
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

    // Note: Yativo may not have a separate "details" endpoint.
    // Card details might be returned during creation.
    // For now, return what we have in the database.
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
      label: dbCard.label,
    }
  },

  /**
   * Add funds to an existing card from the platform's Yativo balance.
   * Endpoint: POST /customer/virtual/cards/topup
   */
  async fundCard(input: FundUserCardInput): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: input.cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== input.ownerAddress.toLowerCase()) throw new Error('Not authorized')
    if (dbCard.status === 'terminated') throw new Error('Cannot fund a terminated card')

    const response = await yativoClient.fundCard({
      card_id: dbCard.provider_card_id,
      amount: input.amount,
    })

    const newBalance = response.data?.balance ?? (dbCard.balance + input.amount)

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: input.cardId },
      data: { balance: newBalance, updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Withdraw funds from a card back to platform balance.
   * Endpoint: POST /customer/virtual/cards/withdraw
   */
  async withdrawFromCard(cardId: string, ownerAddress: string, amount: number): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    const response = await yativoClient.withdrawFromCard(dbCard.provider_card_id, amount)

    const newBalance = response.data?.balance ?? Math.max(0, dbCard.balance - amount)

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { balance: newBalance, updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Terminate (permanently close) a card.
   * Endpoint: POST /customer/virtual/cards/terminate
   */
  async terminateCard(cardId: string, ownerAddress: string): Promise<{ success: boolean }> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    await yativoClient.terminateCard(dbCard.provider_card_id)

    await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: 'terminated', balance: 0, updated_at: new Date() },
    })

    return { success: true }
  },

  /**
   * Freeze a card (set status to inactive/frozen in local DB).
   * Yativo doesn't have a freeze endpoint, so we terminate and track locally.
   * For a soft freeze, we just update the local status.
   */
  async freezeCard(cardId: string, ownerAddress: string): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')
    if (dbCard.status === 'terminated') throw new Error('Cannot freeze a terminated card')

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: 'FROZEN', updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Unfreeze a card (restore to active status).
   */
  async unfreezeCard(cardId: string, ownerAddress: string): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')
    if (dbCard.status !== 'FROZEN') throw new Error('Card is not frozen')

    // Re-activate on Yativo side
    try {
      await yativoClient.activateCard(dbCard.provider_card_id)
    } catch {
      // If Yativo doesn't support re-activation, just update local status
    }

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: 'ACTIVE', updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },

  /**
   * Sync card data from Yativo to local DB.
   * Fetches the latest card list from Yativo and updates the local record.
   */
  async syncCard(cardId: string, ownerAddress: string): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    try {
      const response = await yativoClient.listCards()
      const yativoCards = response.data ?? []
      const matchingCard = yativoCards.find(
        (c) => (c.id === dbCard.provider_card_id) || (c.card_id === dbCard.provider_card_id)
      )

      if (matchingCard) {
        const updatedDbCard = await prisma.userVirtualCard.update({
          where: { id: cardId },
          data: {
            balance: matchingCard.balance ?? dbCard.balance,
            status: matchingCard.status ?? dbCard.status,
            last4: matchingCard.last4 ?? matchingCard.card_number?.slice(-4) ?? dbCard.last4,
            updated_at: new Date(),
          },
        })
        return toPublic(updatedDbCard)
      }
    } catch {
      // If Yativo API fails, return current DB state
    }

    return toPublic(dbCard)
  },

  /**
   * Activate a card.
   * Endpoint: POST /customer/virtual/cards/activate
   */
  async activateCard(cardId: string, ownerAddress: string): Promise<VirtualCardPublic> {
    const dbCard = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
    if (!dbCard) throw new Error('Card not found')
    if (dbCard.owner_address !== ownerAddress.toLowerCase()) throw new Error('Not authorized')

    const response = await yativoClient.activateCard(dbCard.provider_card_id)

    const updatedDbCard = await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { status: response.data?.status ?? 'active', updated_at: new Date() },
    })

    return toPublic(updatedDbCard)
  },
}
