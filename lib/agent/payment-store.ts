/**
 * Durable state for agent payments.
 *
 * A payment row is created before the relayer submits, then advanced through
 * pending -> submitted -> confirmed/failed. The cron reconciler checks the
 * receipt and emits payment webhooks for terminal states.
 */
import { createPublicClient, http } from "viem"
import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia, type Chain } from "viem/chains"
import type { AgentPayment } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { EVM_NETWORKS } from "@/lib/networks"

const CHAIN_BY_ID: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
  56: bsc,
  11155111: sepolia,
}

export interface CreateAgentPaymentInput {
  ownerAddress: string
  fromAddress: string
  toAddress: string
  token: string
  chain: string
  chainId: number
  amountUsd: number
  amountUnits: string
  nonce: string
  memo?: string
  orderId?: string
}

export interface PaymentChange {
  payment: AgentPayment
  status: "confirmed" | "failed"
}

export function paymentView(payment: AgentPayment) {
  return {
    id: payment.id,
    txHash: payment.tx_hash,
    status: payment.status,
    from: payment.from_address,
    to: payment.to_address,
    amountUsd: payment.amount_usd,
    token: payment.token,
    chain: payment.chain,
    memo: payment.memo,
    orderId: payment.order_id ?? null,
    error: payment.error,
    createdAt: payment.created_at.toISOString(),
    confirmedAt: payment.confirmed_at?.toISOString() ?? null,
  }
}

export function paymentEventData(payment: AgentPayment) {
  return {
    payment_id: payment.id,
    from_address: payment.from_address,
    to_address: payment.to_address,
    amount: payment.amount_usd.toString(),
    token_symbol: payment.token,
    chain_id: payment.chain_id,
    tx_hash: payment.tx_hash ?? undefined,
    order_id: payment.order_id ?? undefined,
    status: payment.status,
    created_at: payment.created_at.toISOString(),
  }
}

export async function createAgentPayment(
  input: CreateAgentPaymentInput,
): Promise<{ payment: AgentPayment; created: boolean }> {
  const existing = await prisma.agentPayment.findUnique({ where: { nonce: input.nonce } })
  if (existing) return { payment: existing, created: false }

  try {
    const payment = await prisma.agentPayment.create({
      data: {
        owner_address: input.ownerAddress.toLowerCase(),
        from_address: input.fromAddress.toLowerCase(),
        to_address: input.toAddress.toLowerCase(),
        token: input.token,
        chain: input.chain,
        chain_id: input.chainId,
        amount_usd: input.amountUsd,
        amount_units: input.amountUnits,
        nonce: input.nonce,
        memo: input.memo,
        order_id: input.orderId,
        status: "pending",
      },
    })
    return { payment, created: true }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const again = await prisma.agentPayment.findUnique({ where: { nonce: input.nonce } })
      if (again) return { payment: again, created: false }
    }
    throw error
  }
}

export async function getAgentPaymentByNonce(nonce: string): Promise<AgentPayment | null> {
  return prisma.agentPayment.findUnique({ where: { nonce } })
}

export async function markAgentPaymentSubmitted(id: string, txHash: string): Promise<AgentPayment> {
  return prisma.agentPayment.update({
    where: { id },
    data: { tx_hash: txHash, status: "submitted", error: null },
  })
}

export async function markAgentPaymentConfirmed(id: string): Promise<AgentPayment> {
  return prisma.agentPayment.update({
    where: { id },
    data: { status: "confirmed", error: null, confirmed_at: new Date() },
  })
}

export async function markAgentPaymentFailed(id: string, error: string): Promise<AgentPayment> {
  return prisma.agentPayment.update({
    where: { id },
    data: { status: "failed", error: error.slice(0, 300) },
  })
}

export async function listRecentAgentPayments(ownerAddress: string, limit = 10) {
  const rows = await prisma.agentPayment.findMany({
    where: { owner_address: ownerAddress.toLowerCase() },
    orderBy: { created_at: "desc" },
    take: limit,
  })
  return rows.map(paymentView)
}

function rpcFor(chainId: number): string | undefined {
  return Object.values(EVM_NETWORKS).find((network) => network.chainId === chainId)?.rpcUrl
}

export async function getTransferStatus(
  chainId: number,
  txHash: string,
): Promise<"confirmed" | "failed" | null> {
  const chain = CHAIN_BY_ID[chainId]
  if (!chain) return null
  const rpc = rpcFor(chainId)
  const client = createPublicClient({ chain, transport: rpc ? http(rpc) : http() })
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    return receipt.status === "success" ? "confirmed" : "failed"
  } catch {
    // Not mined yet, or the RPC cannot see it. The next cron run retries.
    return null
  }
}

/**
 * Reconcile pending/submitted payments older than a minute. Returns only the
 * rows that changed terminal state, so the cron can emit webhooks.
 */
export async function reconcileAgentPayments(limit = 25): Promise<PaymentChange[]> {
  const olderThan = new Date(Date.now() - 60_000)
  const rows = await prisma.agentPayment.findMany({
    where: { status: { in: ["pending", "submitted"] }, created_at: { lt: olderThan } },
    orderBy: { created_at: "asc" },
    take: limit,
  })

  const changes: PaymentChange[] = []
  for (const row of rows) {
    if (!row.tx_hash) {
      const ageMs = Date.now() - row.created_at.getTime()
      if (ageMs > 15 * 60_000) {
        const failed = await markAgentPaymentFailed(row.id, "submission timed out")
        changes.push({ payment: failed, status: "failed" })
      }
      continue
    }

    const status = await getTransferStatus(row.chain_id, row.tx_hash)
    if (!status) continue

    const payment = status === "confirmed"
      ? await markAgentPaymentConfirmed(row.id)
      : await markAgentPaymentFailed(row.id, "transaction reverted")
    changes.push({ payment, status })
  }

  return changes
}
