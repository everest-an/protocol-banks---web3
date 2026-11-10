import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getAppBaseUrl,
  getTrust3EasypayConfig,
  isTrust3NotifyUrl,
  parseCnyToUsd,
} from "@/lib/trust3-easypay/config"

export type Trust3EasypayOrderResult = {
  orderNo: string
  checkoutUrl: string
  cnyAmount: string
  usdAmount: number
}

export async function createTrust3EasypayOrder(
  request: NextRequest,
  params: Record<string, string>,
): Promise<Trust3EasypayOrderResult> {
  const config = getTrust3EasypayConfig()
  if (!config.pkey) throw new Error("ProtocolBank Trust3 adapter is not configured")
  if (!config.merchantId) throw new Error("ProtocolBank Trust3 merchant is not configured")
  if (params.pid !== config.pid) throw new Error("Unknown merchant")
  if (params.type !== "usdc") throw new Error("Unsupported payment type")

  const outTradeNo = (params.out_trade_no || "").trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(outTradeNo)) throw new Error("Invalid order number")

  const notifyUrl = (params.notify_url || config.notifyUrl).trim()
  if (!isTrust3NotifyUrl(notifyUrl)) throw new Error("Invalid Trust3 notify URL")

  const { cny, usd } = parseCnyToUsd(params.money || "", config.cnyPerUsd)
  const metadata = {
    source: "trust3",
    trust3_pid: config.pid,
    trust3_out_trade_no: outTradeNo,
    trust3_notify_url: notifyUrl,
    trust3_name: (params.name || "Trust3 recharge").slice(0, 120),
    cny_amount: cny.toFixed(2),
    usd_amount: usd.toFixed(2),
  }

  const existing = await prisma.acquiringOrder.findUnique({ where: { order_no: outTradeNo } })
  if (existing) {
    if (existing.merchant_id !== config.merchantId) throw new Error("Order belongs to another merchant")
    if (existing.status === "paid") throw new Error("Order is already paid")
    return {
      orderNo: existing.order_no,
      checkoutUrl: `${getAppBaseUrl(request)}/checkout?order=${encodeURIComponent(existing.order_no)}`,
      cnyAmount: cny.toFixed(2),
      usdAmount: usd,
    }
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: config.merchantId },
    select: { id: true, status: true, wallet_address: true },
  })
  if (!merchant || merchant.status !== "active" || !merchant.wallet_address) {
    throw new Error("Trust3 merchant is not available")
  }

  const order = await prisma.acquiringOrder.create({
    data: {
      order_no: outTradeNo,
      merchant_id: merchant.id,
      amount: usd,
      currency: "USD",
      token: "USDC",
      notify_url: `${getAppBaseUrl(request)}/api/trust3/easypay/pb-webhook`,
      return_url: params.return_url || null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      metadata,
      status: "pending",
    },
  })

  return {
    orderNo: order.order_no,
    checkoutUrl: `${getAppBaseUrl(request)}/checkout?order=${encodeURIComponent(order.order_no)}`,
    cnyAmount: cny.toFixed(2),
    usdAmount: usd,
  }
}
