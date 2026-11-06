import { createHash } from "crypto"
import { verifyMessage } from "viem"
import { prisma } from "@/lib/prisma"
import { webhookTriggerService } from "@/lib/services/webhook-trigger-service"
import type { WebhookEvent } from "@/lib/services/webhook-service"

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const HASH = /^(0x[a-fA-F0-9]{64}|sha256:[a-fA-F0-9]{64})$/

export type OrderStatus =
  | "accepted"
  | "delivered"
  | "paid"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded"

export class CommerceError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>
    return Object.keys(object)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonical(object[key])
        return result
      }, {})
  }
  return value
}

export function hashTerms(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
}

function address(value: unknown, field: string): string {
  if (typeof value !== "string" || !EVM_ADDRESS.test(value.trim())) {
    throw new CommerceError(400, `${field} must be a 0x EVM address`)
  }
  return value.trim().toLowerCase()
}

function text(value: unknown, field: string, max = 4000): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CommerceError(400, `${field} is required`)
  }
  if (value.length > max) throw new CommerceError(400, `${field} is too long`)
  return value.trim()
}

function positive(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new CommerceError(400, `${field} must be a positive number`)
  }
  return Number(number.toFixed(6))
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function notify(owners: string[], event: WebhookEvent, data: Record<string, unknown>) {
  const unique = [...new Set(owners.filter(Boolean).map((owner) => owner.toLowerCase()))]
  void Promise.allSettled(unique.map((owner) => webhookTriggerService.triggerCommerce(owner, event, data)))
}

export function serviceView(row: any) {
  return {
    id: row.id,
    ownerAddress: row.owner_address,
    agentId: row.agent_id,
    name: row.name,
    description: row.description,
    category: row.category,
    endpoint: row.endpoint,
    priceUsd: row.price_usd,
    token: row.token,
    chain: row.chain,
    terms: row.terms,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function quoteView(row: any) {
  return {
    id: row.id,
    serviceId: row.service_id,
    seller: row.seller_address,
    buyer: row.buyer_address,
    amountUsd: row.amount_usd,
    token: row.token,
    chain: row.chain,
    scope: row.scope,
    deliveryDue: iso(row.delivery_due),
    terms: row.terms,
    termsHash: row.terms_hash,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function orderView(row: any) {
  return {
    id: row.id,
    quoteId: row.quote_id,
    serviceId: row.service_id,
    buyer: row.buyer_address,
    seller: row.seller_address,
    amountUsd: row.amount_usd,
    token: row.token,
    chain: row.chain,
    scope: row.scope,
    termsHash: row.terms_hash,
    status: row.status,
    paymentId: row.payment_id,
    deliveryHash: row.delivery_hash,
    deliveryUri: row.delivery_uri,
    deliverySignature: row.delivery_signature,
    disputeReason: row.dispute_reason,
    refundTxHash: row.refund_tx_hash,
    createdAt: row.created_at.toISOString(),
    acceptedAt: row.accepted_at.toISOString(),
    deliveredAt: iso(row.delivered_at),
    paidAt: iso(row.paid_at),
    completedAt: iso(row.completed_at),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function createService(owner: string, agentId: string | undefined, input: Record<string, unknown>) {
  const name = text(input.name, "name", 160)
  const description = typeof input.description === "string" ? input.description.slice(0, 2000) : null
  const category = typeof input.category === "string" ? input.category.slice(0, 80) : null
  const endpoint = typeof input.endpoint === "string" ? input.endpoint.slice(0, 500) : null
  const priceUsd = positive(input.priceUsd, "priceUsd")
  const token = typeof input.token === "string" ? input.token.trim().toUpperCase() : "USDC"
  const chain = typeof input.chain === "string" ? input.chain.trim().toLowerCase() : "base"
  const terms = input.terms && typeof input.terms === "object" ? input.terms : null
  const row = await prisma.agentService.create({
    data: {
      owner_address: owner.toLowerCase(),
      agent_id: agentId ?? null,
      name,
      description,
      category,
      endpoint,
      price_usd: priceUsd,
      token,
      chain,
      terms: terms as never,
    },
  })
  return serviceView(row)
}

export async function listServices(input: { category?: string | null; q?: string | null; limit?: number }) {
  const where: Record<string, unknown> = { active: true }
  if (input.category) where.category = input.category
  if (input.q) where.name = { contains: input.q, mode: "insensitive" }
  const rows = await prisma.agentService.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: Math.min(Math.max(input.limit ?? 50, 1), 100),
  })
  return rows.map(serviceView)
}

export async function getService(id: string) {
  const row = await prisma.agentService.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "service not found")
  return serviceView(row)
}

export async function createQuote(owner: string, input: Record<string, unknown>) {
  const serviceId = text(input.serviceId, "serviceId")
  const service = await prisma.agentService.findUnique({ where: { id: serviceId } })
  if (!service || service.owner_address !== owner.toLowerCase()) {
    throw new CommerceError(404, "service not found")
  }
  if (!service.active) throw new CommerceError(409, "service is inactive")
  const buyer = address(input.buyer, "buyer")
  if (buyer === service.owner_address.toLowerCase()) {
    throw new CommerceError(400, "buyer and seller must be different")
  }
  const amountUsd = input.amountUsd === undefined ? service.price_usd : positive(input.amountUsd, "amountUsd")
  const scope = text(input.scope, "scope", 4000)
  const terms = input.terms && typeof input.terms === "object" ? input.terms : {}
  const deliveryDue = input.deliveryDue ? new Date(String(input.deliveryDue)) : null
  if (deliveryDue && Number.isNaN(deliveryDue.getTime())) {
    throw new CommerceError(400, "deliveryDue must be an ISO date")
  }
  const seconds = input.expiresInSeconds === undefined ? 3600 : Number(input.expiresInSeconds)
  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 7 * 24 * 60 * 60) {
    throw new CommerceError(400, "expiresInSeconds must be between 60 and 604800")
  }
  const expiresAt = new Date(Date.now() + seconds * 1000)
  const termsHash = hashTerms({
    serviceId,
    seller: service.owner_address,
    buyer,
    amountUsd,
    token: service.token,
    chain: service.chain,
    scope,
    deliveryDue: deliveryDue?.toISOString() ?? null,
    terms,
  })
  const row = await prisma.agentQuote.create({
    data: {
      service_id: serviceId,
      seller_address: service.owner_address,
      buyer_address: buyer,
      amount_usd: amountUsd,
      token: service.token,
      chain: service.chain,
      scope,
      delivery_due: deliveryDue,
      terms: terms as never,
      terms_hash: termsHash,
      expires_at: expiresAt,
    },
  })
  return quoteView(row)
}

export async function listQuotes(owner: string, role: string) {
  const wallet = owner.toLowerCase()
  const where = role === "seller"
    ? { seller_address: wallet }
    : role === "buyer"
      ? { buyer_address: wallet }
      : { OR: [{ buyer_address: wallet }, { seller_address: wallet }] }
  const rows = await prisma.agentQuote.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
  })
  return rows.map(quoteView)
}

export async function acceptQuote(owner: string, quoteId: string) {
  const buyer = owner.toLowerCase()
  const quote = await prisma.agentQuote.findUnique({ where: { id: quoteId } })
  if (!quote) throw new CommerceError(404, "quote not found")
  if (quote.buyer_address !== buyer) throw new CommerceError(403, "only the quoted buyer can accept")
  if (quote.status === "accepted") {
    const existing = await prisma.agentOrder.findUnique({ where: { quote_id: quoteId } })
    if (existing) return orderView(existing)
  }
  if (quote.status !== "open") throw new CommerceError(409, `quote is ${quote.status}`)
  if (quote.expires_at <= new Date()) {
    await prisma.agentQuote.update({ where: { id: quoteId }, data: { status: "expired" } })
    throw new CommerceError(409, "quote expired")
  }
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.agentOrder.create({
      data: {
        quote_id: quote.id,
        service_id: quote.service_id,
        buyer_address: quote.buyer_address,
        seller_address: quote.seller_address,
        amount_usd: quote.amount_usd,
        token: quote.token,
        chain: quote.chain,
        scope: quote.scope,
        terms_hash: quote.terms_hash,
        status: "accepted",
      },
    })
    await tx.agentQuote.update({ where: { id: quote.id }, data: { status: "accepted" } })
    return created
  }).catch(async (error: { code?: string }) => {
    if (error.code === "P2002") {
      const existing = await prisma.agentOrder.findUnique({ where: { quote_id: quoteId } })
      if (existing) return existing
    }
    throw error
  })
  const view = orderView(order)
  notify([order.buyer_address, order.seller_address], "commerce.quote_accepted", view)
  return view
}

export async function listOrders(owner: string) {
  const wallet = owner.toLowerCase()
  const rows = await prisma.agentOrder.findMany({
    where: { OR: [{ buyer_address: wallet }, { seller_address: wallet }] },
    orderBy: { created_at: "desc" },
    take: 100,
  })
  return rows.map(orderView)
}

export async function getOrder(owner: string, id: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  const wallet = owner.toLowerCase()
  if (!row || (row.buyer_address !== wallet && row.seller_address !== wallet)) {
    throw new CommerceError(404, "order not found")
  }
  return orderView(row)
}

export async function deliverOrder(owner: string, id: string, input: Record<string, unknown>) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "order not found")
  if (row.seller_address !== owner.toLowerCase()) throw new CommerceError(403, "only the seller can deliver")
  if (!["accepted", "paid", "payment_pending"].includes(row.status)) {
    throw new CommerceError(409, `order is ${row.status}`)
  }
  const deliveryHash = text(input.deliveryHash, "deliveryHash")
  if (!HASH.test(deliveryHash)) throw new CommerceError(400, "deliveryHash must be a sha256 hash")
  const deliveryUri = typeof input.deliveryUri === "string" ? input.deliveryUri.slice(0, 1000) : null
  const deliverySignature = typeof input.deliverySignature === "string" ? input.deliverySignature.trim() : null
  if (deliverySignature) {
    const message = `Protocol Bank delivery\norder:${id}\ndeliveryHash:${deliveryHash}`
    const valid = await verifyMessage({
      address: row.seller_address as `0x${string}`,
      message,
      signature: deliverySignature as `0x${string}`,
    }).catch(() => false)
    if (!valid) throw new CommerceError(400, "deliverySignature does not match the seller")
  }
  const updated = await prisma.agentOrder.update({
    where: { id },
    data: {
      status: row.status === "payment_pending" ? "payment_pending" : "delivered",
      delivery_hash: deliveryHash,
      delivery_uri: deliveryUri,
      delivery_signature: deliverySignature,
      delivered_at: new Date(),
    },
  })
  const view = orderView(updated)
  notify([updated.buyer_address, updated.seller_address], "commerce.order_delivered", view)
  return view
}

export async function completeOrder(owner: string, id: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "order not found")
  if (row.buyer_address !== owner.toLowerCase()) throw new CommerceError(403, "only the buyer can complete")
  if (row.status === "completed") return orderView(row)
  if (!row.delivered_at) throw new CommerceError(409, "order has no delivery proof")
  if (!row.payment_id) throw new CommerceError(409, "order has no confirmed payment")
  if (!["delivered", "paid"].includes(row.status)) throw new CommerceError(409, `order is ${row.status}`)
  const updated = await prisma.agentOrder.update({
    where: { id },
    data: { status: "completed", completed_at: new Date() },
  })
  const view = orderView(updated)
  notify([updated.buyer_address, updated.seller_address], "commerce.order_completed", view)
  return view
}

export async function disputeOrder(owner: string, id: string, reason: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "order not found")
  const wallet = owner.toLowerCase()
  if (row.buyer_address !== wallet && row.seller_address !== wallet) {
    throw new CommerceError(404, "order not found")
  }
  if (!["accepted", "delivered", "paid"].includes(row.status)) {
    throw new CommerceError(409, `order is ${row.status}`)
  }
  const updated = await prisma.agentOrder.update({
    where: { id },
    data: { status: "disputed", dispute_reason: text(reason, "reason", 1000) },
  })
  const view = orderView(updated)
  notify([updated.buyer_address, updated.seller_address], "commerce.order_disputed", view)
  return view
}

export async function refundOrder(owner: string, id: string, txHash: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "order not found")
  if (row.seller_address !== owner.toLowerCase()) throw new CommerceError(403, "only the seller can refund")
  if (row.status !== "paid") throw new CommerceError(409, `order is ${row.status}`)
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new CommerceError(400, "txHash must be a transaction hash")
  const updated = await prisma.agentOrder.update({
    where: { id },
    data: { status: "refunded", refund_tx_hash: txHash },
  })
  const view = orderView(updated)
  notify([updated.buyer_address, updated.seller_address], "commerce.order_refunded", view)
  return view
}

export async function cancelOrder(owner: string, id: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id } })
  if (!row) throw new CommerceError(404, "order not found")
  const wallet = owner.toLowerCase()
  if (row.buyer_address !== wallet && row.seller_address !== wallet) {
    throw new CommerceError(404, "order not found")
  }
  if (row.status !== "accepted") throw new CommerceError(409, `order is ${row.status}`)
  const updated = await prisma.agentOrder.update({ where: { id }, data: { status: "cancelled" } })
  const view = orderView(updated)
  notify([updated.buyer_address, updated.seller_address], "commerce.order_cancelled", view)
  return view
}

export async function reserveOrderPayment(orderId: string, paymentId: string): Promise<boolean> {
  const result = await prisma.agentOrder.updateMany({
    where: {
      id: orderId,
      payment_id: null,
      status: { in: ["accepted", "delivered"] },
    },
    data: { payment_id: paymentId, status: "payment_pending" },
  })
  return result.count === 1
}

export async function releaseOrderPayment(orderId: string, paymentId: string): Promise<boolean> {
  const order = await prisma.agentOrder.findUnique({ where: { id: orderId } })
  if (!order || order.payment_id !== paymentId || order.status !== "payment_pending") return false
  const result = await prisma.agentOrder.updateMany({
    where: { id: orderId, payment_id: paymentId, status: "payment_pending" },
    data: {
      payment_id: null,
      status: order.delivered_at ? "delivered" : "accepted",
    },
  })
  return result.count === 1
}

export async function markOrderPaid(orderId: string, paymentId: string): Promise<boolean> {
  const result = await prisma.agentOrder.updateMany({
    where: { id: orderId, payment_id: paymentId, status: "payment_pending" },
    data: { status: "paid", paid_at: new Date() },
  })
  if (result.count !== 1) return false
  const order = await prisma.agentOrder.findUnique({ where: { id: orderId } })
  if (order) notify([order.buyer_address, order.seller_address], "commerce.order_paid", orderView(order))
  return true
}

export async function getPaymentOrder(owner: string, orderId: string) {
  const row = await prisma.agentOrder.findUnique({ where: { id: orderId } })
  if (!row) throw new CommerceError(404, "order not found")
  const wallet = owner.toLowerCase()
  if (row.buyer_address !== wallet) throw new CommerceError(403, "only the buyer can pay this order")
  if (!["accepted", "delivered", "payment_pending"].includes(row.status)) {
    throw new CommerceError(409, `order is ${row.status}`)
  }
  return row
}

export async function getReputation(addressValue: string) {
  if (!EVM_ADDRESS.test(addressValue)) throw new CommerceError(400, "address must be an EVM address")
  const seller = addressValue.toLowerCase()
  const [completed, disputed, refunded, delivered, paid, total] = await Promise.all([
    prisma.agentOrder.count({ where: { seller_address: seller, status: "completed" } }),
    prisma.agentOrder.count({ where: { seller_address: seller, status: "disputed" } }),
    prisma.agentOrder.count({ where: { seller_address: seller, status: "refunded" } }),
    prisma.agentOrder.count({ where: { seller_address: seller, status: "delivered" } }),
    prisma.agentOrder.count({ where: { seller_address: seller, status: "paid" } }),
    prisma.agentOrder.count({ where: { seller_address: seller } }),
  ])
  const volume = await prisma.agentOrder.aggregate({
    where: { seller_address: seller, status: { in: ["paid", "completed"] } },
    _sum: { amount_usd: true },
  })
  return {
    address: seller,
    completed,
    disputed,
    refunded,
    delivered,
    paid,
    total,
    volumeUsd: Number((volume._sum.amount_usd ?? 0).toFixed(6)),
    completionRate: total > 0 ? Number((completed / total).toFixed(4)) : null,
  }
}
