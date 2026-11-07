// rls:system — Rain authorization webhook auth is the HMAC signature, not a wallet session.
import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { budgetService } from "@/lib/services/budget-service"

export const dynamic = "force-dynamic"

interface RainAuthorization {
  authorization_id?: string
  card_id?: string
  amount?: number
  currency?: string
  merchant_name?: string
}

function verify(raw: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.RAIN_WEBHOOK_SECRET
  if (!secret || !signature || !timestamp) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function logActivity(agentId: string, ownerAddress: string, details: Record<string, unknown>) {
  try {
    await prisma.agentActivity.create({
      data: {
        agent_id: agentId,
        owner_address: ownerAddress,
        action: "card_authorization",
        details: JSON.parse(JSON.stringify(details)),
      },
    })
  } catch {
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verify(raw, request.headers.get("x-rain-signature"), request.headers.get("x-rain-timestamp"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let auth: RainAuthorization
  try {
    auth = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const authorizationId = auth.authorization_id ?? ""
  const cardId = auth.card_id ?? ""
  const amount = Number(auth.amount ?? 0)
  const currency = String(auth.currency ?? "USD").toUpperCase()

  if (!cardId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({
      authorization_id: authorizationId,
      approved: false,
      reason: "invalid_request",
    })
  }

  const card = await prisma.agentVirtualCard.findFirst({
    where: { provider_card_id: cardId },
    include: { agent: { select: { owner_address: true, status: true } } },
  })

  if (!card || card.card_provider !== "RAIN") {
    return NextResponse.json({
      authorization_id: authorizationId,
      approved: false,
      reason: "unknown_card",
    })
  }

  if (card.agent.status !== "active") {
    await logActivity(card.agent_id, card.agent.owner_address, {
      authorizationId,
      cardId: card.id,
      amount,
      currency,
      merchant: auth.merchant_name ?? null,
      approved: false,
      reason: "agent_inactive",
    })
    return NextResponse.json({
      authorization_id: authorizationId,
      approved: false,
      reason: "agent_inactive",
    })
  }

  if (currency !== "USD" && currency !== "USDC") {
    return NextResponse.json({
      authorization_id: authorizationId,
      approved: false,
      reason: "unsupported_currency",
    })
  }

  const budgets = await budgetService.list(card.agent_id)
  const budget = budgets.find((b) => b.token.toUpperCase() === "USDC" && !b.chain_id)

  if (budget) {
    const availability = await budgetService.checkAvailability(card.agent_id, String(amount), "USDC")
    if (!availability.available) {
      await logActivity(card.agent_id, card.agent.owner_address, {
        authorizationId,
        cardId: card.id,
        amount,
        currency,
        merchant: auth.merchant_name ?? null,
        approved: false,
        reason: availability.reason ?? "insufficient_funds",
      })
      return NextResponse.json({
        authorization_id: authorizationId,
        approved: false,
        reason: "insufficient_funds",
      })
    }
  }

  await logActivity(card.agent_id, card.agent.owner_address, {
    authorizationId,
    cardId: card.id,
    amount,
    currency,
    merchant: auth.merchant_name ?? null,
    approved: true,
    reason: budget ? "budget_available" : "no_budget_limit",
  })

  return NextResponse.json({
    authorization_id: authorizationId,
    approved: true,
    reason: "approved",
  })
}
