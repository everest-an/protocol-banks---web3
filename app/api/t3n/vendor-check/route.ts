import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { checkVendorRules, isT3nConfigured } from "@/lib/t3n/vault"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => {
  return NextResponse.json({
    configured: isT3nConfigured(),
    network: "testnet",
    mode: "agent-check-only",
  })
})

export const POST = withAuth(async (request) => {
  if (!isT3nConfigured()) {
    return NextResponse.json(
      {
        error:
          "Terminal 3 is not configured. Set T3N_AGENT_API_KEY, T3N_CONTRACT_ID and T3N_CUSTOMER_DID.",
        configured: false,
      },
      { status: 503 },
    )
  }

  let body: { rules?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rules = body.rules ?? {}
  try {
    const result = await checkVendorRules({
      kyc_verified: rules.kyc_verified === true,
      residency_in: Array.isArray(rules.residency_in)
        ? rules.residency_in.filter((value): value is string => typeof value === "string")
        : undefined,
      min_age: typeof rules.min_age === "number" ? rules.min_age : undefined,
      id_not_expired: typeof rules.id_not_expired === "boolean" ? rules.id_not_expired : undefined,
      account_open_min_months:
        typeof rules.account_open_min_months === "number" ? rules.account_open_min_months : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terminal 3 check failed" },
      { status: 502 },
    )
  }
})
