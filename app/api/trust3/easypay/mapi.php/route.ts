import { type NextRequest, NextResponse } from "next/server"
import {
  getTrust3EasypayConfig,
  parseParams,
  verifyEasypaySign,
} from "@/lib/trust3-easypay/config"
import { createTrust3EasypayOrder } from "@/lib/trust3-easypay/order"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = parseParams(request, body)
    const config = getTrust3EasypayConfig()

    if (!config.pkey || !verifyEasypaySign(params, config.pkey)) {
      return NextResponse.json({ code: 0, msg: "invalid sign" }, { status: 200, headers: NO_STORE })
    }

    const order = await createTrust3EasypayOrder(request, params)

    return NextResponse.json(
      {
        code: 1,
        msg: "success",
        trade_no: order.orderNo,
        payurl: order.checkoutUrl,
        qrcode: "",
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (error: any) {
    console.error("[Trust3 EasyPay] create order failed:", error)
    return NextResponse.json(
      { code: 0, msg: error.message || "create order failed" },
      { status: 200, headers: NO_STORE },
    )
  }
}
