import { NextResponse } from "next/server"
import spec from "./agent.openapi.json"

/**
 * The public, machine-readable contract for /api/v1/agent/*.
 *
 * Source of truth: docs/api/agent.openapi.json. `pnpm build` runs
 * scripts/sync-agent-contract.mjs first so the committed copy cannot drift;
 * scripts/verify-openapi.mjs fails when it does.
 */
export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
