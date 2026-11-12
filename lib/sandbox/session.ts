import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { apiKeyService } from "@/lib/services/api-key-service"
import { createQuote, createService } from "@/lib/agent/commerce"

const SESSION_MS = 24 * 60 * 60 * 1000
const MAX_SESSIONS_PER_IP = 3

export interface SandboxSession {
  sandbox: true
  source: string
  expiresAt: string
  serviceId: string
  quoteId: string
  buyer: { address: string; key: string }
  seller: { address: string; key: string }
}

export type SandboxSessionResult =
  | { ok: true; session: SandboxSession }
  | { ok: false; status: number; error: string }

export function requestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return headers.get("x-real-ip")?.trim() || forwarded || "unknown"
}

function hashIp(ip: string): string {
  const salt = process.env.SANDBOX_IP_SALT || "protocol-banks-sandbox"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16)
}

function wallet(seed: string): string {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`
}

export async function createSandboxSession(ip: string, source = "direct"): Promise<SandboxSessionResult> {
  const ipHash = hashIp(ip)
  const channel = /^[a-z0-9_-]{1,32}$/i.test(source) ? source.toLowerCase() : "direct"
  const since = new Date(Date.now() - SESSION_MS)

  const used = await prisma.apiKey.count({
    where: {
      AND: [
        { name: { startsWith: `sandbox:${ipHash}:` } },
        { name: { endsWith: ":seller" } },
        { created_at: { gte: since } },
      ],
    },
  })

  if (used >= MAX_SESSIONS_PER_IP) {
    return {
      ok: false,
      status: 429,
      error: `This network has already created ${MAX_SESSIONS_PER_IP} sandbox sessions in the last 24 hours.`,
    }
  }

  const sessionId = randomBytes(6).toString("hex")
  const seller = wallet(`seller:${sessionId}`)
  const buyer = wallet(`buyer:${sessionId}`)
  const expiresAt = new Date(Date.now() + SESSION_MS)
  const deliveryDue = new Date(Date.now() + SESSION_MS)

  let serviceId: string | null = null
  let quoteId: string | null = null
  const keyIds: string[] = []

  try {
    const service = await createService(seller, undefined, {
      name: "Sandbox: 3-bullet research brief",
      description: "A disposable service used by the public sandbox. Not a real listing.",
      category: "research",
      priceUsd: 1,
      token: "USDC",
      chain: "base-sepolia",
      terms: { sandbox: true, note: "Demo only. Never send funds." },
    })
    serviceId = service.id

    const quote = await createQuote(seller, {
      serviceId: service.id,
      buyer,
      amountUsd: 1,
      scope: "Deliver a 3-bullet summary of https://example.com plus the source hash.",
      deliveryDue: deliveryDue.toISOString(),
      expiresInSeconds: 86400,
      terms: { sandbox: true, deliverable: "3 bullets + sha256 of the source" },
    })
    quoteId = quote.id

    await prisma.agentService.update({ where: { id: service.id }, data: { active: false } })

    const policy = {
      allowedOps: ["read", "pay"],
      maxNotionalUsd: 50,
      dailyCapUsd: 50,
      allowedCoins: ["USDC"],
    }

    const sellerKey = await apiKeyService.create({
      name: `sandbox:${ipHash}:${channel}:${sessionId}:seller`,
      owner_address: seller,
      permissions: ["read", "write"],
      policy,
      rate_limit_per_minute: 60,
      rate_limit_per_day: 2_000,
      expires_at: expiresAt.toISOString(),
    })
    keyIds.push(sellerKey.key.id)

    const buyerKey = await apiKeyService.create({
      name: `sandbox:${ipHash}:${channel}:${sessionId}:buyer`,
      owner_address: buyer,
      permissions: ["read", "write"],
      policy,
      rate_limit_per_minute: 60,
      rate_limit_per_day: 2_000,
      expires_at: expiresAt.toISOString(),
    })
    keyIds.push(buyerKey.key.id)

    return {
      ok: true,
      session: {
        sandbox: true,
        source: channel,
        expiresAt: expiresAt.toISOString(),
        serviceId: service.id,
        quoteId: quote.id,
        buyer: { address: buyer, key: buyerKey.secret },
        seller: { address: seller, key: sellerKey.secret },
      },
    }
  } catch (error) {
    await Promise.allSettled(keyIds.map((id) => prisma.apiKey.delete({ where: { id } })))
    if (quoteId) await prisma.agentQuote.delete({ where: { id: quoteId } }).catch(() => undefined)
    if (serviceId) await prisma.agentService.delete({ where: { id: serviceId } }).catch(() => undefined)
    throw error
  }
}
