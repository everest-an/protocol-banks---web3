import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTrust3EasypayConfig, parseParams } from "@/lib/trust3-easypay/config"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

async function handle(request: NextRequest) {
  try {
    const body = request.method === "POST" ? await request.text() : ""
    const params = parseParams(request, body)
    const config = getTrust3EasypayConfig()

    if (params.act !== "order") {
      return NextResponse.json({ code: 0, msg: "unsupported action" }, { status: 200, headers: NO_STORE })
    }
    if (params.pid !== config.pid || !config.pkey || params.key !== config.pkey) {
      return NextResponse.json({ code: 0, msg: "invalid merchant key" }, { status: 200, headers: NO_STORE })
    }

    const orderNo = (params.out_trade_no || "").trim()
    if (!orderNo) {
      return NextResponse.json({ code: 0, msg: "missing out_trade_no" }, { status: 200, headers: NO_STORE })
    }

    const order = await prisma.acquiringOrder.findFirst({
      where: { order_no: orderNo, merchant_id: config.merchantId },
    })
    if (!order) {
      return NextResponse.json({ code: 0, msg: "order not found" }, { status: 200, headers: NO_STORE })
    }

    const metadata = (order.metadata || {}) as Record<string, unknown>
    const cnyAmount = String(metadata.cny_amount || order.amount.toFixed(2))
    const paid = order.status === "paid"

    return NextResponse.json(
      {
        code: 1,
        msg: "success",
        trade_status: paid ? "TRADE_SUCCESS" : "WAIT_BUYER_PAY",
        status: paid ? 1 : 0,
        money: cnyAmount,
        trade_no: order.tx_hash || order.order_no,
        out_trade_no: order.order_no,
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (error: any) {
    console.error("[Trust3 EasyPay] query failed:", error)
    return NextResponse.json({ code: 0, msg: error.message || "query failed" }, { status: 200, headers: NO_STORE })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
