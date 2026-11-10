import crypto from "crypto"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  easypaySign,
  getTrust3EasypayConfig,
  isTrust3NotifyUrl,
} from "@/lib/trust3-easypay/config"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

function verifyProtocolBankSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.ACQUIRING_WEBHOOK_SECRET
  if (!secret || !header) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const supplied = header.replace(/^sha256=/i, "").trim()
  if (supplied.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    if (!verifyProtocolBankSignature(rawBody, request.headers.get("x-protocolbank-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers: NO_STORE })
    }

    const event = JSON.parse(rawBody)
    if (event.event !== "order.paid" || event.status !== "paid") {
      return NextResponse.json({ success: true, ignored: true }, { headers: NO_STORE })
    }

    const orderNo = String(event.order_no || "").trim()
    const order = await prisma.acquiringOrder.findFirst({
      where: { order_no: orderNo },
      include: { merchant: { select: { name: true } } },
    })
    if (!order) {
      return NextResponse.json({ success: true, ignored: true }, { headers: NO_STORE })
    }

    const metadata = (order.metadata || {}) as Record<string, unknown>
    const config = getTrust3EasypayConfig()
    const notifyUrl = String(metadata.trust3_notify_url || config.notifyUrl)
    if (!isTrust3NotifyUrl(notifyUrl)) {
      console.error("[Trust3 EasyPay] refusing non-Trust3 notify URL")
      return NextResponse.json({ success: true, ignored: true }, { headers: NO_STORE })
    }
    if (!config.pkey) {
      throw new Error("Trust3 EasyPay pkey is not configured")
    }

    const params: Record<string, string> = {
      pid: String(metadata.trust3_pid || config.pid),
      trade_no: String(event.tx_hash || order.tx_hash || order.order_no),
      out_trade_no: String(metadata.trust3_out_trade_no || order.order_no),
      type: "usdc",
      name: String(metadata.trust3_name || "Trust3 recharge"),
      money: String(metadata.cny_amount || order.amount.toFixed(2)),
      trade_status: "TRADE_SUCCESS",
      sign_type: "MD5",
    }
    params.sign = easypaySign(params, config.pkey)

    const body = new URLSearchParams(params).toString()
    let delivered = false
    for (let attempt = 1; attempt <= 3 && !delivered; attempt++) {
      try {
        const response = await fetch(notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15000),
        })
        delivered = response.ok
        if (!delivered) {
          console.error("[Trust3 EasyPay] Trust3 notify failed", response.status, "attempt", attempt)
        }
      } catch (error) {
        console.error("[Trust3 EasyPay] Trust3 notify error", "attempt", attempt, error)
      }
      if (!delivered) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error: any) {
    console.error("[Trust3 EasyPay] ProtocolBank webhook failed:", error)
    return NextResponse.json({ error: error.message || "Webhook failed" }, { status: 500, headers: NO_STORE })
  }
}
