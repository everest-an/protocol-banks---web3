import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { prisma } from "@/lib/prisma"
import { generateInvoiceId, signInvoice } from "@/lib/invoice/signing"

/**
 * POST /api/v1/agent/invoice — an agent asks to be paid. This creates a pending
 * invoice for the account; it moves no money and is not metered. The amount is
 * checked against the key's policy because an invoice is a payment request.
 */
export const dynamic = "force-dynamic"

const EVM = /^0x[a-fA-F0-9]{40}$/
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

async function handler(request: AgentRequest) {
  const wallet = request.ownerAddress as string
  const policy = request.agentPolicy!

  let body: {
    to?: unknown
    amount?: unknown
    token?: unknown
    chain?: unknown
    description?: unknown
    expiresInHours?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const to = typeof body.to === "string" ? body.to.trim() : ""
  const amount = typeof body.amount === "number" ? body.amount : Number.NaN
  if (!EVM.test(to) && !TRON.test(to) && !SOLANA.test(to)) {
    return NextResponse.json({ error: "to must be an EVM (0x…), TRON (T…) or Solana address" }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
  }

  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim().toUpperCase() : "USDC"
  const chain =
    typeof body.chain === "string" && body.chain.trim()
      ? body.chain.trim()
      : TRON.test(to)
        ? "TRON"
        : "Ethereum"
  const description = typeof body.description === "string" ? body.description.slice(0, 200) : undefined
  const hours = typeof body.expiresInHours === "number" ? Math.min(720, Math.max(1, body.expiresInHours)) : 24

  const allowed = evaluatePolicy(policy, { op: "pay", notionalUsd: amount, coin: token }, request.spentTodayUsd ?? 0)
  if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })

  const invoiceId = generateInvoiceId()
  const expiresAt = new Date(Date.now() + hours * 3_600_000)
  const signature = signInvoice(`${invoiceId}|${to}|${amount}|${token}`)

  const invoice = await prisma.invoice.create({
    data: {
      invoice_id: invoiceId,
      recipient_address: to,
      amount,
      token,
      chain,
      description,
      merchant_name: `agent:${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
      status: "pending",
      signature,
      expires_at: expiresAt,
      metadata: { createdVia: "agent-api", op: "invoice" },
    },
  })

  return NextResponse.json({
    ok: true,
    invoice: {
      invoiceId: invoice.invoice_id,
      status: invoice.status,
      to,
      amount,
      token,
      chain,
      description,
      expiresAt: expiresAt.toISOString(),
      signed: signature !== null,
    },
    note: "moves no money; the payer settles it against this invoice id",
  })
}

export const POST = withAgentAuth(handler, "pay")
