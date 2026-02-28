/**
 * Order Details API
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const { orderNo } = await params

    // Get order information
    const order = await prisma.acquiringOrder.findUnique({
      where: { order_no: orderNo },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Get merchant information
    const merchant = await prisma.merchant.findUnique({
      where: { id: order.merchant_id },
      select: { name: true, logo_url: true, wallet_address: true },
    })

    // Check if order is expired
    if (new Date(order.expires_at) < new Date() && order.status === "pending") {
      await prisma.acquiringOrder.update({
        where: { id: order.id },
        data: { status: "expired" },
      })
      order.status = "expired"
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        merchant_name: merchant?.name,
        merchant_logo: merchant?.logo_url,
        merchant_wallet_address: merchant?.wallet_address,
      },
    })
  } catch (error: any) {
    console.error("[API] Order fetch error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Update order status (payment callback)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  return withAuth(async (req, callerAddress) => {
    try {
      const { orderNo } = await params
      const body = await req.json()
      const { status, payment_method, payer_address, tx_hash } = body

      const updateData: any = {
        status,
        updated_at: new Date(),
      }

      if (payment_method) updateData.payment_method = payment_method
      if (payer_address) updateData.payer_address = payer_address
      if (tx_hash) updateData.tx_hash = tx_hash
      if (status === "paid") updateData.paid_at = new Date()

      const order = await prisma.acquiringOrder.update({
        where: { order_no: orderNo },
        data: updateData,
      })

      // If order is paid, update merchant balance
      if (status === "paid" && order) {
        const existingBalance = await prisma.merchantBalance.findFirst({
          where: { merchant_id: order.merchant_id, token: order.token },
        })

        if (existingBalance) {
          await prisma.merchantBalance.update({
            where: { id: existingBalance.id },
            data: {
              balance: String(parseFloat(existingBalance.balance) + order.amount),
              updated_at: new Date(),
            },
          })
        } else {
          await prisma.merchantBalance.create({
            data: {
              merchant_id: order.merchant_id,
              token: order.token,
              balance: String(order.amount),
            },
          })
        }

        // Send Webhook notification (if configured)
        if (order.notify_url) {
          try {
            await fetch(order.notify_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "order.paid",
                order_no: order.order_no,
                amount: order.amount,
                token: order.token,
                tx_hash: order.tx_hash,
                paid_at: order.paid_at,
              }),
            })
          } catch (webhookError) {
            console.error("[API] Webhook notification error:", webhookError)
          }
        }
      }

      return NextResponse.json({ success: true, order })
    } catch (error: any) {
      console.error("[API] Order update error:", error)
      return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
  }, { component: 'acquiring-orders-id' })(request)
}
