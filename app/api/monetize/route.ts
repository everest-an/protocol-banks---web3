import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

// GET: Fetch config and API keys for authenticated wallet
export const GET = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const config = await prisma.monetizeConfig.findUnique({
      where: { owner_address: walletAddress.toLowerCase() },
    })

    const apiKeys = await prisma.monetizeApiKey.findMany({
      where: { owner_address: walletAddress.toLowerCase() },
      orderBy: { created_at: "desc" },
    })

    // Map keys to include backward-compat fields
    const mappedKeys = apiKeys.map((k) => ({
      ...k,
      tier: k.tier_id,
      calls_used: k.usage_count,
      calls_limit: k.rate_limit,
    }))

    return NextResponse.json({ config, apiKeys: mappedKeys })
  } catch (err: any) {
    console.error("[API] monetize GET error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch monetize data" }, { status: 500 })
  }
}, { component: 'monetize' })

// POST: Create a new API key
export const POST = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()

    const apiKey = await prisma.monetizeApiKey.create({
      data: {
        owner_address: walletAddress.toLowerCase(),
        key: body.key,
        name: body.name,
        tier_id: body.tier ?? body.tier_id,
        status: body.status || "active",
        usage_count: body.calls_used ?? body.usage_count ?? 0,
        rate_limit: body.calls_limit ?? body.rate_limit ?? 100,
      },
    })

    // Return with backward-compat fields
    return NextResponse.json({
      ...apiKey,
      tier: apiKey.tier_id,
      calls_used: apiKey.usage_count,
      calls_limit: apiKey.rate_limit,
    })
  } catch (err: any) {
    console.error("[API] monetize POST error:", err)
    return NextResponse.json({ error: err.message || "Failed to create API key" }, { status: 500 })
  }
}, { component: 'monetize' })

// PUT: Upsert monetize config
export const PUT = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()
    const ownerAddress = walletAddress.toLowerCase()

    const config = await prisma.monetizeConfig.upsert({
      where: { owner_address: ownerAddress },
      create: {
        owner_address: ownerAddress,
        enabled: body.enabled ?? false,
        tiers: body.tiers ?? [],
        default_tier: body.defaultTier ?? body.default_tier ?? null,
        webhook_url: body.webhookUrl ?? body.webhook_url ?? null,
        require_auth: body.rateLimitEnabled ?? body.require_auth ?? true,
      },
      update: {
        enabled: body.enabled,
        tiers: body.tiers,
        default_tier: body.defaultTier ?? body.default_tier,
        webhook_url: body.webhookUrl ?? body.webhook_url,
        require_auth: body.rateLimitEnabled ?? body.require_auth,
        updated_at: new Date(),
      },
    })

    return NextResponse.json(config)
  } catch (err: any) {
    console.error("[API] monetize PUT error:", err)
    return NextResponse.json({ error: err.message || "Failed to update config" }, { status: 500 })
  }
}, { component: 'monetize' })

// PATCH: Revoke an API key
export const PATCH = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()
    const { keyId } = body

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 })
    }

    const updated = await prisma.monetizeApiKey.update({
      where: { id: keyId },
      data: { status: "revoked" },
    })

    return NextResponse.json({
      ...updated,
      tier: updated.tier_id,
      calls_used: updated.usage_count,
      calls_limit: updated.rate_limit,
    })
  } catch (err: any) {
    console.error("[API] monetize PATCH error:", err)
    return NextResponse.json({ error: err.message || "Failed to revoke API key" }, { status: 500 })
  }
}, { component: 'monetize' })
