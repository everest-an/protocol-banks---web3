import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import {
  approveAgentTypedData,
  approveAgentDigest,
  recoverSigner,
  submitApproveAgent,
} from "@/lib/trading/exchange"
import {
  generateAgentKey,
  loadAgentKeyRecord,
  markApproved,
  revokeAgentKey,
  hasKeySecret,
} from "@/lib/trading/keys"

/**
 * POST /api/trading/live/agent-wallet
 *
 * LIVE mode: agent wallet lifecycle for the authenticated user.
 *
 *   { "action": "status" }   → current agent wallet state
 *   { "action": "generate" } → create agent keypair, return EIP-712 typed
 *                              data for the user to sign in their wallet
 *   { "action": "approve", "agentAddress", "agentName", "nonce", "signature" }
 *                            → verify the user's signature locally, submit
 *                              approveAgent to Hyperliquid, mark approved
 *   { "action": "revoke" }   → delete local key material (user should also
 *                              revoke on Hyperliquid)
 */
export const POST = withAuth(async (req, address) => {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 })
  }

  switch (body.action) {
    case "status": {
      const record = loadAgentKeyRecord(address)
      const { prisma } = await import("@/lib/prisma")
      const row = await prisma.tradingAccount.findUnique({
        where: { wallet_address: address.toLowerCase() },
        select: { public_track_record: true },
      })
      return NextResponse.json({
        live: {
          available: true,
          keySecretConfigured: hasKeySecret(),
          agentAddress: record?.agentAddress ?? null,
          approved: record?.approved ?? false,
          approvedAt: record?.approvedAt ?? null,
          createdAt: record?.createdAt ?? null,
          publicTrackRecord: row?.public_track_record ?? false,
        },
      })
    }

    case "set-public-track-record": {
      const isPublic = body.public === true
      const { prisma } = await import("@/lib/prisma")
      await prisma.tradingAccount.upsert({
        where: { wallet_address: address.toLowerCase() },
        create: { wallet_address: address.toLowerCase(), public_track_record: isPublic },
        update: { public_track_record: isPublic },
      })
      return NextResponse.json({ ok: true, public: isPublic })
    }

    case "generate": {
      if (!hasKeySecret()) {
        return NextResponse.json(
          { error: "Live mode requires TRADING_KEY_SECRET (64 hex chars) to be configured on the server" },
          { status: 503 },
        )
      }
      const existing = loadAgentKeyRecord(address)
      if (existing) {
        return NextResponse.json(
          { error: "Agent wallet already exists for this account" },
          { status: 409 },
        )
      }
      const record = generateAgentKey(address, "Protocol Bank AI")
      const nonce = Date.now()
      const typedData = approveAgentTypedData({
        agentAddress: record.agentAddress,
        agentName: record.name,
        nonce,
      })
      return NextResponse.json({
        agentAddress: record.agentAddress,
        agentName: record.name,
        nonce,
        typedData,
      })
    }

    case "approve": {
      const { agentAddress, agentName, nonce, signature } = body
      if (
        typeof agentAddress !== "string" ||
        typeof agentName !== "string" ||
        typeof nonce !== "number" ||
        !signature ||
        typeof signature.r !== "string" ||
        typeof signature.s !== "string" ||
        typeof signature.v !== "number"
      ) {
        return NextResponse.json(
          { error: "approve requires agentAddress, agentName, nonce and signature {r,s,v}" },
          { status: 400 },
        )
      }

      const record = loadAgentKeyRecord(address)
      if (!record) {
        return NextResponse.json({ error: "No agent wallet for this account — generate first" }, { status: 404 })
      }
      if (record.agentAddress.toLowerCase() !== agentAddress.toLowerCase()) {
        return NextResponse.json({ error: "agentAddress does not match this account's agent wallet" }, { status: 400 })
      }

      // Local verification: the signature must recover to the authenticated user.
      const typedData = approveAgentTypedData({ agentAddress, agentName, nonce })
      const digest = approveAgentDigest(typedData)
      const signer = recoverSigner(digest, signature)
      if (signer.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: "Signature does not match the authenticated wallet" }, { status: 403 })
      }

      try {
        const result = await submitApproveAgent({
          userAddress: address,
          agentAddress,
          agentName,
          nonce,
          signature,
        })
        // Hyperliquid answers application-level failures with HTTP 200 and a
        // { status: "err", response } body — never mark the agent approved on
        // those, or the cockpit would claim live trading is armed when the
        // venue refused the action (first seen as "Must deposit before
        // performing actions").
        const venue = result as { status?: string; response?: unknown } | null
        if (venue?.status === "err") {
          const detail =
            typeof venue.response === "string" ? venue.response : JSON.stringify(venue.response ?? venue)
          return NextResponse.json(
            { ok: false, error: `Hyperliquid rejected the approval: ${detail}`, result },
            { status: 502 },
          )
        }
        markApproved(address)
        return NextResponse.json({ ok: true, result })
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Hyperliquid submission failed" },
          { status: 502 },
        )
      }
    }

    case "revoke": {
      revokeAgentKey(address)
      return NextResponse.json({ ok: true, note: "Local key material removed. Revoke the agent on Hyperliquid to fully cut off access." })
    }

    default:
      return NextResponse.json(
        { error: "Unknown action. Use one of: status, generate, approve, revoke, set-public-track-record" },
        { status: 400 },
      )
  }
})
