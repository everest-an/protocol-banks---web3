import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"
import { hasKeySecret, sealSecret } from "@/lib/trading/keys"

/**
 * BYO-LLM key management for the trading advisor.
 *
 *   GET    -> current configuration + the platform default
 *   PUT    -> verify the key against the provider, then store it sealed
 *             (AES-256-GCM, same scheme as the agent key). Body:
 *             { apiKey, provider?: "openrouter" | "deepseek", model? }
 *   DELETE -> remove the stored key (the platform default keeps working)
 */

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"

async function providerRejects(provider: string, apiKey: string): Promise<string | null> {
  const url = provider === "deepseek" ? `${DEEPSEEK_BASE}/models` : `${OPENROUTER_BASE}/key`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return null
    const body = await res.text().catch(() => "")
    return `Provider rejected the key (HTTP ${res.status})${body ? `: ${body.slice(0, 160)}` : ""}`
  } catch (error) {
    return `Could not reach the provider to verify the key: ${error instanceof Error ? error.message : "network error"}`
  }
}

export const GET = withAuth(
  async (_req: NextRequest, address: string) => {
    const row = await prisma.tradingAccount.findUnique({
      where: { wallet_address: address.toLowerCase() },
      select: { llm_key_encrypted: true, llm_provider: true, llm_model: true },
    })
    return NextResponse.json({
      configured: Boolean(row?.llm_key_encrypted),
      provider: row?.llm_provider ?? null,
      model: row?.llm_model ?? null,
      platformDefault: {
        provider: "openrouter",
        model: process.env.LLM_DEFAULT_MODEL || "deepseek/deepseek-v4-flash",
        available: Boolean(process.env.OPENROUTER_API_KEY),
      },
      encryptionAvailable: hasKeySecret(),
    })
  },
  { component: "trading-llm-key" },
)

export const PUT = withAuth(
  async (req: NextRequest, address: string) => {
    if (!hasKeySecret()) {
      return NextResponse.json(
        { error: "Key storage is not configured on the server (TRADING_KEY_SECRET missing)" },
        { status: 503 },
      )
    }

    const body = await req.json().catch(() => null)
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""
    const provider = body?.provider === "deepseek" ? "deepseek" : "openrouter"
    const model =
      typeof body?.model === "string" && body.model.trim() ? body.model.trim().slice(0, 120) : null

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json({ error: "A valid API key is required" }, { status: 400 })
    }

    const rejection = await providerRejects(provider, apiKey)
    if (rejection) {
      return NextResponse.json({ error: rejection }, { status: 400 })
    }

    const blob = sealSecret(apiKey)
    const wallet = address.toLowerCase()
    await prisma.tradingAccount.upsert({
      where: { wallet_address: wallet },
      create: {
        wallet_address: wallet,
        llm_key_encrypted: blob.data,
        llm_key_iv: blob.iv,
        llm_key_tag: blob.tag,
        llm_provider: provider,
        llm_model: model,
      },
      update: {
        llm_key_encrypted: blob.data,
        llm_key_iv: blob.iv,
        llm_key_tag: blob.tag,
        llm_provider: provider,
        llm_model: model,
      },
    })

    return NextResponse.json({ ok: true, provider, model })
  },
  { component: "trading-llm-key" },
)

export const DELETE = withAuth(
  async (_req: NextRequest, address: string) => {
    await prisma.tradingAccount
      .update({
        where: { wallet_address: address.toLowerCase() },
        data: {
          llm_key_encrypted: null,
          llm_key_iv: null,
          llm_key_tag: null,
          llm_provider: null,
          llm_model: null,
        },
      })
      .catch(() => {
        // No row yet means nothing to clear.
      })
    return NextResponse.json({ ok: true })
  },
  { component: "trading-llm-key" },
)
