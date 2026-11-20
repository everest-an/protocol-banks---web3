import { NextResponse } from "next/server"
import { checkVendorRules, isT3nConfigured } from "@/lib/t3n/vault"

export const dynamic = "force-dynamic"

let cache: { at: number; body: unknown } | null = null

export async function GET() {
  if (!isT3nConfigured()) {
    return NextResponse.json({ error: "T3N is not configured" }, { status: 503 })
  }
  if (cache && Date.now() - cache.at < 15_000) {
    return NextResponse.json(cache.body)
  }
  try {
    const result = await checkVendorRules({
      kyc_verified: true,
      id_not_expired: true,
      residency_in: ["HK", "SG", "GB"],
      account_open_min_months: 12,
    })
    const body = { ...result, demo: true }
    cache = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "T3N demo check failed" },
      { status: 502 },
    )
  }
}
