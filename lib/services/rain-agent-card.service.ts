import { prisma } from "@/lib/prisma"
import {
  rainCardService,
  type RainApplicationInput,
  type RainContract,
} from "./rain-card.service"
import {
  getCardProviderAccount,
  saveCardProviderAccount,
  toPublicCardProviderAccount,
  type CardProviderAccountPublic,
} from "./card-provider-account.service"
import { normalizeCardStatus, type CardStatus } from "./card-status"

export interface RainAgentCardPublic {
  id: string
  provider: "RAIN"
  providerCardId: string
  last4: string | null
  status: CardStatus
  balance: number
  currency: string
  label: string | null
  agentId: string
  createdAt: string
  updatedAt: string
}

function toPublic(card: {
  id: string
  provider_card_id: string
  last4: string | null
  status: string
  balance: number
  currency: string
  label: string | null
  agent_id: string
  created_at: Date
  updated_at: Date
}): RainAgentCardPublic {
  return {
    id: card.id,
    provider: "RAIN",
    providerCardId: card.provider_card_id,
    last4: card.last4,
    status: normalizeCardStatus(card.status),
    balance: card.balance,
    currency: card.currency,
    label: card.label,
    agentId: card.agent_id,
    createdAt: card.created_at.toISOString(),
    updatedAt: card.updated_at.toISOString(),
  }
}

export async function getRainAccount(
  ownerAddress: string,
): Promise<CardProviderAccountPublic | null> {
  const account = await getCardProviderAccount(ownerAddress)
  return toPublicCardProviderAccount(account?.provider === "RAIN" ? account : null)
}

export async function submitRainKyc(
  ownerAddress: string,
  input: RainApplicationInput,
): Promise<CardProviderAccountPublic> {
  const application = await rainCardService.createUserApplication(input)
  const saved = await saveCardProviderAccount({
    ownerAddress,
    provider: "RAIN",
    providerUserId: application.userId,
    status: application.applicationStatus,
    rawStatus: application.applicationStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return toPublicCardProviderAccount(saved)!
}

export async function createRainContract(
  ownerAddress: string,
  chainId: number,
): Promise<RainContract[]> {
  const account = await getCardProviderAccount(ownerAddress)
  if (!account || account.provider !== "RAIN") {
    throw new Error("Rain KYC is required before creating a deposit contract")
  }
  await rainCardService.createUserContract(account.providerUserId, chainId)
  return rainCardService.getUserContracts(account.providerUserId)
}

export async function getRainContracts(ownerAddress: string): Promise<RainContract[]> {
  const account = await getCardProviderAccount(ownerAddress)
  if (!account || account.provider !== "RAIN") return []
  return rainCardService.getUserContracts(account.providerUserId)
}

export async function issueRainCard(
  agentId: string,
  ownerAddress: string,
  label?: string | null,
): Promise<RainAgentCardPublic> {
  const account = await getCardProviderAccount(ownerAddress)
  if (!account || account.provider !== "RAIN") {
    throw new Error("Rain KYC is required before issuing a card")
  }

  const existing = await prisma.agentVirtualCard.findUnique({ where: { agent_id: agentId } })
  if (existing) {
    if (existing.card_provider === "RAIN") return toPublic(existing)
    throw new Error("This agent already has a Yativo card")
  }

  const card = await rainCardService.issueCard(account.providerUserId, {
    displayName: label ?? "Protocol Bank Agent Card",
  })

  const saved = await prisma.agentVirtualCard.create({
    data: {
      agent_id: agentId,
      owner_address: ownerAddress.toLowerCase(),
      card_provider: "RAIN",
      provider_card_id: card.id,
      last4: card.last4 ?? null,
      status: normalizeCardStatus(card.status),
      balance: 0,
      currency: "USD",
      label: label ?? null,
    },
  })

  return toPublic(saved)
}

export async function getRainCardSecrets(
  cardId: string,
  ownerAddress: string,
  sessionId: string,
): Promise<{ encryptedPan: string; encryptedCvc: string }> {
  const card = await prisma.agentVirtualCard.findFirst({
    where: { id: cardId },
    include: { agent: { select: { owner_address: true } } },
  })
  if (!card) throw new Error("Card not found")
  if (card.agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Not authorized")
  }
  if (card.card_provider !== "RAIN") {
    throw new Error("Card details are only available for Rain-issued cards")
  }
  if (!sessionId) throw new Error("SessionId is required")

  return rainCardService.getCardSecrets(card.provider_card_id, sessionId)
}
