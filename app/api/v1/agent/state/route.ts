import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { listRecentAgentPayments } from "@/lib/agent/payment-store"
import { resolveAgentForWallet } from "@/lib/trading/agent"
import { loadAgentKeyRecord } from "@/lib/trading/keys"
import { getAgentWallet, toPublicWallet } from "@/lib/agent/wallet"

/**
 * GET /api/v1/agent/state — the account behind this API key: mode, equity, open
 * positions, activity and the effective risk config, plus what the key's policy
 * still allows today.
 */
export const dynamic = "force-dynamic"

async function agentWalletState(walletAddress: string) {
  const wallet = walletAddress.toLowerCase()
  const local = loadAgentKeyRecord(wallet)
  let row: { agent_address: string | null; agent_approved: boolean | null; agent_approved_at: Date | null; status: string | null } | null = null

  try {
    const { prisma } = await import("@/lib/prisma")
    row = await prisma.tradingAccount.findUnique({
      where: { wallet_address: wallet },
      select: { agent_address: true, agent_approved: true, agent_approved_at: true, status: true },
    })
  } catch {
    row = null
  }

  const approvedAt = row?.agent_approved_at
    ? row.agent_approved_at.toISOString()
    : local?.approvedAt ?? null

  return {
    address: row?.agent_address ?? local?.agentAddress ?? null,
    approved: row?.agent_approved ?? local?.approved ?? false,
    approvedAt,
    mode: row?.status ?? (local?.approved ? "live" : "paper"),
    tradingOnly: true,
    canWithdraw: false,
  }
}

async function handler(request: AgentRequest) {
  const policy = request.agentPolicy!
  const agent = await resolveAgentForWallet(request.ownerAddress as string)
  const payments = await listRecentAgentPayments(request.ownerAddress as string, 10)
  const custodialWallet = request.agentId && process.env.NEXT_PUBLIC_AGENT_WALLET_LIVE === "true"
    ? toPublicWallet(await getAgentWallet(request.agentId))
    : null
  return NextResponse.json({
    ok: true,
    ...agent.toOverview(),
    payments,
    agentWallet: await agentWalletState(request.ownerAddress as string),
    custodialWallet,
    policy: {
      allowedOps: policy.allowedOps,
      maxNotionalUsd: policy.maxNotionalUsd,
      dailyCapUsd: policy.dailyCapUsd,
      allowedCoins: policy.allowedCoins,
      spentTodayUsd: Number((request.spentTodayUsd ?? 0).toFixed(2)),
    },
  })
}

export const GET = withAgentAuth(handler, "read")
