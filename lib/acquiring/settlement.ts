import crypto from "crypto"
import { prisma } from "@/lib/prisma"

type SettlementInput = {
  orderId: string
  txHash: string
  payerAddress?: string | null
  paymentMethod?: string
}

function webhookSignature(body: string): string | null {
  const secret = process.env.ACQUIRING_WEBHOOK_SECRET
  if (!secret) return null
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

async function notifyMerchant(order: {
  notify_url: string | null
  order_no: string
  merchant_id: string
  amount: number
  currency: string
  token: string
  tx_hash: string | null
  paid_at: Date | null
}) {
  if (!order.notify_url) return
  const payload = JSON.stringify({
    event: "order.paid",
    order_no: order.order_no,
    merchant_id: order.merchant_id,
    amount: order.amount,
    currency: order.currency,
    token: order.token,
    status: "paid",
    tx_hash: order.tx_hash,
    paid_at: order.paid_at,
  })
  const signature = webhookSignature(payload)
  try {
    await fetch(order.notify_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-protocolbank-signature": `sha256=${signature}` } : {}),
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    })
  } catch (error) {
    console.error("[Acquiring] Webhook delivery failed:", error)
  }
}

export async function markAcquiringOrderPaid(input: SettlementInput) {
  let wasPending = false

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.acquiringOrder.findUnique({
      where: { id: input.orderId },
    })
    if (!current) throw new Error("Order not found")
    if (current.status === "paid") return current
    if (current.status !== "pending") throw new Error(`Order is ${current.status}`)

    const updatedCount = await tx.acquiringOrder.updateMany({
      where: { id: current.id, status: "pending" },
      data: {
        status: "paid",
        payment_method: input.paymentMethod || "crypto_transfer",
        payer_address: input.payerAddress || current.payer_address,
        tx_hash: input.txHash,
        paid_at: new Date(),
      },
    })

    if (updatedCount.count === 0) {
      const alreadyPaid = await tx.acquiringOrder.findUnique({ where: { id: current.id } })
      if (!alreadyPaid) throw new Error("Order not found")
      return alreadyPaid
    }

    wasPending = true
    const paidOrder = await tx.acquiringOrder.findUnique({ where: { id: current.id } })
    if (!paidOrder) throw new Error("Order not found")

    const balance = await tx.merchantBalance.findFirst({
      where: { merchant_id: current.merchant_id, token: current.token },
    })
    if (balance) {
      await tx.merchantBalance.update({
        where: { id: balance.id },
        data: {
          balance: String(Number.parseFloat(balance.balance) + current.amount),
          updated_at: new Date(),
        },
      })
    } else {
      await tx.merchantBalance.create({
        data: {
          merchant_id: current.merchant_id,
          token: current.token,
          balance: String(current.amount),
        },
      })
    }

    return paidOrder
  })

  if (wasPending) {
    await notifyMerchant(order)
  }

  return { order, wasPending }
}
