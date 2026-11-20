import { NextResponse } from "next/server"
import { getT3nConfig, isT3nConfigured } from "@/lib/t3n/vault"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = getT3nConfig()
  return NextResponse.json(
    {
      configured: isT3nConfigured(),
      network: "testnet",
      contract: config.contractId ? "configured" : "missing",
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
