// rls:system — Rain webhook auth is the HMAC signature, not a wallet session.
import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { budgetService } from "@/lib/services/budget-service"
import { normalizeCardStatus } from "@/lib/services/card-status"

export const dynamic = "force-dynamic"

interface RainEvent {
  event_id?: string
  event_type?: string
  timestamp?: number
  data?: Record<string, unknown>
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

async function findCard(cardId: string) {
  return prisma.agentVirtualCard.findFirst({
    where: { provider_card_id: cardId },
    include: { agent: { select: { owner_address: true } } },
  })
}

async function usdcBudget(agentId: string) {
  const budgets = await budgetService.list(agentId)
  return budgets.find((b) => b.token.toUpperCase() === "USDC" && !b.chain_id) ?? null
}

async function logActivity(agentId: string, ownerAddress: string, action: string, details: Record<string, unknown>) {
  try {
    await prisma.agentActivity.create({
      data: {
        agent_id: agentId,
        owner_address: ownerAddress,
        action,
        details: JSON.parse(JSON.stringify(details)),
      },
    })
  } catch {
  }
}

async function alreadyProcessed(wallet: string, eventId: string): Promise<boolean> {
  try {
    const rows = await prisma.usageEvent.findMany({
      where: { name: "rain_webhook", wallet: wallet.toLowerCase() },
      orderBy: { created_at: "desc" },
      take: 100,
    })
    return rows.some((row) => {
      const props = (row.props ?? {}) as { event_id?: string }
      return props.event_id === eventId
    })
  } catch {
    return false
  }
}

async function markProcessed(wallet: string, eventId: string) {
  try {
    await prisma.usageEvent.create({
      data: {
        name: "rain_webhook",
        wallet: wallet.toLowerCase(),
        props: { event_id: eventId },
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

  let payload: RainEvent
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const eventId = payload.event_id
  const cardId = typeof payload.data?.card_id === "string" ? payload.data.card_id : null
  if (!eventId || !cardId) {
    return NextResponse.json({ ok: true, ignored: "missing event_id or card_id" })
  }

  const card = await findCard(cardId)
  if (!card) return NextResponse.json({ ok: true, ignored: "unknown card" })
  if (card.card_provider !== "RAIN") return NextResponse.json({ ok: true, ignored: "not a Rain card" })

  const owner = card.agent.owner_address
  if (await alreadyProcessed(owner, eventId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const type = payload.event_type ?? ""
  const amount = Number(payload.data?.amount ?? 0)
  const transactionId = typeof payload.data?.transaction_id === "string" ? payload.data.transaction_id : null

  if (type === "card.transaction" || type === "card.settlement") {
    const budget = await usdcBudget(card.agent_id)
    if (type === "card.settlement" && budget && Number.isFinite(amount) && amount > 0) {
      try {
        await budgetService.deductBudget(budget.id, String(amount))
      } catch {
      }
    }
    await logActivity(card.agent_id, owner, type === "card.settlement" ? "card_settlement" : "card_transaction", {
      cardId: card.id,
      providerCardId: card.provider_card_id,
      amount: Number.isFinite(amount) ? amount : null,
      currency: payload.data?.currency ?? null,
      merchant: payload.data?.merchant_name ?? null,
      status: payload.data?.status ?? null,
      transactionId,
      budgetId: budget?.id ?? null,
    })
  } else if (type === "card.created" || type === "card.activated" || type === "card.frozen" || type === "card.closed") {
    const status =
      type === "card.activated"
        ? "ACTIVE"
        : type === "card.frozen"
          ? "FROZEN"
          : type === "card.closed"
            ? "CLOSED"
            : normalizeCardStatus(payload.data?.status)
    await prisma.agentVirtualCard
      .update({ where: { id: card.id }, data: { status, updated_at: new Date() } })
      .catch(() => {})
    await logActivity(card.agent_id, owner, "card_status", {
      cardId: card.id,
      providerCardId: card.provider_card_id,
      status,
    })
  }

  await markProcessed(owner, eventId)
  return NextResponse.json({ ok: true })
}
