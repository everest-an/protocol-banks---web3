import { NextResponse } from "next/server"
import type { TypedDataDomain, TypedDataField } from "ethers"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import {
  AgentWalletConfigError,
  hasAgentWalletSecret,
  signWithAgentWallet,
  type AgentWalletSignRequest,
} from "@/lib/agent/wallet"

export const dynamic = "force-dynamic"

function errorResponse(error: unknown) {
  if (error instanceof AgentWalletConfigError) {
    return NextResponse.json(
      { error: "Agent wallet custody is not configured on this deployment." },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : "Signing failed"
  const status = message.includes("not found")
    ? 404
    : message.includes("revoked")
      ? 409
      : 400
  return NextResponse.json({ error: message }, { status })
}

async function handler(request: AgentRequest) {
  const agentId = request.agentId
  if (!agentId) {
    return NextResponse.json(
      { error: "This endpoint requires a dashboard agent key (agent_...)." },
      { status: 409 },
    )
  }

  if (!hasAgentWalletSecret()) {
    return NextResponse.json(
      { error: "AGENT_WALLET_SECRET is not configured (64 hex chars)." },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  let signRequest: AgentWalletSignRequest
  if (body.kind === "message") {
    signRequest = { kind: "message", message: body.message as string }
  } else if (body.kind === "typedData") {
    if (
      !body.domain ||
      typeof body.domain !== "object" ||
      Array.isArray(body.domain) ||
      !body.types ||
      typeof body.types !== "object" ||
      Array.isArray(body.types) ||
      !body.value ||
      typeof body.value !== "object" ||
      Array.isArray(body.value)
    ) {
      return NextResponse.json(
        { error: "typedData requires domain, types and value objects" },
        { status: 400 },
      )
    }
    if (!request.agentPolicy?.allowedOps.includes("pay")) {
      return NextResponse.json(
        { error: "this key may not sign payment typed data (missing pay operation)" },
        { status: 403 },
      )
    }
    signRequest = {
      kind: "typedData",
      domain: body.domain as TypedDataDomain,
      types: body.types as Record<string, TypedDataField[]>,
      value: body.value as Record<string, unknown>,
      primaryType: typeof body.primaryType === "string" ? body.primaryType : undefined,
    }
  } else {
    return NextResponse.json(
      { error: 'kind must be "message" or "typedData"' },
      { status: 400 },
    )
  }

  try {
    const result = await signWithAgentWallet(agentId, signRequest)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}

export const POST = withAgentAuth(handler, "read")
