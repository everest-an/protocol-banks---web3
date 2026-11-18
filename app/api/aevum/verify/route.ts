import { NextResponse } from "next/server"
import { AEVUM } from "@/lib/aevum/config"

export const dynamic = "force-dynamic"

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

function topicAddress(topic: string | undefined): string | null {
  if (!topic || topic.length < 42) return null
  return `0x${topic.slice(-40)}`.toLowerCase()
}

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(AEVUM.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Aevum RPC HTTP ${response.status}`)
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message || "Aevum RPC error")
  return body.result
}

export async function POST(request: Request) {
  let body: { txHash?: string; recipient?: string; amount?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const txHash = body.txHash?.trim()
  const recipient = body.recipient?.trim().toLowerCase()
  const amount = Number(body.amount)
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "A valid Aevum transaction hash is required" }, { status: 400 })
  }
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    return NextResponse.json({ error: "A valid recipient is required" }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A valid tUSD8 amount is required" }, { status: 400 })
  }

  try {
    const receipt = (await rpc("eth_getTransactionReceipt", [txHash])) as {
      status?: string
      from?: string
      to?: string
      blockNumber?: string
      logs?: Array<{ address?: string; topics?: string[]; data?: string }>
    } | null

    if (!receipt) {
      return NextResponse.json({ status: "pending", txHash }, { status: 202 })
    }
    if (receipt.status !== "0x1") {
      return NextResponse.json({ error: "Transaction reverted on Aevum", txHash }, { status: 422 })
    }

    const expected = BigInt(Math.round(amount * 10 ** AEVUM.token.decimals))
    const transfer = (receipt.logs ?? []).find((log) => {
      if (log.address?.toLowerCase() !== AEVUM.token.address.toLowerCase()) return false
      if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) return false
      const to = topicAddress(log.topics[2])
      return to === recipient && BigInt(log.data && log.data !== "0x" ? log.data : "0x0") === expected
    })

    if (!transfer) {
      return NextResponse.json(
        { error: "No matching tUSD8 transfer found in this transaction", txHash },
        { status: 422 },
      )
    }

    return NextResponse.json({
      status: "confirmed",
      txHash,
      from: topicAddress(transfer.topics?.[1]),
      to: recipient,
      amount,
      symbol: AEVUM.token.symbol,
      blockNumber: receipt.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : null,
      explorerUrl: `${AEVUM.explorer}/tx/${txHash}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aevum verification failed" },
      { status: 502 },
    )
  }
}
