// rls:system — public checkout verification, identity is the on-chain transfer
import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { prisma } from "@/lib/prisma"
import { ERC20_ABI, RPC_URLS, TOKEN_ADDRESSES } from "@/lib/web3"
import { markAcquiringOrderPaid } from "@/lib/acquiring/settlement"

export const dynamic = "force-dynamic"

const CHAIN_BY_NAME: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  mainnet: 1,
  polygon: 137,
  matic: 137,
  base: 8453,
  arbitrum: 42161,
  arb: 42161,
  optimism: 10,
  op: 10,
  bsc: 56,
  bnb: 56,
  hashkey: 177,
  hsk: 177,
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const { orderNo } = await params
    const body = await request.json()
    const txHash = String(body.tx_hash || "").trim().toLowerCase()
    const chainName = String(body.chain || "base").toLowerCase()
    const chainId = CHAIN_BY_NAME[chainName]

    if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400, headers: NO_STORE_HEADERS })
    }
    if (!chainId) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const order = await prisma.acquiringOrder.findUnique({
      where: { order_no: orderNo },
      include: { merchant: { select: { wallet_address: true, status: true } } },
    })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: NO_STORE_HEADERS })
    }
    if (order.status === "paid") {
      return NextResponse.json({ success: true, order, already_paid: true }, { headers: NO_STORE_HEADERS })
    }
    if (order.status !== "pending") {
      return NextResponse.json({ error: `Order is ${order.status}` }, { status: 409, headers: NO_STORE_HEADERS })
    }
    if (!order.merchant.wallet_address) {
      return NextResponse.json({ error: "Merchant settlement address missing" }, { status: 409, headers: NO_STORE_HEADERS })
    }

    const tokenAddress = (TOKEN_ADDRESSES as Record<number, Record<string, string>>)[chainId]?.[order.token]
    const rpcUrl = RPC_URLS[chainId]
    if (!tokenAddress || !rpcUrl) {
      return NextResponse.json({ error: "Unsupported token or chain" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const reused = await prisma.acquiringOrder.findFirst({
      where: { tx_hash: txHash, status: "paid", NOT: { id: order.id } },
      select: { id: true },
    })
    if (reused) {
      return NextResponse.json({ error: "Transaction already used" }, { status: 409, headers: NO_STORE_HEADERS })
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json({ error: "Transaction not found or failed" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const latestBlock = await provider.getBlockNumber()
    if (receipt.blockNumber > latestBlock) {
      return NextResponse.json({ error: "Transaction not confirmed" }, { status: 409, headers: NO_STORE_HEADERS })
    }
    const block = await provider.getBlock(receipt.blockNumber)
    if (block && block.timestamp * 1000 < order.created_at.getTime() - 5 * 60 * 1000) {
      return NextResponse.json({ error: "Transaction predates this order" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const decimals = Number(await contract.decimals())
    const expected = ethers.parseUnits(String(order.amount), decimals)
    const recipient = order.merchant.wallet_address.toLowerCase()
    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)",
    ])

    let payer: string | null = null
    let matched = false

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data })
        if (parsed?.name !== "Transfer") continue
        const from = String(parsed.args[0])
        const to = String(parsed.args[1]).toLowerCase()
        const value = BigInt(parsed.args[2])
        if (to === recipient && value >= expected) {
          payer = from
          matched = true
          break
        }
      } catch {
        continue
      }
    }

    if (!matched) {
      return NextResponse.json({ error: "No matching USDC transfer found" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const settled = await markAcquiringOrderPaid({
      orderId: order.id,
      txHash,
      payerAddress: payer,
      paymentMethod: `crypto_transfer_${chainName}`,
    })

    return NextResponse.json(
      {
        success: true,
        order: settled.order,
        already_paid: !settled.wasPending,
        tx_hash: txHash,
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (error: any) {
    console.error("[API] Acquiring payment verification error:", error)
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
